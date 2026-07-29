(function (g) {
  "use strict";

  function makeId(now) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "g" + now + "-" + Math.random().toString(36).slice(2, 10);
  }

  function newGame({ def, players, variants, now }) {
    return {
      id: makeId(now),
      gameTypeId: def.id,
      rulesVersion: def.rulesVersion,
      schemaVersion: 1,
      status: "in_progress",
      // Hráč přichází jako objekt {name, color} — jméno i barva jsou syrová
      // fakta hráče (barvu přiřazuje vždy zakládání hry, viz ui/setup.js).
      players: players.map((p, i) =>
        ({ id: "p" + (i + 1), name: p.name, color: p.color, order: i })),
      variants: variants,
      log: [],
      createdAt: now,
      lastPlayedAt: now,
      endedAt: null,
      label: null,
      frozenResult: null,
    };
  }

  function addEntry(game, records, now) {
    const maxSeq = game.log.reduce((m, r) => Math.max(m, r.seq), -1);
    const maxEntryId = game.log.reduce((m, r) => Math.max(m, r.entryId), -1);
    const entryId = maxEntryId + 1;
    records.forEach((rec, i) => {
      game.log.push({
        playerId: rec.playerId,
        roundIndex: rec.roundIndex,
        value: rec.value,
        special: rec.special,
        flags: rec.flags,
        seq: maxSeq + 1 + i,
        entryId,
        ts: now,
      });
    });
    game.lastPlayedAt = now;
    return game;
  }

  function undo(game) {
    if (game.log.length === 0) return false;
    const maxEntryId = game.log.reduce((m, r) => Math.max(m, r.entryId), -1);
    game.log = game.log.filter((r) => r.entryId !== maxEntryId);
    return true;
  }

  function groupByRound(log) {
    const byRound = new Map();
    const sorted = [...log].sort((a, b) => a.seq - b.seq);
    for (const rec of sorted) {
      if (!byRound.has(rec.roundIndex)) byRound.set(rec.roundIndex, []);
      byRound.get(rec.roundIndex).push(rec);
    }
    const roundIndexes = [...byRound.keys()].sort((a, b) => a - b);
    return roundIndexes.map((roundIndex) => ({ roundIndex, records: byRound.get(roundIndex) }));
  }

  function rankPlayers(playerIds, totals, direction, def, core, ctx) {
    const sorted = [...playerIds].sort((a, b) => {
      const diff = direction === "min" ? totals[a] - totals[b] : totals[b] - totals[a];
      if (diff !== 0) return diff;
      if (typeof def.tiebreak === "function") {
        const tb = def.tiebreak(a, b, core, ctx);
        if (tb) return tb;
      }
      return 0;
    });
    const ranking = sorted.map((playerId, idx) => {
      let rank = idx + 1;
      for (let j = 0; j < idx; j++) {
        const other = sorted[j];
        const sameTotal = totals[other] === totals[playerId];
        let sameAfterTiebreak = sameTotal;
        if (sameTotal && typeof def.tiebreak === "function") {
          const tb = def.tiebreak(other, playerId, core, ctx);
          sameAfterTiebreak = !tb;
        }
        if (sameAfterTiebreak) { rank = j + 1; break; }
      }
      return { playerId, rank };
    });
    return ranking;
  }

  function derive(game, def) {
    const variants = g.Score.Games.mergeVariants(def, game.variants);
    const ctx = { game, def, variants, players: game.players };
    const playerIds = game.players.map((p) => p.id);

    const grouped = groupByRound(game.log);

    const totals = {};
    for (const pid of playerIds) totals[pid] = 0;

    let currentTotals = totals;
    const memo = {};
    const totalEvents = [];
    const rounds = [];

    for (const { roundIndex, records } of grouped) {
      const { scores, flags, display } = def.roundScores(records, ctx);
      for (const pid of playerIds) {
        if (scores[pid] !== undefined) currentTotals[pid] += scores[pid];
      }
      if (typeof def.transformTotals === "function") {
        const result = def.transformTotals(currentTotals, { roundIndex, memo, ...ctx });
        if (result) {
          currentTotals = result.totals || currentTotals;
          if (result.events) {
            for (const ev of result.events) totalEvents.push({ ...ev, roundIndex });
          }
        }
      }
      // display: volitelný rozpis zápisu buňky od pluginu (např. "2+10", "+50") —
      // tabulka ho ukáže místo sečteného čísla, součty počítá vždy ze scores.
      rounds.push({ roundIndex, records, scores, flags: flags || {}, display: display || {} });
    }

    const core = { rounds, totals: currentTotals };
    const overResult = def.isGameOver(core, ctx);
    const finished = !!(overResult && overResult.finished);

    const roundsPlanned = def.endType === "fixedRounds" && typeof def.rounds === "function"
      ? def.rounds(playerIds.length)
      : null;

    const state = {
      rounds,
      totals: currentTotals,
      totalEvents,
      roundsPlanned,
      finished,
      endedNow: finished,
    };

    if (finished) {
      const direction = def.winnerDirection;
      const ranks = rankPlayers(playerIds, currentTotals, direction, def, core, ctx);
      const ranking = ranks.map(({ playerId, rank }) => {
        const player = game.players.find((p) => p.id === playerId);
        return { playerId, name: player.name, total: currentTotals[playerId], rank };
      });
      const topRank = Math.min(...ranking.map((r) => r.rank));
      const winnerIds = ranking.filter((r) => r.rank === topRank).map((r) => r.playerId);
      state.ranking = ranking;
      state.winnerIds = winnerIds;
      state.tie = winnerIds.length > 1;
      state.next = null;
    } else {
      if (def.inputModel === "allPlayersAtOnce") {
        const nextRoundIndex = rounds.length;
        if (def.endType === "fixedRounds" && roundsPlanned !== null && nextRoundIndex >= roundsPlanned) {
          state.next = null;
        } else {
          const starterIndex = typeof def.starter === "function"
            ? def.starter(nextRoundIndex, playerIds.length)
            : 0;
          state.next = { type: "round", roundIndex: nextRoundIndex, starterIndex };
        }
      } else if (def.inputModel === "perPlayerSequential") {
        state.next = def.nextTurn(core, ctx);
      } else {
        state.next = null;
      }
    }

    return state;
  }

  function freeze(game, state, now) {
    game.status = "finished";
    game.endedAt = now;
    game.frozenResult = {
      endedAt: now,
      ranking: state.ranking,
      winnerIds: state.winnerIds,
      tie: state.tie,
      rounds: state.rounds.map(({ roundIndex, scores, flags, display }) =>
        ({ roundIndex, scores, flags, display })),
      totals: state.totals,
      totalEvents: state.totalEvents,
    };
    return game;
  }

  function unfreeze(game) {
    game.status = "in_progress";
    game.endedAt = null;
    game.frozenResult = null;
    return game;
  }

  g.Score = g.Score || {};
  g.Score.Engine = { newGame, addEntry, undo, derive, freeze, unfreeze };
})(globalThis);

(function (g) {
  "use strict";

  function addFlag(flags, playerId, flag) {
    if (!flags[playerId]) flags[playerId] = [];
    flags[playerId].push(flag);
  }

  g.Score.Games.register({
    id: "cabo",
    name: "CABO",
    rulesVersion: 1,
    accentColor: "#c0392b",
    icon: "🃏",
    playerRange: { min: 2, max: 4 },
    endType: "targetScore",
    winnerDirection: "min",
    inputModel: "allPlayersAtOnce",
    // Hranice pro scoreboard: ke 100 se hráči blíží „zespodu" a překročení
    // znamená vyřazení (kind "avoid") — UI ji kreslí jako varovnou čáru.
    scoreScale() { return { max: 100, kind: "avoid" }; },
    // Pořadí je plnohodnotné (nejnižší součet, druhý nejnižší, …) → medaile 🥇🥈🥉.
    rankingStyle: "podium",
    variants: [
      {
        id: "caboPenalty",
        label: "Penalizace za neúspěšné „Kabo!“",
        type: "enum",
        options: [{ value: 10, label: "+10" }, { value: 5, label: "+5" }],
        default: 10,
        help: "Kolik bodů dostane volající, který nemá nejnižší součet.",
      },
      {
        id: "zeroInRound",
        label: "Kdo dostává v kole 0",
        type: "enum",
        options: [
          { value: "callerOnly", label: "Jen úspěšný volající" },
          { value: "lowest", label: "Nejnižší hráč(i)" },
        ],
        default: "callerOnly",
      },
      {
        id: "endRule",
        label: "Konec hry",
        type: "enum",
        options: [
          { value: "atOrAbove100", label: "≥ 100 (první přesná 100 → 50)" },
          { value: "over100", label: "Striktně přes 100" },
        ],
        default: "atOrAbove100",
      },
      {
        id: "scoreEntry",
        label: "Zadávání bodů",
        type: "enum",
        options: [
          { value: "manual", label: "Ručně (finální čísla)" },
          { value: "raw", label: "Surové součty (appka dopočítá)" },
        ],
        default: "manual",
      },
    ],
    validateInput(value) {
      return Number.isInteger(value) && value >= 0 ? null : "Zadej celé číslo ≥ 0.";
    },
    specialMoves: [{ id: "kamikaze", label: "Kamikaze", icon: "💥", params: [] }],
    roundScores(records, ctx) {
      const scores = {};
      const flags = {};
      const kamikazeRecord = records.find((r) => r.special === "kamikaze");

      if (kamikazeRecord) {
        for (const player of ctx.players) {
          const rec = records.find((r) => r.playerId === player.id);
          if (player.id === kamikazeRecord.playerId) {
            scores[player.id] = 0;
            addFlag(flags, player.id, "kamikaze");
          } else {
            scores[player.id] = 50;
            addFlag(flags, player.id, "kamikazeVictim");
          }
          if (rec && rec.flags && rec.flags.cabo) addFlag(flags, player.id, "cabo");
        }
        return { scores, flags };
      }

      const scoreEntry = ctx.variants.scoreEntry;

      if (scoreEntry !== "raw") {
        for (const rec of records) {
          scores[rec.playerId] = rec.value;
          if (rec.flags && rec.flags.cabo) addFlag(flags, rec.playerId, "cabo");
        }
        return { scores, flags };
      }

      const min = Math.min(...records.map((r) => r.value));
      const caller = records.find((r) => r.flags && r.flags.cabo);
      const zeroInRound = ctx.variants.zeroInRound;
      const penalty = ctx.variants.caboPenalty;

      for (const rec of records) {
        const isCaller = caller && rec.playerId === caller.playerId;
        if (isCaller) {
          if (rec.value === min) {
            scores[rec.playerId] = 0;
            addFlag(flags, rec.playerId, "caboSuccess");
            if (zeroInRound === "lowest") addFlag(flags, rec.playerId, "lowestZero");
          } else {
            scores[rec.playerId] = rec.value + penalty;
            addFlag(flags, rec.playerId, "caboFail");
          }
        } else if (zeroInRound === "lowest" && rec.value === min) {
          scores[rec.playerId] = 0;
          addFlag(flags, rec.playerId, "lowestZero");
        } else {
          scores[rec.playerId] = rec.value;
        }
      }
      return { scores, flags };
    },
    transformTotals(totals, tctx) {
      const memo = tctx.memo;
      if (!memo.halved) memo.halved = {};
      const events = [];
      const next = { ...totals };
      for (const pid of Object.keys(next)) {
        if (next[pid] === 100 && !memo.halved[pid]) {
          next[pid] = 50;
          memo.halved[pid] = true;
          events.push({ playerId: pid, type: "halved" });
        }
      }
      return { totals: next, events };
    },
    isGameOver(core, ctx) {
      const limit = ctx.variants.endRule === "over100"
        ? (t) => t > 100
        : (t) => t >= 100;
      return { finished: Object.values(core.totals).some(limit) };
    },
    tiebreak(a, b, core) {
      const last = core.rounds[core.rounds.length - 1];
      return (last.scores[a] ?? 0) - (last.scores[b] ?? 0);
    },
  });
})(globalThis);

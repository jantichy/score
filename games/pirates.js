(function (g) {
  "use strict";

  function addFlag(flags, playerId, flag) {
    if (!flags[playerId]) flags[playerId] = [];
    flags[playerId].push(flag);
  }

  function applyRecord(totals, rec, order) {
    if (rec.special === "skullIsland") {
      const mult = rec.flags.pirateCard ? 2 : 1;
      const penalty = 100 * rec.flags.skulls * mult;
      for (const id of order) {
        if (id !== rec.playerId) totals[id] -= penalty;
      }
    } else if (rec.special === "shipFail") {
      totals[rec.playerId] -= rec.flags.penalty;
    } else {
      totals[rec.playerId] += rec.value;
    }
  }

  function replay(ctx) {
    const { players, variants } = ctx;
    const target = variants.targetScore;
    const order = [...players].sort((a, b) => a.order - b.order).map((p) => p.id);
    const totals = Object.fromEntries(order.map((id) => [id, 0]));
    const turnsTaken = Object.fromEntries(order.map((id) => [id, 0]));
    let phase = "normal";        // normal | decisive | defense | done
    let queue = [];              // fronta rozhodujícího kola
    let trigger = null;
    let cursor = 0;              // index dalšího hráče v normální rotaci
    let decisiveHappened = false;
    const log = [...ctx.game.log].sort((a, b) => a.seq - b.seq);

    for (const rec of log) {
      applyRecord(totals, rec, order);
      turnsTaken[rec.playerId]++;

      if (phase === "normal") {
        cursor++;
        if (decisiveHappened && totals[rec.playerId] >= target) {
          phase = "done";
        } else if (totals[rec.playerId] >= target) {
          trigger = rec.playerId;
          phase = "decisive";
          decisiveHappened = true;
          const i = order.indexOf(trigger);
          queue = order.slice(i + 1).concat(order.slice(0, i));
        }
      } else if (phase === "decisive") {
        queue.shift();
        if (queue.length === 0) {
          const anyAtTarget = order.some((id) => totals[id] >= target);
          if (!anyAtTarget) {
            phase = "normal";
            trigger = null;
            cursor = order.indexOf(rec.playerId) + 1;
          } else if (
            variants.defenderReroll &&
            order.some((id) => id !== trigger && totals[id] >= totals[trigger])
          ) {
            phase = "defense";
          } else {
            phase = "done";
          }
        }
      } else if (phase === "defense") {
        phase = "done";
      }
    }

    const expectPlayer = () =>
      phase === "normal" ? order[cursor % order.length]
      : phase === "decisive" ? queue[0]
      : trigger;

    return { totals, turnsTaken, phase, expectPlayer, trigger, order };
  }

  g.Score.Games.register({
    id: "pirates",
    name: "Pirátské kostky",
    rulesVersion: 1,
    accentColor: "#1d5c8f",
    icon: "🏴‍☠️",
    playerRange: { min: 2, max: 5 },
    endType: "targetScore",
    winnerDirection: "max",
    inputModel: "perPlayerSequential",
    variants: [
      {
        id: "targetScore",
        label: "Cílové skóre",
        type: "number",
        options: [
          { value: 5000, label: "5000" },
          { value: 6000, label: "6000" },
          { value: 8000, label: "8000" },
        ],
        allowCustom: true,
        min: 1000,
        step: 100,
        default: 6000,
      },
      {
        id: "defenderReroll",
        label: "Obranný hod přehozeného vedoucího",
        type: "boolean",
        default: false,
        help: "Domácí varianta: přehozený vedoucí dostane ještě jeden hod navíc.",
      },
    ],
    validateInput(value) {
      return Number.isInteger(value) && value % 100 === 0
        ? null
        : "Zadej násobek 100 (může být záporný).";
    },
    specialMoves: [
      { id: "skullIsland", label: "Ostrov lebek", icon: "💀", params: ["skulls", "pirateCard"] },
      { id: "shipFail", label: "Pirátská loď — neúspěch", icon: "🚢", params: ["penalty"] },
    ],
    roundScores(records, ctx) {
      const scores = {};
      const flags = {};
      const skullRec = records.find((r) => r.special === "skullIsland");

      for (const rec of records) {
        if (rec.special === "shipFail") {
          scores[rec.playerId] = -rec.flags.penalty;
          addFlag(flags, rec.playerId, "shipFail");
        } else if (rec.special === "skullIsland") {
          scores[rec.playerId] = (scores[rec.playerId] || 0) + 0;
          addFlag(flags, rec.playerId, "skullIsland");
        } else {
          scores[rec.playerId] = (scores[rec.playerId] || 0) + rec.value;
        }
      }

      if (skullRec) {
        const mult = skullRec.flags.pirateCard ? 2 : 1;
        const penalty = 100 * skullRec.flags.skulls * mult;
        for (const player of ctx.players) {
          if (player.id === skullRec.playerId) continue;
          scores[player.id] = (scores[player.id] || 0) - penalty;
          addFlag(flags, player.id, "skullVictim");
        }
      }

      return { scores, flags };
    },
    nextTurn(core, ctx) {
      const st = replay(ctx);
      if (st.phase === "done") return null;
      const playerId = st.expectPlayer();
      const note = st.phase === "decisive" ? "Rozhodující kolo — poslední tah!"
        : st.phase === "defense" ? "Obranný hod!"
        : null;
      return { type: "turn", roundIndex: st.turnsTaken[playerId], playerId, note };
    },
    isGameOver(core, ctx) {
      return { finished: replay(ctx).phase === "done" };
    },
  });
})(globalThis);

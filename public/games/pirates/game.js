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
    } else if (rec.special === "bust") {
      // Vybouchnutí (tři lebky): 0 bodů, tah se ale počítá.
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
            order.some((id) => id !== trigger && totals[id] > totals[trigger])
          ) {
            phase = "defense";
          } else {
            phase = "done";
          }
        }
      } else if (phase === "defense") {
        // Obranný hod je zapsán jako jeden záznam. Když stáhne triggera (typicky
        // Ostrovem lebek) pod cíl, hra pokračuje stejně jako po neúspěšném
        // rozhodujícím kole — žádný auto-výherce, další ≥ cíl vyhrává rovnou.
        const anyAtTarget = order.some((id) => totals[id] >= target);
        if (!anyAtTarget) {
          phase = "normal";
          trigger = null;
          cursor = order.indexOf(rec.playerId) + 1;
        } else {
          phase = "done";
        }
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
    // Hranice pro scoreboard: cílové skóre se dobývá (kind "reach") — UI ji
    // kreslí jako metu a sloupec hráče nad ní dostává vítěznou barvu.
    scoreScale(ctx) { return { max: ctx.variants.targetScore, kind: "reach" }; },
    // Závod k cíli: smysl má jen vítěz (kdo první dosáhl cíle) → 🏆 bez medailí.
    rankingStyle: "winnerOnly",
    // Rychlá přičítací tlačítka vstupu (body jsou násobky 100).
    quickAmounts: [100, 200, 500, 1000],
    // Ikony a tooltipy vlajek v tabulce.
    flagMeta: {
      skullIsland: { icon: "☠️", title: "Ostrov lebek" },
      bust: { icon: "💥", title: "Vybouchnutí — tři lebky, 0 bodů" },
    },
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
      {
        id: "skullIsland", label: "Ostrov lebek", icon: "💀",
        params: [
          { id: "skulls", label: "Počet lebek", type: "number" },
          { id: "pirateCard", label: "Karta Pirát (×2)", type: "bool" },
        ],
      },
      // Bez parametrů → formulář režimu je jen tlačítko Zapsat, žádný input.
      { id: "bust", label: "Vybouchnutí", icon: "💥", params: [] },
    ],
    // Jediný zdroj bodovací pravdy: stejná applyRecord, kterou používá replay()
    // pro detekci konce hry, se tu skládá nad nulovými součty jednoho kola.
    // Vlajky (flags) se počítají odděleně — nejsou součástí bodovací sémantiky.
    roundScores(records, ctx) {
      const order = ctx.players.map((p) => p.id);
      const scores = Object.fromEntries(order.map((id) => [id, 0]));
      const flags = {};
      // Skóre kola smí dostat jen hráč, kterého se kolo zatím týká (vlastní záznam,
      // nebo oběť Ostrova lebek) — jinak by tabulka ukazovala „0" i hráčům, kteří
      // v sekvenčním modelu na svůj tah teprve čekají.
      const touched = new Set();
      // parts: složky zápisu buňky per hráč (vlastní tah, pak penalizace lebek) —
      // z více složek se staví explicitní rozpis, např. "800-600".
      const parts = Object.fromEntries(order.map((id) => [id, []]));

      for (const rec of records) {
        applyRecord(scores, rec, order);
        touched.add(rec.playerId);
        if (rec.special === "bust") {
          addFlag(flags, rec.playerId, "bust");
          parts[rec.playerId].push(0);
        } else if (rec.special === "skullIsland") {
          // Ikonu ☠️ dostává jen pachatel; oběti poznají penalizaci z rozpisu buňky.
          addFlag(flags, rec.playerId, "skullIsland");
          parts[rec.playerId].push(0);
          const per = 100 * rec.flags.skulls * (rec.flags.pirateCard ? 2 : 1);
          for (const player of ctx.players) {
            if (player.id === rec.playerId) continue;
            touched.add(player.id);
            parts[player.id].push(-per);
          }
        } else {
          parts[rec.playerId].push(rec.value);
        }
      }

      const display = {};
      for (const id of order) {
        if (!touched.has(id)) { delete scores[id]; continue; }
        // Vlastní tah (má-li ho hráč v kole) patří v rozpisu na začátek,
        // penalizace od ostatních za něj — bez ohledu na pořadí záznamů.
        const own = [];
        const penalties = [];
        for (const part of parts[id]) {
          (own.length === 0 && part >= 0 ? own : penalties).push(part);
        }
        const ordered = own.concat(penalties);
        if (ordered.length > 1) {
          display[id] = ordered
            .map((n, i) => (i === 0 ? String(n) : (n < 0 ? String(n) : "+" + n)))
            .join("");
        }
      }
      return { scores, flags, display };
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

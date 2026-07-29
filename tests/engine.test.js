"use strict";
const assert = require("node:assert");
require("../public/js/games.js");
require("../public/js/engine.js");
const { Engine, Games } = globalThis.Score;

const TestDef = {
  id: "tg", name: "TestGame", rulesVersion: 1,
  playerRange: { min: 2, max: 4 },
  endType: "targetScore", winnerDirection: "max",
  inputModel: "allPlayersAtOnce",
  variants: [{ id: "target", label: "Cíl", type: "number", default: 30 }],
  validateInput: () => null,
  specialMoves: [],
  roundScores(records) {
    const scores = {};
    for (const r of records) scores[r.playerId] = r.value;
    return { scores, flags: {} };
  },
  isGameOver(core, ctx) {
    return { finished: Object.values(core.totals).some((t) => t >= ctx.variants.target) };
  },
};

// Hráči jdou do newGame vždy jako objekty {name, color} — barvu přiřazuje
// zakládání hry, testy enginu ji jen protahují.
function colored(names) {
  const palette = ["#f28b82", "#f8b26a", "#fde293", "#81c995"];
  return names.map((name, i) => ({ name, color: palette[i] }));
}
function makeGame(variants) {
  return Engine.newGame({ def: TestDef, players: colored(["A", "B"]), variants: variants || {}, now: 1000 });
}
function round(game, values, now) {
  const roundIndex = new Set(game.log.map((r) => r.roundIndex)).size;
  Engine.addEntry(game, game.players.map((p, i) =>
    ({ playerId: p.id, roundIndex, value: values[i], special: null, flags: {} })), now || 2000);
}

test("newGame: hráč nese jméno i barvu jako syrová fakta", () => {
  const game = makeGame();
  assert.deepStrictEqual(game.players.map((p) => [p.name, p.color, p.order]),
    [["A", "#f28b82", 0], ["B", "#f8b26a", 1]]);
});

test("newGame: tvar záznamu", () => {
  const game = makeGame();
  assert.strictEqual(game.gameTypeId, "tg");
  assert.strictEqual(game.status, "in_progress");
  assert.strictEqual(game.schemaVersion, 1);
  assert.deepStrictEqual(game.players.map((p) => [p.id, p.name, p.order]),
    [["p1", "A", 0], ["p2", "B", 1]]);
  assert.deepStrictEqual(game.log, []);
  assert.strictEqual(game.frozenResult, null);
  assert.strictEqual(game.lastPlayedAt, 1000);
});

test("addEntry: seq, entryId, ts, lastPlayedAt", () => {
  const game = makeGame();
  round(game, [10, 5], 2000);
  round(game, [3, 7], 3000);
  assert.deepStrictEqual(game.log.map((r) => r.seq), [0, 1, 2, 3]);
  assert.deepStrictEqual(game.log.map((r) => r.entryId), [0, 0, 1, 1]);
  assert.strictEqual(game.lastPlayedAt, 3000);
});

test("derive: kola, totals, next kolo", () => {
  const game = makeGame();
  round(game, [10, 5]); round(game, [3, 7]);
  const st = Engine.derive(game, TestDef);
  assert.strictEqual(st.rounds.length, 2);
  assert.deepStrictEqual(st.totals, { p1: 13, p2: 12 });
  assert.strictEqual(st.finished, false);
  assert.deepStrictEqual(st.next, { type: "round", roundIndex: 2, starterIndex: 0 });
});

test("undo: odebere celý poslední entry", () => {
  const game = makeGame();
  round(game, [10, 5]); round(game, [3, 7]);
  assert.strictEqual(Engine.undo(game), true);
  assert.strictEqual(game.log.length, 2);
  assert.deepStrictEqual(Engine.derive(game, TestDef).totals, { p1: 10, p2: 5 });
  Engine.undo(game);
  assert.strictEqual(Engine.undo(game), false);
});

test("konec hry + ranking + vítěz", () => {
  const game = makeGame();
  round(game, [20, 5]); round(game, [15, 5]);
  const st = Engine.derive(game, TestDef);
  assert.strictEqual(st.finished, true);
  assert.strictEqual(st.next, null);
  assert.deepStrictEqual(st.winnerIds, ["p1"]);
  assert.deepStrictEqual(st.ranking.map((r) => [r.playerId, r.rank]),
    [["p1", 1], ["p2", 2]]);
});

test("remíza bez tiebreaku → sdílený rank a tie", () => {
  const game = makeGame();
  round(game, [30, 30]);
  const st = Engine.derive(game, TestDef);
  assert.strictEqual(st.tie, true);
  assert.deepStrictEqual(st.winnerIds, ["p1", "p2"]);
  assert.deepStrictEqual(st.ranking.map((r) => r.rank), [1, 1]);
});

test("tiebreak rozřadí shodné", () => {
  const def = { ...TestDef, tiebreak: (a, b) => (a === "p2" ? -1 : 1) };
  const game = makeGame();
  round(game, [30, 30]);
  const st = Engine.derive(game, def);
  assert.strictEqual(st.tie, false);
  assert.deepStrictEqual(st.winnerIds, ["p2"]);
});

test("transformTotals + memo + totalEvents", () => {
  const def = {
    ...TestDef,
    variants: [{ id: "target", label: "Cíl", type: "number", default: 100 }],
    transformTotals(totals, tctx) {
      const events = [];
      for (const [pid, t] of Object.entries(totals)) {
        if (t === 20 && !tctx.memo[pid]) {
          tctx.memo[pid] = true; totals[pid] = 10;
          events.push({ playerId: pid, type: "halved" });
        }
      }
      return { totals, events };
    },
  };
  const game = makeGame();
  round(game, [20, 5]);   // p1: 20 → 10
  round(game, [10, 5]);   // p1: 20 znovu, memo → už se nepůlí
  const st = Engine.derive(game, def);
  assert.strictEqual(st.totals.p1, 20);
  assert.deepStrictEqual(st.totalEvents, [{ roundIndex: 0, playerId: "p1", type: "halved" }]);
});

test("transformTotals vrací nový objekt (ne mutaci)", () => {
  const def = {
    ...TestDef,
    variants: [{ id: "target", label: "Cíl", type: "number", default: 100 }],
    transformTotals(totals, tctx) {
      const events = [];
      const next = Object.fromEntries(Object.entries(totals).map(([pid, t]) => {
        if (t === 20 && !tctx.memo[pid]) {
          tctx.memo[pid] = true;
          events.push({ playerId: pid, type: "halved" });
          return [pid, 10];
        }
        return [pid, t];
      }));
      return { totals: next, events };
    },
  };
  const game = makeGame();
  round(game, [20, 5]);   // p1: 20 → nový objekt s p1: 10
  round(game, [10, 5]);   // p1: 20 znovu, memo → už se nepůlí
  const st = Engine.derive(game, def);
  assert.strictEqual(st.totals.p1, 20);
  assert.deepStrictEqual(st.totalEvents, [{ roundIndex: 0, playerId: "p1", type: "halved" }]);
});

test("fixedRounds: roundsPlanned a konec po posledním kole", () => {
  const def = {
    ...TestDef, endType: "fixedRounds",
    rounds: (n) => n,
    starter: (roundIndex, n) => roundIndex % n,
    isGameOver(core, ctx) {
      return { finished: core.rounds.length >= ctx.def.rounds(ctx.players.length) };
    },
  };
  const game = makeGame();
  const st0 = Engine.derive(game, def);
  assert.strictEqual(st0.roundsPlanned, 2);
  assert.strictEqual(st0.next.starterIndex, 0);
  round(game, [1, 2]);
  assert.strictEqual(Engine.derive(game, def).next.starterIndex, 1);
  round(game, [3, 4]);
  const st = Engine.derive(game, def);
  assert.strictEqual(st.finished, true);
  assert.strictEqual(st.next, null);
});

test("freeze: snímek výsledku + status; unfreeze vrátí zpět", () => {
  const game = makeGame();
  round(game, [30, 10]);
  const st = Engine.derive(game, TestDef);
  Engine.freeze(game, st, 5000);
  assert.strictEqual(game.status, "finished");
  assert.strictEqual(game.endedAt, 5000);
  assert.deepStrictEqual(game.frozenResult.winnerIds, ["p1"]);
  assert.deepStrictEqual(game.frozenResult.totals, { p1: 30, p2: 10 });
  Engine.unfreeze(game);
  assert.strictEqual(game.status, "in_progress");
  assert.strictEqual(game.frozenResult, null);
});

test("variants: merge s defaulty (starší hra bez klíče)", () => {
  const game = makeGame();       // variants {} → target spadne na default 30
  round(game, [30, 0]);
  assert.strictEqual(Engine.derive(game, TestDef).finished, true);
});

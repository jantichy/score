"use strict";
const assert = require("node:assert");
require("../js/games.js");
require("../js/engine.js");
require("../games/scout.js");
const { Engine, Games } = globalThis.Score;
const def = Games.get("scout");

function makeGame(names) {
  return Engine.newGame({ def, players: names, variants: {}, now: 1 });
}
function round(game, values) {
  const roundIndex = new Set(game.log.map((r) => r.roundIndex)).size;
  Engine.addEntry(game, game.players.map((p, i) => ({ playerId: p.id,
    roundIndex, value: values[i], special: null, flags: {} })), 2);
}

test("počet kol = počet hráčů; předem známý", () => {
  const g = makeGame(["A", "B", "C"]);
  assert.strictEqual(Engine.derive(g, def).roundsPlanned, 3);
});

test("rotace startéra +1 po směru", () => {
  const g = makeGame(["A", "B", "C"]);
  assert.strictEqual(Engine.derive(g, def).next.starterIndex, 0);
  round(g, [5, 3, -2]);
  assert.strictEqual(Engine.derive(g, def).next.starterIndex, 1);
});

test("záporné hodnoty a konec po posledním kole; vyhrává max", () => {
  const g = makeGame(["A", "B"]);
  round(g, [5, -3]); round(g, [-1, 10]);
  const st = Engine.derive(g, def);
  assert.strictEqual(st.finished, true);
  assert.deepStrictEqual(st.totals, { p1: 4, p2: 7 });
  assert.deepStrictEqual(st.winnerIds, ["p2"]);
});

test("remíza → sdílené pořadí", () => {
  const g = makeGame(["A", "B"]);
  round(g, [5, 5]); round(g, [3, 3]);
  const st = Engine.derive(g, def);
  assert.strictEqual(st.tie, true);
  assert.deepStrictEqual(st.ranking.map((r) => r.rank), [1, 1]);
});

test("validateInput: záporná celá čísla OK", () => {
  assert.strictEqual(def.validateInput(-7, {}), null);
  assert.ok(typeof def.validateInput(2.5, {}) === "string");
});

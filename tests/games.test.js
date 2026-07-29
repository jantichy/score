"use strict";
const assert = require("node:assert");
require("../public/js/games.js");
const { Games } = globalThis.Score;

function makeDef(id) {
  return {
    id, name: "Test", rulesVersion: 1,
    playerRange: { min: 2, max: 4 },
    endType: "targetScore", winnerDirection: "max",
    inputModel: "allPlayersAtOnce",
    variants: [
      { id: "target", label: "Cíl", type: "number", default: 30 },
      { id: "bonus", label: "Bonus", type: "bool", default: false },
    ],
    roundScores: () => ({ scores: {}, flags: {} }),
    isGameOver: () => ({ finished: false }),
  };
}

test("register + get + list", () => {
  Games.register(makeDef("t1"));
  assert.strictEqual(Games.get("t1").name, "Test");
  assert.ok(Games.list().some((d) => d.id === "t1"));
});

test("duplicitní id vyhodí chybu", () => {
  assert.throws(() => Games.register(makeDef("t1")), /t1/);
});

test("chybějící povinné pole vyhodí chybu", () => {
  const def = makeDef("t2"); delete def.inputModel;
  assert.throws(() => Games.register(def), /inputModel/);
});

test("defaultVariants", () => {
  assert.deepStrictEqual(Games.defaultVariants(makeDef("x")),
    { target: 30, bonus: false });
});

test("mergeVariants: stored přepíše default, neznámé klíče zahodí, null projde", () => {
  const def = makeDef("x");
  assert.deepStrictEqual(Games.mergeVariants(def, { target: 50, zombie: 1 }),
    { target: 50, bonus: false });
  assert.deepStrictEqual(Games.mergeVariants(def, null),
    { target: 30, bonus: false });
});

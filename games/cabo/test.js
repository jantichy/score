"use strict";
const assert = require("node:assert");
require("../../js/games.js");
require("../../js/engine.js");
require("./game.js");
const { Engine, Games } = globalThis.Score;
const def = Games.get("cabo");

function makeGame(variants, names) {
  return Engine.newGame({ def, players: names || ["A", "B", "C"],
    variants: variants || {}, now: 1 });
}
function caboRound(game, entries) {
  const roundIndex = new Set(game.log.map((r) => r.roundIndex)).size;
  Engine.addEntry(game, game.players.map((p, i) => ({
    playerId: p.id, roundIndex,
    value: entries[i].kamikaze || entries.some((e) => e.kamikaze) ? null : entries[i].value,
    special: entries[i].kamikaze ? "kamikaze" : null,
    flags: entries[i].cabo ? { cabo: true } : {},
  })), 2);
}

test("registrace a metadata", () => {
  assert.strictEqual(def.inputModel, "allPlayersAtOnce");
  assert.strictEqual(def.winnerDirection, "min");
  assert.deepStrictEqual(def.playerRange, { min: 2, max: 4 });
});

test("ikony dle dohody: jednotný tlampač 📢 pro Kabo, kamikaze 💣, oživení ❤️", () => {
  assert.strictEqual(def.name, "Kabo");
  for (const flag of ["cabo", "caboFail", "caboSuccess"]) {
    assert.strictEqual(def.flagMeta[flag].icon, "📢", flag + " nese tlampač");
  }
  assert.strictEqual(def.flagMeta.kamikaze.icon, "💣");
  assert.strictEqual(def.specialMoves.find((m) => m.id === "kamikaze").icon, "💣");
  assert.strictEqual(def.roundFlags[0].label, "📢 Kabo");
  assert.ok(def.roundFlags[0].required, "volající Kaba je povinný");
});

test("manual: skóre = zapsaná čísla, cabo jen flag", () => {
  const g = makeGame();
  caboRound(g, [{ value: 0, cabo: true }, { value: 7 }, { value: 12 }]);
  const st = Engine.derive(g, def);
  assert.deepStrictEqual(st.totals, { p1: 0, p2: 7, p3: 12 });
  assert.deepStrictEqual(st.rounds[0].flags.p1, ["cabo"]);
});

test("kamikaze: 0 pro hráče, +50 ostatním", () => {
  const g = makeGame();
  caboRound(g, [{}, { kamikaze: true }, {}]);
  const st = Engine.derive(g, def);
  assert.deepStrictEqual(st.totals, { p1: 50, p2: 0, p3: 50 });
  assert.deepStrictEqual(st.rounds[0].flags.p2, ["kamikaze"]);
  assert.deepStrictEqual(st.rounds[0].flags.p1, ["kamikazeVictim"]);
});

test("raw: úspěšný volající → 0 (callerOnly), ostatní svůj součet", () => {
  const g = makeGame({ scoreEntry: "raw" });
  caboRound(g, [{ value: 3, cabo: true }, { value: 7 }, { value: 3 }]);
  const st = Engine.derive(g, def);   // p1 sdílí nejnižší → úspěch
  assert.deepStrictEqual(st.totals, { p1: 0, p2: 7, p3: 3 });
});

test("raw: neúspěšný volající → součet + 10", () => {
  const g = makeGame({ scoreEntry: "raw" });
  caboRound(g, [{ value: 8, cabo: true }, { value: 3 }, { value: 5 }]);
  const st = Engine.derive(g, def);
  assert.deepStrictEqual(st.totals, { p1: 18, p2: 3, p3: 5 });
  assert.ok(st.rounds[0].flags.p1.includes("caboFail"));
});

test("raw: penalizace 5 dle varianty", () => {
  const g = makeGame({ scoreEntry: "raw", caboPenalty: 5 });
  caboRound(g, [{ value: 8, cabo: true }, { value: 3 }, { value: 5 }]);
  assert.strictEqual(Engine.derive(g, def).totals.p1, 13);
});

test("raw + zeroInRound=lowest: nulu dostávají nejnižší, i bez volání", () => {
  const g = makeGame({ scoreEntry: "raw", zeroInRound: "lowest" });
  caboRound(g, [{ value: 3 }, { value: 7, cabo: true }, { value: 3 }]);
  const st = Engine.derive(g, def);   // p1+p3 nejnižší → 0; p2 volal a nebyl → 7+10
  assert.deepStrictEqual(st.totals, { p1: 0, p2: 17, p3: 0 });
});

test("první přesná 100 → 50, hra pokračuje", () => {
  const g = makeGame({}, ["A", "B"]);
  caboRound(g, [{ value: 60 }, { value: 10 }]);
  caboRound(g, [{ value: 40 }, { value: 10 }]);   // p1: 100 → 50
  const st = Engine.derive(g, def);
  assert.strictEqual(st.totals.p1, 50);
  assert.strictEqual(st.finished, false);
  assert.deepStrictEqual(st.totalEvents, [{
    roundIndex: 1, playerId: "p1", type: "halved",
    adjust: -50, title: "Přesně 100 → 50", icon: "❤️",
  }]);
});

test("druhá přesná 100 (po vyčerpané záchraně) → konec", () => {
  const g = makeGame({}, ["A", "B"]);
  caboRound(g, [{ value: 100 }, { value: 10 }]);  // → 50
  caboRound(g, [{ value: 50 }, { value: 10 }]);   // 100 znovu, záchrana pryč
  const st = Engine.derive(g, def);
  assert.strictEqual(st.totals.p1, 100);
  assert.strictEqual(st.finished, true);
  assert.deepStrictEqual(st.winnerIds, ["p2"]);   // min vyhrává
});

test("překročení 100 → konec i s nevyčerpanou záchranou", () => {
  const g = makeGame({}, ["A", "B"]);
  caboRound(g, [{ value: 104 }, { value: 10 }]);
  assert.strictEqual(Engine.derive(g, def).finished, true);
});

test("endRule=over100: přesná 100 po záchraně nekončí", () => {
  const g = makeGame({ endRule: "over100" }, ["A", "B"]);
  caboRound(g, [{ value: 100 }, { value: 10 }]);  // → 50
  caboRound(g, [{ value: 50 }, { value: 10 }]);   // 100, strict → pokračuje
  const st = Engine.derive(g, def);
  assert.strictEqual(st.finished, false);
  caboRound(g, [{ value: 5 }, { value: 10 }]);    // 105 → konec
  assert.strictEqual(Engine.derive(g, def).finished, true);
});

test("tiebreak: při shodě vyhrává nižší poslední kolo", () => {
  const g = makeGame({}, ["A", "B", "C"]);
  caboRound(g, [{ value: 40 }, { value: 45 }, { value: 50 }]);
  caboRound(g, [{ value: 10 }, { value: 5 }, { value: 55 }]);  // p1=p2=50, C končí hru
  const st = Engine.derive(g, def);
  assert.strictEqual(st.finished, true);
  assert.deepStrictEqual(st.winnerIds, ["p2"]);   // poslední kolo 5 < 10
  assert.strictEqual(st.tie, false);
});

test("validateInput", () => {
  assert.strictEqual(def.validateInput(12, {}), null);
  assert.strictEqual(def.validateInput(0, {}), null);
  assert.ok(typeof def.validateInput(-1, {}) === "string");
  assert.ok(typeof def.validateInput(3.5, {}) === "string");
});

test("scoreScale: hranice 100, typ avoid", () => {
  assert.deepStrictEqual(def.scoreScale({ variants: {} }), { max: 100, kind: "avoid" });
});

test("display: neúspěšné Kabo v raw módu se rozepisuje jako součet", () => {
  const g = makeGame({ scoreEntry: "raw" });
  caboRound(g, [{ value: 8, cabo: true }, { value: 3 }, { value: 5 }]);
  const st = Engine.derive(g, def);
  assert.strictEqual(st.rounds[0].display.p1, "8+10");
  assert.strictEqual(st.rounds[0].display.p2, undefined);
});

test("display: oběti kamikaze mají +50", () => {
  const g = makeGame();
  caboRound(g, [{}, { kamikaze: true }, {}]);
  const st = Engine.derive(g, def);
  assert.strictEqual(st.rounds[0].display.p1, "+50");
  assert.strictEqual(st.rounds[0].display.p2, undefined);
  assert.strictEqual(st.rounds[0].display.p3, "+50");
});

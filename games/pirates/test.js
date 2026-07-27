"use strict";
const assert = require("node:assert");
require("../../js/games.js");
require("../../js/engine.js");
require("./game.js");
const { Engine, Games } = globalThis.Score;
const def = Games.get("pirates");

function makeGame(variants, names) {
  return Engine.newGame({ def, players: names || ["A", "B", "C"],
    variants: variants || {}, now: 1 });
}
function entry(game, patch) {
  const next = Engine.derive(game, def).next;
  assert.ok(next && next.type === "turn", "očekávám tah, hra už skončila?");
  Engine.addEntry(game, [{ playerId: next.playerId, roundIndex: next.roundIndex,
    value: null, special: null, flags: {}, ...patch }], 2);
  return next;
}
const turn = (g, value) => entry(g, { value });
const skullIsland = (g, skulls, pirateCard) =>
  entry(g, { special: "skullIsland", flags: { skulls, pirateCard: !!pirateCard } });
const shipFail = (g, penalty) => entry(g, { special: "shipFail", flags: { penalty } });

test("střídání hráčů v pořadí, roundIndex per hráč", () => {
  const g = makeGame();
  assert.strictEqual(turn(g, 300).playerId, "p1");
  assert.strictEqual(turn(g, 0).playerId, "p2");
  assert.strictEqual(turn(g, 500).playerId, "p3");
  const n4 = Engine.derive(g, def).next;
  assert.deepStrictEqual([n4.playerId, n4.roundIndex], ["p1", 1]);
});

test("ostrov lebek: pachatel 0, ostatní −100×N", () => {
  const g = makeGame();
  turn(g, 300); turn(g, 200);
  skullIsland(g, 6, false);           // p3
  const st = Engine.derive(g, def);
  assert.deepStrictEqual(st.totals, { p1: -300, p2: -400, p3: 0 });
  assert.ok(st.rounds[0].flags.p3.includes("skullIsland"));
  assert.ok(st.rounds[0].flags.p1.includes("skullVictim"));
});

test("ostrov lebek s kartou Pirát: −200×N", () => {
  const g = makeGame();
  skullIsland(g, 2, true);            // p1 hned na startu
  assert.deepStrictEqual(Engine.derive(g, def).totals, { p1: 0, p2: -400, p3: -400 });
});

test("dva ostrovy lebek ve stejném roundIndex se kumulují", () => {
  const g = makeGame();
  skullIsland(g, 5, false);           // p1
  skullIsland(g, 3, false);           // p2
  turn(g, 0);                         // p3
  const st = Engine.derive(g, def);
  assert.deepStrictEqual(st.totals, { p1: -300, p2: -500, p3: -800 });
});

test("pirátská loď — neúspěch: −penalizace", () => {
  const g = makeGame();
  turn(g, 0); shipFail(g, 500);       // p2
  assert.strictEqual(Engine.derive(g, def).totals.p2, -500);
});

test("dosažení cíle spustí rozhodující kolo pro ostatní", () => {
  const g = makeGame({ targetScore: 1000 });
  turn(g, 1000);                       // p1 ≥ cíl
  const n = Engine.derive(g, def).next;
  assert.deepStrictEqual([n.playerId, !!n.note], ["p2", true]);
  turn(g, 0);                          // p2 poslední tah
  const n2 = Engine.derive(g, def).next;
  assert.strictEqual(n2.playerId, "p3");
  turn(g, 500);                        // p3 poslední tah
  const st = Engine.derive(g, def);
  assert.strictEqual(st.finished, true);
  assert.deepStrictEqual(st.winnerIds, ["p1"]);
});

test("v rozhodujícím kole lze triggera přeskočit — vyhrává nejvyšší ≥ cíl", () => {
  const g = makeGame({ targetScore: 1000 });
  turn(g, 1000); turn(g, 1200); turn(g, 0);
  const st = Engine.derive(g, def);
  assert.strictEqual(st.finished, true);
  assert.deepStrictEqual(st.winnerIds, ["p2"]);
});

test("stažení pod cíl ostrovem lebek → hra pokračuje, další ≥ cíl auto-vyhrává", () => {
  const g = makeGame({ targetScore: 1000 }, ["A", "B"]);
  turn(g, 1000);                       // p1 trigger
  skullIsland(g, 11, false);           // p2: sám 0, p1 −1100 → p1 = −100, nikdo ≥ cíl
  let st = Engine.derive(g, def);
  assert.strictEqual(st.finished, false);
  assert.strictEqual(st.next.note, null);      // zpět v normální fázi
  turn(g, 900);                        // p1: 800 — pod cílem, pokračuje se
  turn(g, 1000);                       // p2: 1000 ≥ cíl → auto-výhra bez rozhodujícího kola
  st = Engine.derive(g, def);
  assert.strictEqual(st.finished, true);
  assert.deepStrictEqual(st.winnerIds, ["p2"]);
});

test("obranný hod (skullIsland) stáhne všechny pod cíl → hra pokračuje, další ≥ cíl auto-vyhrává", () => {
  const g = makeGame({ targetScore: 1000, defenderReroll: true }, ["A", "B", "C"]);
  turn(g, 1000);                       // p1 trigger (1000)
  skullIsland(g, 15, false);           // p2 (fronta): p1 −1500 → −500, p3 −1500 → −1500, p2 0
  turn(g, 2500);                       // p3 (poslední ve frontě): −1500+2500 = 1000 ≥ cíl
  let st = Engine.derive(g, def);
  assert.strictEqual(st.finished, false);
  // p3 ≥ cíl a je nad triggerem (p1 = −500) → defenderReroll spouští obranu triggera
  assert.deepStrictEqual([st.next.playerId, st.next.note], ["p1", "Obranný hod!"]);
  skullIsland(g, 15, false);           // p1 obranný hod: p2 −1500 → −1500, p3 −1500 → −500; p1 sám beze změny (−500)
  st = Engine.derive(g, def);
  assert.strictEqual(st.finished, false, "po obraně nikdo ≥ cíl → hra pokračuje (ne rovnou konec)");
  assert.strictEqual(st.next.note, null, "zpět v normální fázi, žádné další rozhodující kolo/obrana");
  assert.deepStrictEqual(st.totals, { p1: -500, p2: -1500, p3: -500 });
  turn(g, 2000);                       // p2: −1500+2000 = 500, stále pod cílem
  st = Engine.derive(g, def);
  assert.strictEqual(st.finished, false);
  turn(g, 1600);                       // p3: −500+1600 = 1100 ≥ cíl → auto-výhra (decisiveHappened už bylo true)
  st = Engine.derive(g, def);
  assert.strictEqual(st.finished, true);
  assert.deepStrictEqual(st.winnerIds, ["p3"]);
});

test("fronta rozhodujícího kola: pokles triggera uprostřed fronty ji nezmění", () => {
  const g = makeGame({ targetScore: 1000 });
  turn(g, 1000);                       // p1 trigger, fronta = [p2, p3]
  skullIsland(g, 11, false);           // p2: sám 0, p1 i p3 −1100 → p1 pod cíl
  const st1 = Engine.derive(g, def);
  assert.strictEqual(st1.finished, false);
  assert.strictEqual(st1.next.playerId, "p3");
  assert.ok(st1.next.note != null);    // p3 je pořád ve frontě, dostane svůj poslední tah
  turn(g, 0);                          // p3 poslední tah fronty
  const st2 = Engine.derive(g, def);
  assert.strictEqual(st2.finished, false);
  assert.strictEqual(st2.next.note, null);   // nikdo ≥ cíl → zpět normální fáze
});

test("defenderReroll: přehozený trigger dostane obranný hod", () => {
  const g = makeGame({ targetScore: 1000, defenderReroll: true }, ["A", "B"]);
  turn(g, 1000);                       // p1 trigger
  turn(g, 1500);                       // p2 přehodil
  let st = Engine.derive(g, def);
  assert.strictEqual(st.finished, false);
  assert.deepStrictEqual([st.next.playerId, st.next.note], ["p1", "Obranný hod!"]);
  turn(g, 600);                        // p1: 1600 → obrana uspěla
  st = Engine.derive(g, def);
  assert.strictEqual(st.finished, true);
  assert.deepStrictEqual(st.winnerIds, ["p1"]);
});

test("defenderReroll: remíza na vrcholu obranu nespouští", () => {
  const g = makeGame({ targetScore: 1000, defenderReroll: true }, ["A", "B"]);
  turn(g, 1000);                       // p1 trigger
  turn(g, 1000);                       // p2 dorovnal — trigger je pořád (sdíleně) nejvyšší
  const st = Engine.derive(g, def);
  assert.strictEqual(st.finished, true);
  assert.strictEqual(st.tie, true);
  assert.deepStrictEqual(st.winnerIds, ["p1", "p2"]);
});

test("defenderReroll vypnutý (default): žádná obrana", () => {
  const g = makeGame({ targetScore: 1000 }, ["A", "B"]);
  turn(g, 1000); turn(g, 1500);
  const st = Engine.derive(g, def);
  assert.strictEqual(st.finished, true);
  assert.deepStrictEqual(st.winnerIds, ["p2"]);
});

test("validateInput: násobky 100, zápor i nula OK", () => {
  assert.strictEqual(def.validateInput(600, {}), null);
  assert.strictEqual(def.validateInput(-200, {}), null);
  assert.strictEqual(def.validateInput(0, {}), null);
  assert.ok(typeof def.validateInput(250, {}) === "string");
  assert.ok(typeof def.validateInput(1.5, {}) === "string");
});

test("scoreScale: cílové skóre z variant, typ reach", () => {
  assert.deepStrictEqual(def.scoreScale({ variants: { targetScore: 6000 } }),
    { max: 6000, kind: "reach" });
  assert.strictEqual(def.scoreScale({ variants: { targetScore: 8000 } }).max, 8000);
});

test("display: vlastní tah a penalizace lebek se rozepisují", () => {
  const g = makeGame();
  turn(g, 800);                 // p1 vlastní tah
  skullIsland(g, 6, false);     // p2: sám 0, ostatním −600
  const st = Engine.derive(g, def);
  assert.strictEqual(st.rounds[0].display.p1, "800-600");
  assert.strictEqual(st.rounds[0].display.p2, undefined);  // samotná 0 bez rozpisu
  assert.strictEqual(st.rounds[0].display.p3, undefined);  // jediná složka → prosté −600
});

"use strict";
const assert = require("node:assert");
require("../../js/games.js");
require("../../js/engine.js");
require("./game.js");
const { Engine, Games } = globalThis.Score;
const def = Games.get("pirates");

function makeGame(variants, names) {
  // Hráči jdou do newGame jako objekty {name, color}; pro pravidla je barva nepodstatná.
  return Engine.newGame({
    def,
    players: (names || ["A", "B", "C"]).map((name, i) => ({ name, color: "#c" + i })),
    variants: variants || {}, now: 1,
  });
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
const bust = (g) => entry(g, { special: "bust", flags: {} });
const pirateShip = (g, penalty) =>
  entry(g, { special: "pirateShip", flags: { penalty } });

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
  assert.strictEqual(st.rounds[0].flags.p1, undefined); // oběti ikonu nedostávají
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

test("definice: speciály Výbuch, Pirátská loď, Ostrov lebek — v tomto pořadí", () => {
  assert.deepStrictEqual(def.specialMoves.map((m) => m.id),
    ["bust", "pirateShip", "skullIsland"]);
  assert.deepStrictEqual(def.specialMoves.map((m) => m.label),
    ["Výbuch", "Pirátská loď", "Ostrov lebek"]);
  assert.deepStrictEqual(Object.keys(def.flagMeta).sort(),
    ["bust", "pirateShip", "skullIsland"], "všechny tři speciály mají vlajku v tabulce");
});

test("pirátská loď: penalizace volbou z −300/−500/−1000", () => {
  const ship = def.specialMoves.find((m) => m.id === "pirateShip");
  const penalty = ship.params.find((p) => p.id === "penalty");
  assert.strictEqual(penalty.type, "choice");
  assert.deepStrictEqual(penalty.options.map((o) => o.value), [300, 500, 1000]);
  assert.deepStrictEqual(penalty.options.map((o) => o.label), ["−300", "−500", "−1000"],
    "popisky s typografickým minusem U+2212");
});

test("ostrov lebek: počet lebek volbou 4–10 (8 kostek + až 2 lebky z karty)", () => {
  const island = def.specialMoves.find((m) => m.id === "skullIsland");
  const skulls = island.params.find((p) => p.id === "skulls");
  assert.strictEqual(skulls.type, "choice");
  assert.deepStrictEqual(skulls.options.map((o) => o.value), [4, 5, 6, 7, 8, 9, 10]);
  assert.strictEqual(island.params.find((p) => p.id === "pirateCard").type, "bool");
});

test("ostrov lebek: s kartou Pirát jde vybrat jen 4–8 lebek (bez karty lebek = jen 8 kostek)", () => {
  const island = def.specialMoves.find((m) => m.id === "skullIsland");
  const skulls = island.params.find((p) => p.id === "skulls");
  assert.strictEqual(skulls.optionDisabled(9, { pirateCard: true }), true);
  assert.strictEqual(skulls.optionDisabled(10, { pirateCard: true }), true);
  assert.strictEqual(skulls.optionDisabled(8, { pirateCard: true }), false);
  assert.strictEqual(skulls.optionDisabled(10, { pirateCard: false }), false);
});

test("pirátská loď (neúspěch): pachatel −penalizace, ostatních se netýká, tah se počítá", () => {
  const g = makeGame();
  turn(g, 300);                        // p1
  pirateShip(g, 500);                  // p2
  const st = Engine.derive(g, def);
  assert.deepStrictEqual(st.totals, { p1: 300, p2: -500, p3: 0 });
  assert.ok(st.rounds[0].flags.p2.includes("pirateShip"), "pachatel nese vlajku 🚢");
  assert.strictEqual(st.next.playerId, "p3", "rotace pokračuje dalším hráčem");
});

test("vybouchnutí: 0 bodů, tah se počítá a hraje další hráč", () => {
  const g = makeGame();
  turn(g, 300);
  bust(g);                            // p2
  const st = Engine.derive(g, def);
  assert.deepStrictEqual(st.totals, { p1: 300, p2: 0, p3: 0 });
  assert.ok(st.rounds[0].flags.p2.includes("bust"));
  assert.strictEqual(st.next.playerId, "p3");
});

test("vybouchnutí v rozhodujícím kole je platný poslední tah", () => {
  const g = makeGame({ targetScore: 1000 }, ["A", "B"]);
  turn(g, 1000);                       // p1 trigger
  bust(g);                             // p2 vybouchl v posledním tahu
  const st = Engine.derive(g, def);
  assert.strictEqual(st.finished, true);
  assert.deepStrictEqual(st.winnerIds, ["p1"]);
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
  assert.deepStrictEqual([st.next.playerId, st.next.note], ["p1", "Poslední výprava přehozeného vítěze!"]);
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
  assert.deepStrictEqual([st.next.playerId, st.next.note], ["p1", "Poslední výprava přehozeného vítěze!"]);
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

test("varianta defenderReroll: plnohodnotná varianta s nadpisem, ne „domácí varianta“", () => {
  const v = def.variants.find((x) => x.id === "defenderReroll");
  assert.strictEqual(v.type, "enum", "enum se dvěma možnostmi → v UI má vlastní nadpis");
  assert.deepStrictEqual(v.options.map((o) => o.value), [true, false]);
  assert.ok(!/domácí/i.test([v.label, v.help, ...v.options.map((o) => o.label)].join(" ")),
    "poslední výprava přehozeného vítěze je oficiální pravidlo Albi (rules/Ukončení hry.jpeg)");
  assert.strictEqual(v.default, false);
});

test("validateInput: nezáporné násobky 100 (zápory řeší režim Pirátská loď)", () => {
  assert.strictEqual(def.validateInput(600, {}), null);
  assert.strictEqual(def.validateInput(0, {}), null);
  assert.ok(typeof def.validateInput(-200, {}) === "string");
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

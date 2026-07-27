"use strict";
// UI regresní testy nad DOM stubem (tests/dom-stub.js) — kryjí chování UI
// domluvené s Honzou napříč sessions: layout vstupních panelů, přepínač režimů,
// focus, historii, medaile, setup hráčů. Pravidla her kryjí games/<slug>/test.js.
const assert = require("node:assert");
require("./dom-stub.js");
require("../js/games.js");
require("../js/engine.js");
require("../js/ui/dom.js");
require("../js/ui/home.js");
require("../js/ui/history.js");
require("../js/ui/game.js");
require("../js/ui/setup.js");
require("../games/cabo/game.js");
require("../games/pirates/game.js");
require("../games/scout/game.js");

const { Engine, Games, UI } = globalThis.Score;
const piratesDef = Games.get("pirates");
const caboDef = Games.get("cabo");

// Falešná DB nad Mapou — UI ji volá při čtení hry a zápisu tahu/kola.
const store = new Map();
globalThis.Score.DB = {
  async getGame(id) { return store.get(id) || null; },
  async putGame(game) { store.set(game.id, game); },
  async deleteGame(id) { store.delete(id); },
  async getMeta() { return null; },
  async putMeta() {},
  async allGames() { return [...store.values()]; },
};

const tick = () => new Promise((r) => setTimeout(r, 0));
const texts = (nodes) => nodes.map((n) => n.textContent);

function newStoredGame(def, names, variants) {
  const game = Engine.newGame({ def, players: names, variants: variants || {}, now: 1 });
  store.set(game.id, game);
  return game;
}

async function renderGameScreen(game) {
  const container = document.createElement("div");
  await UI.game.render(container, { gameId: game.id });
  await tick(); // odložený focus přes setTimeout
  return container;
}

function addTurn(game, def, patch) {
  const next = Engine.derive(game, def).next;
  Engine.addEntry(game, [{
    playerId: next.playerId, roundIndex: next.roundIndex,
    value: null, special: null, flags: {}, ...patch,
  }], 2);
}

// === Sekvenční panel (Piráti): přepínač režimů, layout, focus ===

test("UI sekvenční panel: přepínač režimů nahoře, Běžná hra default, speciál skrytý", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const toggle = c.querySelector(".mode-toggle");
  assert.ok(toggle, "panel má nahoře přepínač režimů");
  assert.deepStrictEqual(texts(toggle.querySelectorAll("button")),
    ["Běžná hra", "💀 Ostrov lebek", "💥 Vybouchnutí"]);
  const [normalBtn] = toggle.querySelectorAll("button");
  assert.ok(normalBtn.classList.contains("active"), "Běžná hra je default aktivní");
  assert.strictEqual(c.querySelector(".mode-form").hidden, false);
  assert.strictEqual(c.querySelector(".special-area").hidden, true);
});

test("UI sekvenční panel: ± a rychlá tlačítka na vlastním řádku POD inputem", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const rows = c.querySelector(".mode-form").querySelectorAll(".input-controls");
  assert.strictEqual(rows.length, 2, "input a tlačítka jsou ve dvou řadách");
  assert.deepStrictEqual(rows[0].children.map((n) => n.tagName), ["INPUT"],
    "první řada obsahuje jen input");
  assert.deepStrictEqual(texts(rows[1].querySelectorAll("button")),
    ["±", "+100", "+200", "+500", "+1000"], "druhá řada: ± a rychlá tlačítka");
});

test("UI sekvenční panel: hlavní input má po vykreslení focus", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  assert.strictEqual(document.activeElement, c.querySelector(".score-input-wide"));
});

test("UI režim Ostrov lebek: běžný formulář zmizí, parametry ano, žádné Zrušit", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const skullBtn = c.querySelector(".mode-toggle").querySelectorAll("button")[1];
  skullBtn.click();
  assert.strictEqual(c.querySelector(".mode-form").hidden, true);
  const special = c.querySelector(".special-area");
  assert.strictEqual(special.hidden, false);
  assert.deepStrictEqual(texts(special.querySelectorAll(".param-row")).map((t) => t.trim()),
    ["Počet lebek", "Karta Pirát (×2)"]);
  const btnTexts = texts(c.querySelector(".input-panel").querySelectorAll("button"));
  assert.ok(btnTexts.includes("Zapsat: Ostrov lebek"));
  assert.ok(!btnTexts.includes("Zrušit"), "tlačítko Zrušit už neexistuje");
});

test("UI režim Vybouchnutí: žádný input, jen Zapsat; zapíše special bust", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const bustBtn = c.querySelector(".mode-toggle").querySelectorAll("button")[2];
  bustBtn.click();
  const special = c.querySelector(".special-area");
  assert.strictEqual(special.querySelectorAll("input").length, 0,
    "režim Vybouchnutí nemá vůbec žádný input");
  const submit = special.querySelector("button");
  assert.strictEqual(submit.textContent, "Zapsat: Vybouchnutí");
  submit.click();
  await tick(); await tick();
  assert.strictEqual(game.log.length, 1);
  assert.strictEqual(game.log[0].special, "bust");
});

test("UI přepnutí zpět na Běžnou hru schová formulář speciálu", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const [normalBtn, skullBtn] = c.querySelector(".mode-toggle").querySelectorAll("button");
  skullBtn.click();
  normalBtn.click();
  assert.strictEqual(c.querySelector(".mode-form").hidden, false);
  assert.strictEqual(c.querySelector(".special-area").hidden, true);
  assert.ok(normalBtn.classList.contains("active"));
  assert.ok(!skullBtn.classList.contains("active"));
});

test("UI dvojklik na Zapsat tah zapíše jen jeden záznam (re-entrancy guard)", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  c.querySelector(".score-input-wide").value = "300";
  const confirm = c.querySelector(".btn-action");
  confirm.click();
  confirm.click(); // druhý klik bez čekání — musí ho zastavit busy guard
  await tick(); await tick();
  assert.strictEqual(game.log.length, 1, "zapsal se právě jeden tah");
});

test("UI undo předvyplní vrácený tah do inputu", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  addTurn(game, piratesDef, { value: 300 });
  const c = await renderGameScreen(game);
  const undoBtn = c.querySelector(".btn-undo");
  undoBtn.click();
  await tick(); await tick();
  assert.strictEqual(game.log.length, 0);
  assert.strictEqual(c.querySelector(".score-input-wide").value, "300",
    "vrácená hodnota je předvyplněná");
});

// === Tabulka kol ===

test("UI tabulka se nekreslí, dokud není zapsané ani jedno kolo", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  assert.strictEqual(c.querySelector("table"), null, "žádná tabulka, jen graf");
  assert.ok(c.querySelector(".scoreboard"), "graf tam je");
});

test("UI SCOUT (pevný počet kol): celá tabulka s očíslovanými řádky od začátku", async () => {
  const scoutDef = Games.get("scout");
  const game = newStoredGame(scoutDef, ["A", "B", "C"]);
  const c = await renderGameScreen(game);
  const table = c.querySelector("table");
  assert.ok(table, "tabulka je vykreslená hned od začátku");
  const roundCells = table.querySelector("tbody").querySelectorAll("td.col-round");
  assert.deepStrictEqual(texts(roundCells), ["1", "2", "3"],
    "3 hráči → 3 předem očíslovaná kola");
});

test("UI Ostrov lebek v tabulce: ☠️ jen v buňce pachatele, oběť bez ikony", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  addTurn(game, piratesDef, { value: 300 });                                  // Marky
  addTurn(game, piratesDef, { special: "skullIsland", flags: { skulls: 6, pirateCard: false } }); // Honza
  const c = await renderGameScreen(game);
  const cells = c.querySelector("tbody").querySelectorAll("td");
  const [, markyCell, honzaCell] = cells; // [číslo kola, Marky, Honza]
  assert.ok(honzaCell.textContent.includes("☠️"), "pachatel má ☠️");
  assert.ok(!markyCell.textContent.includes("☠️"), "oběť ikonu nemá");
  assert.ok(markyCell.textContent.includes("300−600"), "oběť má jen rozpis penalizace");
});

// === All-at-once panel (KABO): povinný volající, focus, starter badge ===

test("UI KABO: kolo bez označeného volajícího se nezapíše a ohlásí chybu", async () => {
  const game = newStoredGame(caboDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const inputs = c.querySelector(".input-panel").querySelectorAll(".score-input");
  inputs[0].value = "5";
  inputs[1].value = "10";
  c.querySelector(".btn-action").click();
  await tick();
  assert.strictEqual(game.log.length, 0, "nic se nezapsalo");
  const errors = texts(c.querySelector(".input-panel").querySelectorAll(".field-error"))
    .filter(Boolean);
  assert.ok(errors.some((t) => t.includes("Kabo")), "chyba říká, že chybí volající");
});

test("UI KABO: klik na řádek hráče i na tlačítko Kabo fokusuje jeho input", async () => {
  const game = newStoredGame(caboDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const rows = c.querySelector(".input-panel").querySelectorAll(".input-row");
  const honzaRow = rows[1];
  const honzaInput = honzaRow.querySelector(".score-input");
  const honzaName = honzaRow.querySelector(".input-player-name");
  honzaRow.dispatch("click", { target: honzaName });
  assert.strictEqual(document.activeElement, honzaInput, "klik na jméno fokusuje input");
  honzaRow.querySelector(".btn-flag-cabo").click();
  assert.strictEqual(document.activeElement, honzaInput, "klik na Kabo fokusuje input");
});

test("UI štítek „začíná“ jen u her s def.starter (SCOUT ano, KABO ne)", async () => {
  const scout = await renderGameScreen(newStoredGame(Games.get("scout"), ["A", "B"]));
  assert.ok(scout.querySelector(".starter-badge"), "SCOUT štítek má");
  const kabo = await renderGameScreen(newStoredGame(caboDef, ["A", "B"]));
  assert.strictEqual(kabo.querySelector(".starter-badge"), null, "KABO štítek nemá");
});

// === Historie ===

function finishedPiratesGame() {
  const game = Engine.newGame({ def: piratesDef, players: ["Marky", "Honza"],
    variants: { targetScore: 1000 }, now: 1 });
  addTurn(game, piratesDef, { value: 1000 });
  addTurn(game, piratesDef, { value: 0 });
  const state = Engine.derive(game, piratesDef);
  Engine.freeze(game, state, 2);
  return game;
}

test("UI historie: datum bez času", () => {
  const game = Engine.newGame({ def: piratesDef, players: ["A", "B"], variants: {}, now: 1 });
  game.lastPlayedAt = new Date(2026, 6, 28, 14, 35).getTime();
  const node = UI.historyList([game], "pirates", async () => {});
  const dateText = node.querySelector(".history-date").textContent;
  assert.ok(/2026/.test(dateText), "datum tam je");
  assert.ok(!/\d{1,2}[:.]\d{2}\s*$/.test(dateText) && !/14/.test(dateText),
    "čas (HH:mm) se nevypisuje: " + dateText);
});

test("UI historie: rozehraná hra = jména s průběžnými body, ikonová tlačítka", () => {
  const game = Engine.newGame({ def: piratesDef, players: ["Marky", "Honza"], variants: {}, now: 1 });
  addTurn(game, piratesDef, { value: 300 });
  const node = UI.historyList([game], "pirates", async () => {});
  assert.strictEqual(node.querySelector(".history-lead").textContent, "Marky 300 · Honza 0");
  assert.deepStrictEqual(texts(node.querySelector(".history-item").querySelectorAll("button")),
    ["✏️", "🗑"], "tlačítka jsou jen ikony bez textových labelů");
});

test("UI historie: dohraná hra = pořadí s odznaky a body (Piráti: 🏆 jen vítěz)", () => {
  const game = finishedPiratesGame();
  const node = UI.historyList([game], "pirates", async () => {});
  assert.strictEqual(node.querySelector(".history-lead").textContent,
    "🏆 Marky 1000 · Honza 0");
});

// === Odznaky pořadí (medaile / pohár / výbuch) ===

test("UI rankingBadges: podium hra dává 🥇🥈🥉, vybouchlí 💥 a šedý tón", () => {
  const game = Engine.newGame({ def: caboDef, players: ["A", "B", "C"], variants: {}, now: 1 });
  const ranking = [
    { playerId: "p1", name: "A", rank: 1, total: 40 },
    { playerId: "p2", name: "B", rank: 2, total: 80 },
    { playerId: "p3", name: "C", rank: 3, total: 120 }, // přes 100 → vybouchl
  ];
  const badges = UI.rankingBadges(caboDef, game, ranking);
  assert.deepStrictEqual(
    [badges.p1.icon, badges.p2.icon, badges.p3.icon], ["🥇", "🥈", "💥"]);
  assert.deepStrictEqual(
    [badges.p1.tone, badges.p2.tone, badges.p3.tone], ["gold", "silver", "busted"]);
});

test("UI rankingBadges: winnerOnly hra dává 🏆 jen vítězi, ostatní bez odznaku", () => {
  const game = Engine.newGame({ def: piratesDef, players: ["A", "B"], variants: {}, now: 1 });
  const ranking = [
    { playerId: "p1", name: "A", rank: 1, total: 6000 },
    { playerId: "p2", name: "B", rank: 2, total: 4000 },
  ];
  const badges = UI.rankingBadges(piratesDef, game, ranking);
  assert.deepStrictEqual([badges.p1.icon, badges.p2.icon], ["🏆", null]);
  assert.deepStrictEqual([badges.p1.tone, badges.p2.tone], ["gold", null]);
});

// === Zakládání hry ===

test("UI zakládání: + Přidat hráče fokusuje nově přidaný input", async () => {
  store.clear();
  const container = document.createElement("div");
  await UI.setup.render(container, { gameTypeId: "pirates" });
  container.querySelector(".btn-add-player").click();
  const inputs = container.querySelector(".player-chips").querySelectorAll("input");
  assert.strictEqual(inputs.length, 3, "min 2 hráči + 1 přidaný");
  assert.strictEqual(document.activeElement, inputs[inputs.length - 1],
    "nový input má hned focus");
});

test("UI zakládání: hráči předvyplnění z poslední hry stejného typu, tlačítko Začít hru", async () => {
  store.clear();
  const last = newStoredGame(piratesDef, ["Marky", "Honza", "Petr"]);
  last.lastPlayedAt = 99;
  const container = document.createElement("div");
  await UI.setup.render(container, { gameTypeId: "pirates" });
  const values = container.querySelector(".player-chips").querySelectorAll("input")
    .map((i) => i.value);
  assert.deepStrictEqual(values, ["Marky", "Honza", "Petr"]);
  const btns = texts(container.querySelectorAll("button"));
  assert.ok(btns.includes("Začít hru"), "tlačítko se jmenuje Začít hru");
  store.clear();
});

// === Hlavička stránky ===

test("UI hlavička: mimo homepage je vpravo Domů, na homepage není", () => {
  const dom = globalThis.Score.dom;
  const gameHeader = dom.pageHeader({ title: "Pirátské kostky", onBack: () => {} });
  assert.deepStrictEqual(texts(gameHeader.querySelectorAll("button")), ["← Zpět", "Domů"]);
  const homeHeader = dom.pageHeader({ title: "Score", home: true });
  assert.strictEqual(homeHeader.querySelectorAll("button").length, 0);
});

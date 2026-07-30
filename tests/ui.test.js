"use strict";
// UI regresní testy nad DOM stubem (tests/dom-stub.js) — kryjí chování UI
// domluvené s Honzou napříč sessions: layout vstupních panelů, přepínač režimů,
// focus, historii, medaile, setup hráčů. Pravidla her kryjí games/<slug>/test.js.
const assert = require("node:assert");
require("./dom-stub.js");
require("../public/js/games.js");
require("../public/js/engine.js");
require("../public/js/ui/dom.js");
require("../public/js/ui/home.js");
require("../public/js/ui/history.js");
require("../public/js/ui/game.js");
require("../public/js/ui/setup.js");
require("../public/games/cabo/game.js");
require("../public/games/pirates/game.js");
require("../public/games/scout/game.js");

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
  async setMeta() {},
  async allGames() { return [...store.values()]; },
};
// setup.js po odeslání přepíná obrazovku přes App.show — v testech stačí no-op.
globalThis.App = { show() {} };

const tick = () => new Promise((r) => setTimeout(r, 0));
const texts = (nodes) => nodes.map((n) => n.textContent);

// Hráči jdou do newGame vždy jako objekty {name, color} — testům stačí
// rozdat barvy z palety po pořadí (stejně jako to dělá zakládání hry).
const PALETTE = globalThis.Score.dom.PLAYER_COLORS;
const colored = (names) =>
  names.map((n, i) => (typeof n === "string" ? { name: n, color: PALETTE[i].value } : n));

function newStoredGame(def, names, variants) {
  const game = Engine.newGame({ def, players: colored(names), variants: variants || {}, now: 1 });
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
    ["Běžná hra", "Výbuch", "Pirátská loď", "Ostrov lebek"],
    "pořadí režimů dle dohody, bez ikon (ať se vejdou do jednoho řádku)");
  const [normalBtn] = toggle.querySelectorAll("button");
  assert.ok(normalBtn.classList.contains("active"), "Běžná hra je default aktivní");
  assert.strictEqual(c.querySelector(".mode-form").hidden, false);
  assert.strictEqual(c.querySelector(".special-area").hidden, true);
});

test("UI sekvenční panel: rychlá tlačítka jako nedělitelný blok v řádku s inputem", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const rows = c.querySelector(".mode-form").querySelectorAll(".input-controls");
  assert.strictEqual(rows.length, 1, "input i tlačítka sdílejí jeden wrapovací řádek");
  assert.deepStrictEqual(rows[0].children.map((n) => n.tagName), ["INPUT", "DIV"],
    "za inputem následuje jediný blok tlačítek (celý se buď vejde, nebo celý zalomí)");
  const group = rows[0].querySelector(".quick-group");
  assert.deepStrictEqual(texts(group.querySelectorAll("button")),
    ["0", "+100", "+200", "+500", "+1000"],
    "0 (vynulování) a rychlá tlačítka — žádné ± (zápory řeší Pirátská loď)");
  const input = c.querySelector(".score-input-wide");
  input.value = "700";
  group.querySelectorAll("button")[0].click();
  assert.strictEqual(input.value, "0", "tlačítko 0 vynuluje zadání");
  assert.strictEqual(document.activeElement, input, "focus se vrátí do inputu");
});

test("UI sekvenční panel: hlavní input má po vykreslení focus", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  assert.strictEqual(document.activeElement, c.querySelector(".score-input-wide"));
});

test("UI režim Ostrov lebek: lebky 4–10 tlačítky, karta Pirát, žádný textový input", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const skullBtn = c.querySelector(".mode-toggle").querySelectorAll("button")[3];
  skullBtn.click();
  assert.strictEqual(c.querySelector(".mode-form").hidden, true);
  const special = c.querySelector(".special-area");
  assert.strictEqual(special.hidden, false);
  const skullChoices = special.querySelector(".choice-group").querySelectorAll("button");
  assert.deepStrictEqual(texts(skullChoices), ["4", "5", "6", "7", "8", "9", "10"],
    "počet lebek se vybírá tlačítky (max 10 = 8 kostek + 2 z karty)");
  const inputs = special.querySelectorAll("input");
  assert.strictEqual(inputs.length, 1, "jediný input je checkbox karty Pirát");
  assert.strictEqual(inputs[0].getAttribute("type"), "checkbox");
  const boolRow = inputs[0].closest(".param-row");
  assert.strictEqual(boolRow.children[0], inputs[0],
    "checkbox je inline PŘED textem popisku, ne odstrčený na druhé straně");
  assert.ok(boolRow.textContent.includes("Karta Pirát"));
  const btnTexts = texts(c.querySelector(".input-panel").querySelectorAll("button"));
  assert.ok(!btnTexts.includes("Zrušit"), "tlačítko Zrušit už neexistuje");
  // výběr 6 lebek → zapíše special s flags.skulls = 6
  skullChoices[2].click();
  assert.ok(skullChoices[2].classList.contains("active"), "vybraná hodnota je zvýrazněná");
  special.querySelector(".btn-action").click();
  await tick(); await tick();
  assert.strictEqual(game.log.length, 1);
  assert.strictEqual(game.log[0].special, "skullIsland");
  assert.deepStrictEqual(game.log[0].flags, { skulls: 6, pirateCard: false });
});

test("UI Ostrov lebek: karta Pirát vypne 9 a 10 lebek a zruší jejich případný výběr", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  c.querySelector(".mode-toggle").querySelectorAll("button")[3].click();
  const special = c.querySelector(".special-area");
  const skulls = special.querySelector(".choice-group").querySelectorAll("button");
  const pirateCard = special.querySelectorAll("input")[0];
  skulls[5].click(); // výběr 9
  assert.ok(skulls[5].classList.contains("active"));
  pirateCard.checked = true;
  pirateCard.dispatch("change");
  assert.strictEqual(skulls[5].disabled, true, "9 je s kartou Pirát vypnutá");
  assert.strictEqual(skulls[6].disabled, true, "10 je s kartou Pirát vypnutá");
  assert.strictEqual(skulls[4].disabled, false, "8 zůstává dostupná");
  assert.ok(!skulls[5].classList.contains("active"), "neplatný výběr 9 se zrušil");
  special.querySelector(".btn-action").click();
  await tick(); await tick();
  assert.strictEqual(game.log.length, 0, "bez platného výběru se nic nezapíše");
  pirateCard.checked = false;
  pirateCard.dispatch("change");
  assert.strictEqual(skulls[6].disabled, false, "bez karty je 10 zase dostupná");
});

test("UI režim Výbuch: žádný input, jen Zapsat; zapíše special bust", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const bustBtn = c.querySelector(".mode-toggle").querySelectorAll("button")[1];
  bustBtn.click();
  const special = c.querySelector(".special-area");
  assert.strictEqual(special.querySelectorAll("input").length, 0,
    "režim Výbuch nemá vůbec žádný input");
  const submit = special.querySelector("button");
  assert.strictEqual(submit.textContent, "Zapsat tah",
    "sekvenční zápis má jednotné tlačítko Zapsat tah ve všech režimech");
  submit.click();
  await tick(); await tick();
  assert.strictEqual(game.log.length, 1);
  assert.strictEqual(game.log[0].special, "bust");
});

test("UI režim Pirátská loď: jen tlačítka −300/−500/−1000 a Zapsat", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const shipBtn = c.querySelector(".mode-toggle").querySelectorAll("button")[2];
  shipBtn.click();
  const special = c.querySelector(".special-area");
  const choices = special.querySelector(".choice-group").querySelectorAll("button");
  assert.deepStrictEqual(texts(choices), ["−300", "−500", "−1000"],
    "typografický minus U+2212, ne spojovník");
  assert.strictEqual(special.querySelectorAll("input").length, 0,
    "žádný textový input ani checkbox");
  assert.strictEqual(special.querySelector(".btn-action").textContent, "Zapsat tah",
    "jednotný text tlačítka pro zápis tahu");
  choices[1].click();
  special.querySelector(".btn-action").click();
  await tick(); await tick();
  assert.strictEqual(game.log.length, 1);
  assert.strictEqual(game.log[0].special, "pirateShip");
  assert.deepStrictEqual(game.log[0].flags, { penalty: 500 });
});

test("UI Pirátská loď bez vybrané penalizace se nezapíše a ohlásí chybu", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  c.querySelector(".mode-toggle").querySelectorAll("button")[2].click();
  const special = c.querySelector(".special-area");
  special.querySelector(".btn-action").click();
  await tick(); await tick();
  assert.strictEqual(game.log.length, 0, "nic se nezapsalo");
  const errors = texts(special.querySelectorAll(".field-error")).filter(Boolean);
  assert.ok(errors.length > 0, "chyba o chybějícím výběru je vidět");
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

test("UI KABO (celá kola, bez pevného počtu): tabulka až po prvním zapsaném kole", async () => {
  const game = newStoredGame(caboDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  assert.strictEqual(c.querySelector("table"), null, "žádná tabulka, jen graf");
  assert.ok(c.querySelector(".scoreboard"), "graf tam je");
  Engine.addEntry(game, game.players.map((p, i) => ({
    playerId: p.id, roundIndex: 0, value: [5, 10][i], special: null,
    flags: i === 0 ? { cabo: true } : {},
  })), 2);
  const c2 = await renderGameScreen(game);
  const rows = c2.querySelector("tbody").querySelectorAll("tr");
  assert.strictEqual(rows.length, 1, "po prvním kole jediný řádek, žádný prázdný navíc");
  assert.strictEqual(c2.querySelector("tr.current-round"), null,
    "bez pevného počtu kol se aktuální řádek nevyznačuje");
});

test("UI Piráti (sekvenční): tabulka hned od začátku s prázdným řádkem a buňkou hráče na tahu", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const tbody = c.querySelector("tbody");
  assert.ok(tbody, "tabulka je vykreslená ještě před prvním tahem");
  const rows = tbody.querySelectorAll("tr");
  assert.strictEqual(rows.length, 1, "první (zatím prázdný) řádek");
  const cells = rows[0].querySelectorAll("td");
  assert.strictEqual(cells[0].textContent, "1");
  assert.deepStrictEqual(texts(cells).slice(1), ["", ""], "buňky hráčů jsou prázdné");
  assert.ok(cells[1].classList.contains("next-cell"), "buňka prvního hráče je zvýrazněná");
  assert.ok(cells[1].getAttribute("style").includes("--pc:" + PALETTE[0].value),
    "…a nese barvu hráče na tahu");
});

test("UI Piráti: po dohraném kole se objeví prázdný řádek dalšího kola se zvýrazněním", async () => {
  const game = newStoredGame(piratesDef, ["Marky", "Honza"]);
  addTurn(game, piratesDef, { value: 300 });   // Marky
  addTurn(game, piratesDef, { value: 500 });   // Honza
  const c = await renderGameScreen(game);
  const rows = c.querySelector("tbody").querySelectorAll("tr");
  assert.strictEqual(rows.length, 2, "řádek odehraného kola + prázdný řádek právě hraného");
  const cells = rows[1].querySelectorAll("td");
  assert.deepStrictEqual(texts(cells).slice(1), ["", ""]);
  assert.ok(cells[1].classList.contains("next-cell"), "na tahu je zase první hráč");
});

test("UI SCOUT (pevný počet kol): právě hrané kolo je vyznačené na řádku", async () => {
  const scoutDef = Games.get("scout");
  const game = newStoredGame(scoutDef, ["A", "B", "C"]);
  const c = await renderGameScreen(game);
  const rows = c.querySelector("tbody").querySelectorAll("tr");
  assert.ok(rows[0].classList.contains("current-round"), "hraje se 1. kolo");
  assert.ok(!rows[1].classList.contains("current-round"));
  Engine.addEntry(game, game.players.map((p, i) => ({
    playerId: p.id, roundIndex: 0, value: [1, 2, 3][i], special: null, flags: {},
  })), 2);
  const c2 = await renderGameScreen(game);
  const rows2 = c2.querySelector("tbody").querySelectorAll("tr");
  assert.ok(!rows2[0].classList.contains("current-round"), "1. kolo už je odehrané");
  assert.ok(rows2[1].classList.contains("current-round"), "hraje se 2. kolo");
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

test("UI KABO řádek hráče: input + nedělitelný blok Kabo/Kamikaze + nedělitelný blok čísel", async () => {
  const game = newStoredGame(caboDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const row = c.querySelector(".input-panel").querySelectorAll(".input-row")[0];
  const controls = row.querySelector(".input-controls");
  assert.deepStrictEqual(controls.children.map((n) => [n.tagName, n.className]),
    [["INPUT", "score-input"], ["DIV", "special-group"], ["DIV", "quick-group"]],
    "pořadí: input, blok speciálů, blok rychlých čísel");
  assert.deepStrictEqual(texts(row.querySelector(".special-group").querySelectorAll("button")),
    ["📢 Kabo", "💣 Kamikaze"]);
  assert.deepStrictEqual(texts(row.querySelector(".quick-group").querySelectorAll("button")),
    ["0", "+1", "+2", "+5", "+10", "+20", "+50"]);
  const input = row.querySelector(".score-input");
  const qbtns = row.querySelector(".quick-group").querySelectorAll("button");
  qbtns[4].click(); // +10
  qbtns[3].click(); // +5
  assert.strictEqual(input.value, "15", "rychlá tlačítka přičítají do inputu hráče");
  qbtns[0].click();
  assert.strictEqual(input.value, "0", "0 vynuluje zadání");
});

test("UI KABO: aktivní Kamikaze deaktivuje i rychlá tlačítka všech hráčů", async () => {
  const game = newStoredGame(caboDef, ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const rows = c.querySelector(".input-panel").querySelectorAll(".input-row");
  const kamikazeBtn = rows[0].querySelector(".btn-move-kamikaze");
  kamikazeBtn.click();
  for (const row of rows) {
    for (const b of row.querySelector(".quick-group").querySelectorAll("button")) {
      assert.strictEqual(b.disabled, true, "rychlé tlačítko je při speciálu vypnuté");
    }
  }
  kamikazeBtn.click(); // deaktivace
  const qbtn = rows[1].querySelector(".quick-group").querySelectorAll("button")[1];
  assert.strictEqual(qbtn.disabled, false, "po zrušení speciálu zase fungují");
});

test("UI Cirkus řádek hráče: počítací tlačítka −5…+5 v pořadí dle hry, bez ±", async () => {
  const game = newStoredGame(Games.get("scout"), ["Marky", "Honza"]);
  const c = await renderGameScreen(game);
  const row = c.querySelector(".input-panel").querySelectorAll(".input-row")[0];
  assert.deepStrictEqual(texts(row.querySelector(".quick-group").querySelectorAll("button")),
    ["−5", "−2", "−1", "0", "+1", "+2", "+5"],
    "záporná tlačítka s typografickým minusem, 0 uprostřed dle pořadí v quickAmounts");
  assert.strictEqual(row.querySelector(".btn-sign"), null,
    "± je zbytečné — zápory pokrývají záporná počítací tlačítka");
  const input = row.querySelector(".score-input");
  const qbtns = row.querySelector(".quick-group").querySelectorAll("button");
  qbtns[0].click(); // −5
  qbtns[1].click(); // −2
  assert.strictEqual(input.value, "-7", "záporná tlačítka odečítají");
  qbtns[6].click(); // +5
  assert.strictEqual(input.value, "-2", "kladná přičítají i do záporného mezisoučtu");
  qbtns[3].click(); // 0
  assert.strictEqual(input.value, "0", "0 vynuluje zadání");
});

test("UI štítek „začíná“ jen u her s def.starter (SCOUT ano, KABO ne)", async () => {
  const scout = await renderGameScreen(newStoredGame(Games.get("scout"), ["A", "B"]));
  assert.ok(scout.querySelector(".starter-badge"), "SCOUT štítek má");
  const kabo = await renderGameScreen(newStoredGame(caboDef, ["A", "B"]));
  assert.strictEqual(kabo.querySelector(".starter-badge"), null, "KABO štítek nemá");
});

// === Historie ===

function finishedPiratesGame() {
  const game = Engine.newGame({ def: piratesDef, players: colored(["Marky", "Honza"]),
    variants: { targetScore: 1000 }, now: 1 });
  addTurn(game, piratesDef, { value: 1000 });
  addTurn(game, piratesDef, { value: 0 });
  const state = Engine.derive(game, piratesDef);
  Engine.freeze(game, state, 2);
  return game;
}

test("UI historie: datum bez času", () => {
  const game = Engine.newGame({ def: piratesDef, players: colored(["A", "B"]), variants: {}, now: 1 });
  game.lastPlayedAt = new Date(2026, 6, 28, 14, 35).getTime();
  const node = UI.historyList([game], "pirates", async () => {});
  const dateText = node.querySelector(".history-date").textContent;
  assert.ok(/2026/.test(dateText), "datum tam je");
  assert.ok(!/\d{1,2}[:.]\d{2}\s*$/.test(dateText) && !/14/.test(dateText),
    "čas (HH:mm) se nevypisuje: " + dateText);
});

test("UI historie: rozehraná hra = jména s průběžnými body, ikonová tlačítka", () => {
  const game = Engine.newGame({ def: piratesDef, players: colored(["Marky", "Honza"]), variants: {}, now: 1 });
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
  const game = Engine.newGame({ def: caboDef, players: colored(["A", "B", "C"]), variants: {}, now: 1 });
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
  const game = Engine.newGame({ def: piratesDef, players: colored(["A", "B"]), variants: {}, now: 1 });
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

// === Barvy hráčů (spec docs/specs/2026-07-28-barvy-hracu.md) ===

test("UI zakládání: hráči dostanou automaticky různé barvy z palety", async () => {
  store.clear();
  const container = document.createElement("div");
  await UI.setup.render(container, { gameTypeId: "pirates" });
  const dots = container.querySelector(".player-chips").querySelectorAll(".btn-color");
  assert.strictEqual(dots.length, 2, "každý hráč má barevný puntík");
  assert.ok(dots[0].getAttribute("style").includes(PALETTE[0].value), "1. hráč = 1. barva palety");
  assert.ok(dots[1].getAttribute("style").includes(PALETTE[1].value), "2. hráč = 2. barva palety");
  assert.ok(dots[0].getAttribute("aria-label"), "puntík má aria-label");
});

test("UI zakládání: barvy se dědí ze zdrojové hry spolu se jmény", async () => {
  store.clear();
  const last = Engine.newGame({ def: piratesDef, players: [
    { name: "Marky", color: PALETTE[5].value },
    { name: "Honza", color: PALETTE[0].value },
  ], variants: {}, now: 1 });
  store.set(last.id, last);
  const container = document.createElement("div");
  await UI.setup.render(container, { gameTypeId: "pirates" });
  const dots = container.querySelector(".player-chips").querySelectorAll(".btn-color");
  assert.ok(dots[0].getAttribute("style").includes(PALETTE[5].value), "Marky zdědil svou barvu");
  assert.ok(dots[1].getAttribute("style").includes(PALETTE[0].value), "Honza zdědil svou barvu");
  store.clear();
});

test("UI zakládání: nově přidaný hráč dostane první volnou barvu palety", async () => {
  store.clear();
  const last = Engine.newGame({ def: piratesDef, players: [
    { name: "Marky", color: PALETTE[5].value },
    { name: "Honza", color: PALETTE[0].value },
  ], variants: {}, now: 1 });
  store.set(last.id, last);
  const container = document.createElement("div");
  await UI.setup.render(container, { gameTypeId: "pirates" });
  container.querySelector(".btn-add-player").click();
  const dots = container.querySelector(".player-chips").querySelectorAll(".btn-color");
  assert.strictEqual(dots.length, 3);
  assert.ok(dots[2].getAttribute("style").includes(PALETTE[1].value),
    "PC[0] a PC[5] jsou obsazené → nový hráč dostane PC[1]");
  store.clear();
});

test("UI zakládání: klik na puntík otevře popover, výběr nastaví barvu a vrátí focus", async () => {
  store.clear();
  const container = document.createElement("div");
  await UI.setup.render(container, { gameTypeId: "pirates" });
  const chips = container.querySelector(".player-chips");
  assert.strictEqual(chips.querySelector(".color-popover"), null, "popover je zavřený");
  chips.querySelectorAll(".btn-color")[0].click();
  const popover = chips.querySelector(".color-popover");
  assert.ok(popover, "klik na puntík otevřel popover");
  const swatches = popover.querySelectorAll(".color-swatch");
  assert.strictEqual(swatches.length, PALETTE.length, "popover nabízí celou paletu");
  assert.ok(swatches[0].classList.contains("selected"), "aktuální barva je označená");
  swatches[3].click();
  assert.strictEqual(chips.querySelector(".color-popover"), null, "výběr popover zavřel");
  const dot = chips.querySelectorAll(".btn-color")[0];
  assert.ok(dot.getAttribute("style").includes(PALETTE[3].value), "barva se změnila");
  assert.strictEqual(document.activeElement, dot, "focus se vrátil na puntík");
});

test("UI zakládání: Začít hru uloží hráče i s barvami do DB", async () => {
  store.clear();
  const container = document.createElement("div");
  await UI.setup.render(container, { gameTypeId: "pirates" });
  const inputs = container.querySelector(".player-chips").querySelectorAll("input");
  inputs[0].value = "Marky"; inputs[0].dispatch("input");
  inputs[1].value = "Honza"; inputs[1].dispatch("input");
  container.querySelector(".btn-start").click();
  await tick(); await tick();
  const game = [...store.values()][0];
  assert.ok(game, "hra se založila");
  assert.deepStrictEqual(game.players.map((p) => [p.name, p.color]),
    [["Marky", PALETTE[0].value], ["Honza", PALETTE[1].value]]);
  store.clear();
});

test("UI graf: sloupce nesou barvu hráče (--pc) během hry", async () => {
  const game = newStoredGame(piratesDef, [
    { name: "Marky", color: PALETTE[5].value },
    { name: "Honza", color: PALETTE[0].value },
  ]);
  const c = await renderGameScreen(game);
  const bars = c.querySelectorAll(".sb-bar");
  assert.ok(bars[0].getAttribute("style").includes("--pc:" + PALETTE[5].value));
  assert.ok(bars[1].getAttribute("style").includes("--pc:" + PALETTE[0].value));
});

test("UI graf: překročení hranice = sytější odstín barvy hráče, žádná zelená/červená", async () => {
  const game = newStoredGame(piratesDef, [
    { name: "Marky", color: PALETTE[5].value },
    { name: "Honza", color: PALETTE[0].value },
  ], { targetScore: 1000 });
  addTurn(game, piratesDef, { value: 1000 }); // Marky přes cíl, hra běží (rozhodující kolo)
  const c = await renderGameScreen(game);
  const bars = c.querySelectorAll(".sb-bar");
  assert.ok(!bars[0].className.includes("sb-win") && !bars[0].className.includes("sb-lost"),
    "signální zelená/červená už neexistuje");
  assert.ok(bars[0].getAttribute("style").includes("--pc:" + PALETTE[5].strong),
    "sloupec přes hranici má sytější odstín své barvy");
  assert.ok(bars[1].getAttribute("style").includes("--pc:" + PALETTE[0].value),
    "sloupec pod hranicí zůstává pastelový");
  const totals = c.querySelectorAll(".sb-total");
  assert.ok(!totals[0].className.includes("sb-total-win"),
    "ani součet se nebarví zeleně");
});

test("UI graf i tabulka: po dohrání se barvy hráčů nikde nekreslí", async () => {
  const game = Engine.newGame({ def: piratesDef, players: [
    { name: "Marky", color: PALETTE[5].value },
    { name: "Honza", color: PALETTE[0].value },
  ], variants: { targetScore: 1000 }, now: 1 });
  store.set(game.id, game);
  addTurn(game, piratesDef, { value: 1000 });
  addTurn(game, piratesDef, { value: 0 });
  const state = Engine.derive(game, piratesDef);
  Engine.freeze(game, state, 2);
  const c = await renderGameScreen(game);
  for (const bar of c.querySelectorAll(".sb-bar")) {
    assert.ok(!(bar.getAttribute("style") || "").includes("--pc"),
      "sloupec dohrané hry nemá barvu hráče");
  }
  for (const th of c.querySelector("thead").querySelectorAll("th")) {
    assert.ok(!(th.getAttribute("style") || "").includes("--pc"),
      "hlavička dohrané hry nemá barvu hráče");
  }
});

test("UI tabulka: jména v hlavičce podtržená barvou hráče", async () => {
  const game = newStoredGame(piratesDef, [
    { name: "Marky", color: PALETTE[5].value },
    { name: "Honza", color: PALETTE[0].value },
  ]);
  addTurn(game, piratesDef, { value: 300 });
  const c = await renderGameScreen(game);
  const ths = c.querySelector("thead").querySelectorAll("th");
  assert.ok(ths[1].classList.contains("pc"), "th hráče nese třídu pc");
  assert.ok(ths[1].getAttribute("style").includes("--pc:" + PALETTE[5].value));
  assert.ok(!ths[0].classList.contains("pc"), "sloupec čísel kol barvu nemá");
});

test("UI sekvenční banner: proužek v barvě hráče na tahu", async () => {
  const game = newStoredGame(piratesDef, [
    { name: "Marky", color: PALETTE[5].value },
    { name: "Honza", color: PALETTE[0].value },
  ]);
  const c = await renderGameScreen(game);
  const next = Engine.derive(game, piratesDef).next;
  const onTurn = game.players.find((p) => p.id === next.playerId);
  const banner = c.querySelector(".turn-banner");
  assert.ok(banner.classList.contains("pc"), "banner nese třídu pc");
  assert.ok(banner.getAttribute("style").includes("--pc:" + onTurn.color));
});

test("UI all-at-once panel: puntík barvy před jménem hráče", async () => {
  const game = newStoredGame(caboDef, [
    { name: "Marky", color: PALETTE[5].value },
    { name: "Honza", color: PALETTE[0].value },
  ]);
  const c = await renderGameScreen(game);
  const dots = c.querySelector(".input-panel").querySelectorAll(".pc-dot");
  assert.strictEqual(dots.length, 2, "každý řádek hráče má puntík");
  assert.ok(dots[0].getAttribute("style").includes(PALETTE[5].value));
});

test("UI dotyk: app.css zakazuje dvojťukový zoom (touch-action: manipulation)", () => {
  const fs = require("node:fs");
  const css = fs.readFileSync(require("node:path").join(__dirname, "../public/css/app.css"), "utf8");
  assert.ok(
    /html\s*\{[^}]*touch-action:\s*manipulation/.test(css),
    "html má mít touch-action: manipulation (jinak iPad při rychlém klikání na tlačítka zoomuje)"
  );
});

# Score — implementační plán MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postavit bezserverovou webovou appku pro zapisování a vyhodnocování skóre společenských her (CABO, Pirátské kostky, SCOUT) dle `docs/PRD.md`.

**Architecture:** Neutrální engine (append-only log syrových faktů v IndexedDB + dopočet odvozeného stavu za běhu) + hry jako self-registrující pluginy načtené přes `<script>`. UI je sada obrazovek renderovaných vanilla JS do jednoho kontejneru, bez routeru a bez buildu.

**Tech Stack:** čisté HTML + CSS + vanilla JS, IndexedDB (vlastní tenký promisový wrapper), testy logiky v Node (`node:assert`, vlastní mini-runner, žádné závislosti).

## Global Constraints

Platí pro každý úkol (zkopírováno z PRD/CLAUDE.md):

- **Bez serveru, bez buildu, bez závislostí, bez CDN.** Appka musí běžet dvojklikem na `index.html` z `file://`.
- **Žádné ES moduly v prohlížeči** (CORS na `file://`) — všechny soubory jsou klasické skripty, které se věší na `globalThis` (vzor v Úkolu 2).
- **Do DB jen syrová fakta** (kdo/kolo/hodnota/druh speciálního tahu/příznaky). Součty, půlení na 100, efekty speciálů, konec hry — vždy dopočet z logu. Výjimka: `frozenResult` u dohrané hry (zamrzlý snímek).
- **Schéma DB je aditivní** — pole se přidávají, nikdy nepřejmenovávají/neodebírají.
- **Sluggy MVP her jsou schválené:** `cabo`, `pirates`, `scout`. Novou hru bez domluvy s Honzou nepřidávat.
- **UI texty česky**, s korektní diakritikou. Identifikátory v kódu anglicky.
- Číselné vstupy: `inputmode="numeric"` (kde je potřeba mínus, `text` + `inputmode="numeric"` + pattern — ověřit na iOS, viz Úkol 15).
- Plná pravidla her: `rules/cabo.md`, `rules/pirates.md`, `rules/scout.md`. Při nejasnosti v bodování má pravidlový soubor přednost před tímto plánem.
- **Autocommit je zapnutý** — commit po každém dokončeném úkolu (kroky „Commit" jsou v úkolech).
- Testy logiky se spouští `node tests/run.js` a musí projít před každým commitem.

## Struktura souborů (cílový stav)

```
score/
  index.html            # kostra + <script> výčet všech JS souborů
  css/app.css           # veškeré styly (jeden soubor, sekce oddělené komentáři)
  js/db.js              # IndexedDB wrapper (Score.DB)
  js/games.js           # registr her + merge variant (Score.Games)
  js/engine.js          # log, odvozený stav, ranking (Score.Engine)
  js/ui/dom.js          # mikro-helpery pro tvorbu DOM (Score.dom)
  js/ui/home.js         # domovská obrazovka (dlaždice her)
  js/ui/hub.js          # rozcestník hry (pokračovat / nová / historie)
  js/ui/setup.js        # založení hry (hráči + varianty)
  js/ui/game.js         # herní obrazovka (tabulka + vstup + undo + konec)
  js/ui/history.js      # historie typu hry + detail
  js/app.js             # App.show(...) — přepínání obrazovek, start appky
  games/cabo.js         # plugin CABO
  games/pirates.js      # plugin Pirátské kostky
  games/scout.js        # plugin SCOUT
  tests/run.js          # mini test-runner (Node, bez závislostí)
  tests/games.test.js   # testy registru a merge variant
  tests/engine.test.js  # testy enginu
  tests/cabo.test.js    # testy pravidel CABO
  tests/pirates.test.js # testy pravidel Pirátů
  tests/scout.test.js   # testy pravidel SCOUTu
  tests/db.html         # manuální browser-harness pro IndexedDB wrapper
```

Odpovědnosti: `engine.js` neví nic o konkrétních hrách; `games/*.js` neví nic o DOM a DB; `ui/*.js` neví nic o IndexedDB API (jen volá `Score.DB`); `app.js` jen přepíná obrazovky.

## Klíčové datové tvary (závazné pro všechny úkoly)

**Záznam hry v DB** (store `games`, keyPath `id`) — dle PRD §5, s jedním aditivním polem navíc (`entryId` v log záznamech, kvůli undo po celcích):

```jsonc
{
  "id": "uuid",
  "gameTypeId": "cabo",
  "rulesVersion": 1,
  "schemaVersion": 1,
  "status": "in_progress",       // | "finished"
  "label": null,
  "createdAt": 0, "endedAt": null, "lastPlayedAt": 0,
  "variants": { "caboPenalty": 10 },
  "players": [ { "id": "p1", "name": "Pepa", "order": 0 } ],
  "log": [
    { "seq": 0, "entryId": 0, "roundIndex": 0, "playerId": "p1",
      "value": 12, "special": null, "flags": {}, "ts": 0 }
  ],
  "frozenResult": null
}
```

- `entryId`: všechny záznamy vložené jedním potvrzením sdílejí `entryId`; **undo = smazání všech záznamů s nejvyšším `entryId`**. U `allPlayersAtOnce` je jeden entry celé kolo, u `perPlayerSequential` jeden hráč — přesně granularita undo z PRD §3.3.
- `roundIndex`: u `allPlayersAtOnce` číslo kola; u `perPlayerSequential` = kolikátý tah daného hráče to je (jeho osobní počítadlo) — díky tomu rozhodující kolo u Pirátů nerozbije řádkování tabulky.
- `value`: `null` u záznamů, kde skóre plyne jen ze speciálu (kamikaze, ostrov lebek).

**Store `meta`** (keyPath `key`): `{ key: "schemaVersion", value: 1 }`, `{ key: "lastVariants", value: { "cabo": {...}, "pirates": {...} } }`.

**`frozenResult`** (vzniká při dohrání, jen ke čtení):

```jsonc
{
  "endedAt": 0,
  "ranking": [ { "playerId": "p1", "name": "Pepa", "total": 87, "rank": 1 } ],
  "winnerIds": ["p1"], "tie": false,
  "rounds": [ { "roundIndex": 0, "scores": {"p1": 12}, "flags": {"p1": ["cabo"]} } ],
  "totals": { "p1": 87 },
  "totalEvents": [ { "roundIndex": 3, "playerId": "p1", "type": "halved" } ]
}
```

**Definice hry (plugin API)** — objekt předaný do `Score.Games.register(def)`:

```js
{
  id, name, rulesVersion,
  accentColor,                 // CSS barva, např. '#c0392b'
  icon,                        // emoji, např. '🃏'
  playerRange: { min, max },
  endType: 'targetScore' | 'fixedRounds',
  winnerDirection: 'min' | 'max',
  inputModel: 'allPlayersAtOnce' | 'perPlayerSequential',
  variants: [ { id, label, help, type: 'enum'|'number'|'bool',
                options: [{value, label}],      // jen enum
                min, max, allowCustom,          // jen number
                default } ],
  rounds(playerCount),         // jen fixedRounds → počet kol
  starter(roundIndex, playerCount),  // index hráče (dle order), který kolo začíná; default () => 0
  validateInput(value, ctx),   // null = OK, jinak česká chybová hláška (string)
  specialMoves: [ { id, label, icon,
                    params: [ { id, label, type: 'number'|'bool' } ] } ],
  roundScores(records, ctx),   // → { scores: {pid: number}, flags: {pid: [string]} }
  transformTotals(totals, tctx), // volitelné; → { totals, events: [{playerId, type}] }
  isGameOver(core, ctx),       // → { finished: bool }
  nextTurn(core, ctx),         // jen perPlayerSequential; → { roundIndex, playerId, note } | null
  tiebreak(pidA, pidB, core, ctx), // volitelné; komparátor mezi shodnými (<0 = A lepší)
}
// ctx  = { game, def, variants, players }        (variants už po merge s defaulty)
// tctx = { roundIndex, memo, ...ctx }            (memo = {} sdílené přes kola jednoho výpočtu)
// core = { rounds, totals, totalEvents }         (viz Engine.derive níže)
```

---

### Task 1: Kostra aplikace a přepínání obrazovek

**Files:**
- Create: `index.html`
- Create: `css/app.css`
- Create: `js/ui/dom.js`
- Create: `js/app.js`

**Interfaces:**
- Produces: `Score.dom.el(tag, attrs, ...children)` → HTMLElement; `Score.dom.clear(node)`.
- Produces: `App.show(name, params)` — vyrenderuje obrazovku `name` voláním `Score.UI[name].render(container, params)`; `App.start()` — otevře DB a ukáže `home`.
- Produces: `index.html` s kontejnerem `<main id="app">` a výčtem všech `<script>` v pořadí: `db.js, games.js, engine.js, games/*.js, ui/dom.js, ui/*.js, app.js`.

- [ ] **Step 1: Napsat `index.html`**

```html
<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Score</title>
<link rel="stylesheet" href="css/app.css">
</head>
<body>
<main id="app"></main>
<script src="js/db.js"></script>
<script src="js/games.js"></script>
<script src="js/engine.js"></script>
<script src="games/cabo.js"></script>
<script src="games/pirates.js"></script>
<script src="games/scout.js"></script>
<script src="js/ui/dom.js"></script>
<script src="js/ui/home.js"></script>
<script src="js/ui/hub.js"></script>
<script src="js/ui/setup.js"></script>
<script src="js/ui/game.js"></script>
<script src="js/ui/history.js"></script>
<script src="js/app.js"></script>
</body>
</html>
```

Soubory `games/*.js` a `ui/*.js` zatím neexistují — prohlížeč chybějící skripty jen zaloguje jako 404, appka se nesmí složit (v `app.js` proto vše přes optional chaining `Score.UI?.[name]`). Alternativně je do `index.html` přidávat až v úkolu, který je vytváří — zvol druhou možnost, je čistší: **v tomto kroku zapiš jen `db.js`, `games.js`, `engine.js`, `ui/dom.js`, `app.js` a další řádky přidávej v příslušných úkolech.**

- [ ] **Step 2: Napsat `js/ui/dom.js`**

```js
(function (g) {
  "use strict";
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") node.className = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function")
        node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  g.Score = g.Score || {};
  g.Score.dom = { el, clear };
})(globalThis);
```

- [ ] **Step 3: Napsat `js/app.js`**

```js
(function (g) {
  "use strict";
  const App = {
    show(name, params) {
      const container = document.getElementById("app");
      g.Score.dom.clear(container);
      const screen = g.Score.UI && g.Score.UI[name];
      if (!screen) { container.textContent = "Obrazovka „" + name + "" neexistuje."; return; }
      screen.render(container, params || {});
    },
    async start() {
      await g.Score.DB.open();
      App.show("home");
    },
  };
  g.App = App;
  window.addEventListener("DOMContentLoaded", () => {
    App.start().catch((err) => {
      document.getElementById("app").textContent = "Chyba při startu: " + err.message;
    });
  });
})(globalThis);
```

Protože `Score.DB` vznikne až v Úkolu 4, dočasně na začátek `app.js` přidej stub: `g.Score.DB = g.Score.DB || { open: async () => {} };` — Úkol 4 stub odstraní.

- [ ] **Step 4: Založit `css/app.css` se základem**

```css
/* === Reset a základ === */
* { box-sizing: border-box; margin: 0; }
:root {
  --bg: #f7f6f3; --fg: #1a1a1a; --muted: #6b6b6b;
  --card: #ffffff; --line: #dcd9d2; --accent: #2f6f4f;
  --tap: 44px; /* minimální dotykový cíl */
}
body { background: var(--bg); color: var(--fg);
  font: 16px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; }
main#app { max-width: 1100px; margin: 0 auto; padding: 16px; }
button { min-height: var(--tap); font-size: 1rem; cursor: pointer; }
```

- [ ] **Step 5: Ověřit v prohlížeči**

Otevři `index.html` dvojklikem (file://). Očekávání: stránka se načte bez chyby v konzoli (kromě případných 404 na zatím neexistující skripty, pokud jsi je nechal ve výčtu) a zobrazí text „Obrazovka „home" neexistuje." — tzn. přepínač obrazovek funguje a čeká na UI úkoly.

- [ ] **Step 6: Commit**

```bash
git add index.html css/app.css js/ui/dom.js js/app.js
git commit -m "feat: kostra aplikace — index.html, přepínání obrazovek, DOM helpery"
```

---

### Task 2: Testovací harness (Node, bez závislostí)

**Files:**
- Create: `tests/run.js`
- Create: `tests/games.test.js` (zatím jen ukázkový test, naplní ho Úkol 3)

**Interfaces:**
- Produces: vzor modulu použitelného v prohlížeči i Node — IIFE nad `globalThis` (viz `dom.js` výše); v Node stačí `require("../js/games.js")` a pak číst `globalThis.Score.Games`.
- Produces: `test(name, fn)` globální funkce v test souborech; spuštění `node tests/run.js` vypíše výsledky a vrátí exit code 0/1.

- [ ] **Step 1: Napsat `tests/run.js`**

```js
"use strict";
const path = require("path");
const files = ["games.test.js", "engine.test.js", "cabo.test.js",
               "pirates.test.js", "scout.test.js"];
let passed = 0, failed = 0;
globalThis.test = function (name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (err) { failed++; console.error("  ✗ " + name + "\n    " + err.message); }
};
for (const f of files) {
  const p = path.join(__dirname, f);
  try { require.resolve(p); } catch { continue; }  // soubor ještě neexistuje → přeskočit
  console.log(f);
  require(p);
}
console.log(`\n${passed} prošlo, ${failed} selhalo`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Napsat failující ukázkový test `tests/games.test.js`**

```js
"use strict";
const assert = require("node:assert");
require("../js/games.js");
const { Games } = globalThis.Score;

test("registr existuje", () => {
  assert.ok(Games, "Score.Games má existovat");
});
```

- [ ] **Step 3: Spustit a ověřit, že selže**

Run: `node tests/run.js`
Expected: FAIL — `Cannot find module '../js/games.js'` (soubor vznikne v Úkolu 3). To potvrzuje, že runner testy opravdu vykonává.

- [ ] **Step 4: Commit**

```bash
git add tests/run.js tests/games.test.js
git commit -m "test: mini test-runner pro Node bez závislostí"
```

---

### Task 3: Registr her a merge variant (`js/games.js`)

**Files:**
- Create: `js/games.js`
- Modify: `tests/games.test.js`

**Interfaces:**
- Produces: `Score.Games.register(def)` — validuje povinná pole (`id`, `name`, `rulesVersion`, `playerRange`, `endType`, `winnerDirection`, `inputModel`, `variants`, `roundScores`, `isGameOver`), při chybě vyhodí `Error`; duplicitní `id` vyhodí `Error`.
- Produces: `Score.Games.get(id)` → def | `undefined`; `Score.Games.list()` → def[] v pořadí registrace.
- Produces: `Score.Games.defaultVariants(def)` → `{variantId: default}`.
- Produces: `Score.Games.mergeVariants(def, stored)` → objekt: defaulty přepsané hodnotami ze `stored`, **klíče, které def nezná, se ignorují**; `stored` může být `null`/`undefined`. Tohle je dopředná kompatibilita variant z PRD §5/§6b — používá ji engine (čtení staré hry) i setup formulář (předvyplnění z `lastVariants`).

- [ ] **Step 1: Rozšířit `tests/games.test.js` o skutečné testy**

```js
"use strict";
const assert = require("node:assert");
require("../js/games.js");
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
```

- [ ] **Step 2: Spustit testy, ověřit FAIL** (`Cannot find module '../js/games.js'`)

- [ ] **Step 3: Napsat `js/games.js`**

```js
(function (g) {
  "use strict";
  const REQUIRED = ["id", "name", "rulesVersion", "playerRange", "endType",
    "winnerDirection", "inputModel", "variants", "roundScores", "isGameOver"];
  const registry = new Map();
  const Games = {
    register(def) {
      for (const key of REQUIRED)
        if (def[key] === undefined) throw new Error("Definice hry: chybí pole " + key);
      if (registry.has(def.id)) throw new Error("Hra s id " + def.id + " už je registrovaná");
      registry.set(def.id, def);
    },
    get(id) { return registry.get(id); },
    list() { return [...registry.values()]; },
    defaultVariants(def) {
      const out = {};
      for (const v of def.variants) out[v.id] = v.default;
      return out;
    },
    mergeVariants(def, stored) {
      const out = Games.defaultVariants(def);
      for (const v of def.variants)
        if (stored && stored[v.id] !== undefined) out[v.id] = stored[v.id];
      return out;
    },
  };
  g.Score = g.Score || {};
  g.Score.Games = Games;
})(globalThis);
```

- [ ] **Step 4: Spustit testy, ověřit PASS** — `node tests/run.js`, 6 testů zelených.

- [ ] **Step 5: Commit**

```bash
git add js/games.js tests/games.test.js
git commit -m "feat: registr her a dopředně kompatibilní merge variant"
```

---

### Task 4: IndexedDB wrapper (`js/db.js`)

**Files:**
- Create: `js/db.js`
- Create: `tests/db.html`
- Modify: `js/app.js` (odstranit stub `Score.DB` z Úkolu 1)

**Interfaces:**
- Produces: `Score.DB.open()` → Promise; DB `score` verze 1, stores `games` (keyPath `id`) a `meta` (keyPath `key`). V `onupgradeneeded` stores vytvoří; upgrade logika je připravená na budoucí verze přepínačem podle `event.oldVersion` (aditivně, nikdy nemazat).
- Produces: `Score.DB.putGame(game)`, `Score.DB.getGame(id)`, `Score.DB.deleteGame(id)`, `Score.DB.allGames()` → Promise (allGames vrací pole, neřazené — řazení je věc UI).
- Produces: `Score.DB.getMeta(key)` → Promise hodnoty (`undefined` když chybí); `Score.DB.setMeta(key, value)`.

IndexedDB nejde rozumně testovat v Node bez závislostí → testem je manuální harness `tests/db.html` + používání appkou; logika nad daty (engine) je testovaná v Node plnohodnotně.

- [ ] **Step 1: Napsat `js/db.js`**

```js
(function (g) {
  "use strict";
  const DB_NAME = "score", DB_VERSION = 1;
  let db = null;
  function req(r) {
    return new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  function store(name, mode) {
    return db.transaction(name, mode).objectStore(name);
  }
  const DB = {
    async open() {
      if (db) return;
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = (ev) => {
        const d = r.result;
        if (ev.oldVersion < 1) {
          d.createObjectStore("games", { keyPath: "id" });
          d.createObjectStore("meta", { keyPath: "key" });
        }
        // budoucí verze: if (ev.oldVersion < 2) { ...aditivní změny... }
      };
      db = await req(r);
    },
    putGame(game) { return req(store("games", "readwrite").put(game)); },
    getGame(id) { return req(store("games", "readonly").get(id)); },
    deleteGame(id) { return req(store("games", "readwrite").delete(id)); },
    allGames() { return req(store("games", "readonly").getAll()); },
    async getMeta(key) {
      const row = await req(store("meta", "readonly").get(key));
      return row ? row.value : undefined;
    },
    setMeta(key, value) {
      return req(store("meta", "readwrite").put({ key, value }));
    },
  };
  g.Score = g.Score || {};
  g.Score.DB = DB;
})(globalThis);
```

- [ ] **Step 2: Odstranit stub z `js/app.js`** (řádek `g.Score.DB = g.Score.DB || ...`).

- [ ] **Step 3: Napsat `tests/db.html`** — samostatná stránka, která projede CRUD cyklus a vypíše ✓/✗:

```html
<!DOCTYPE html>
<html lang="cs"><head><meta charset="utf-8"><title>DB test</title></head>
<body><pre id="out"></pre>
<script src="../js/db.js"></script>
<script>
(async () => {
  const out = document.getElementById("out");
  const log = (m) => out.textContent += m + "\n";
  const assert = (cond, m) => { if (!cond) throw new Error(m); log("✓ " + m); };
  const DB = Score.DB;
  await DB.open();
  const id = "test-" + Math.random().toString(36).slice(2);
  await DB.putGame({ id, gameTypeId: "cabo", log: [] });
  assert((await DB.getGame(id)).gameTypeId === "cabo", "putGame + getGame");
  assert((await DB.allGames()).some((x) => x.id === id), "allGames obsahuje záznam");
  await DB.setMeta("lastVariants", { cabo: { caboPenalty: 5 } });
  assert((await DB.getMeta("lastVariants")).cabo.caboPenalty === 5, "setMeta + getMeta");
  assert((await DB.getMeta("neni")) === undefined, "getMeta chybějícího klíče → undefined");
  await DB.deleteGame(id);
  assert((await DB.getGame(id)) === undefined, "deleteGame");
  log("HOTOVO — vše prošlo");
})().catch((e) => document.getElementById("out").textContent += "✗ " + e.message);
</script></body></html>
```

- [ ] **Step 4: Ověřit v prohlížeči** — otevřít `tests/db.html` z `file://`, očekávat 5 ✓ a „HOTOVO". (Pozn.: pokud by prohlížeč blokoval IndexedDB na `file://` — starší Firefox — otestovat i v Chrome; cílové prohlížeče dle PRD §9.)

- [ ] **Step 5: Commit**

```bash
git add js/db.js js/app.js tests/db.html
git commit -m "feat: promisový IndexedDB wrapper (games + meta)"
```

---

### Task 5: Engine — log a odvozený stav (`js/engine.js`)

**Files:**
- Create: `js/engine.js`
- Create: `tests/engine.test.js`

**Interfaces:**
- Consumes: `Score.Games.mergeVariants(def, stored)` z Úkolu 3.
- Produces: `Score.Engine.newGame({ def, players, variants, now })` → záznam hry dle tvaru výše. `players` vstupuje jako pole jmen v herním pořadí; engine přidělí `id` (`"p1"`, `"p2"`, …) a `order`. `id` hry: `crypto.randomUUID()` s fallbackem na `"g" + now + náhodný sufix`.
- Produces: `Score.Engine.addEntry(game, records, now)` — `records` je pole `{ playerId, roundIndex, value, special, flags }`; engine doplní `seq` (pokračuje od max+1), společné `entryId` (max+1), `ts = now`, aktualizuje `lastPlayedAt = now`. Vrací `game`.
- Produces: `Score.Engine.undo(game)` → `true` pokud něco odebral (všechny záznamy s nejvyšším `entryId`), `false` na prázdném logu.
- Produces: `Score.Engine.derive(game, def)` → stav:

```js
{
  rounds: [ { roundIndex, records, scores: {pid: n}, flags: {pid: [..]} } ], // seřazené dle roundIndex
  totals: { pid: n },              // po aplikaci transformTotals
  totalEvents: [ { roundIndex, playerId, type } ],
  roundsPlanned,                   // number | null (fixedRounds → def.rounds(count))
  finished, endedNow: finished,
  ranking: [ { playerId, name, total, rank } ],  // jen pokud finished; sdílené ranky 1,1,3
  winnerIds: [..], tie: bool,                    // jen pokud finished
  next: null | { type: "round", roundIndex, starterIndex }        // allPlayersAtOnce
             | { type: "turn", roundIndex, playerId, note },      // perPlayerSequential
}
```

Postup výpočtu v `derive`: (1) `variants = Games.mergeVariants(def, game.variants)`; (2) log seřadit dle `seq`, seskupit dle `roundIndex`; (3) na každé kolo `def.roundScores(records, ctx)`; (4) kumulativní totals v pořadí kol, po každém kole volitelný `def.transformTotals(totals, {roundIndex, memo, ...ctx})` (memo je `{}` sdílené přes celý výpočet); (5) `def.isGameOver(core, ctx)`; (6) při konci ranking: seřadit dle `winnerDirection`, shodné totals rozřadit přes `def.tiebreak` (pokud existuje a vrátí nenulu), jinak sdílený rank (competition ranking 1,1,3) a `tie=true` pokud rank 1 sdílí víc hráčů; (7) `next`: pro `allPlayersAtOnce` `{type:"round", roundIndex: rounds.length, starterIndex: def.starter?.(rounds.length, players.length) ?? 0}` (u `fixedRounds` jen dokud `rounds.length < roundsPlanned`), pro `perPlayerSequential` výsledek `def.nextTurn(core, ctx)`; při `finished` vždy `next = null`.

Důležité: `roundScores` může vracet skóre i pro hráče bez záznamu v kole (efekty speciálů přes hráče — ostrov lebek). Kolo bez záznamu hráče a bez efektu má v `scores` pro daného hráče `undefined` a v tabulce prázdnou buňku; do totals se nepřičítá nic.

- [ ] **Step 1: Napsat testy `tests/engine.test.js`**

```js
"use strict";
const assert = require("node:assert");
require("../js/games.js");
require("../js/engine.js");
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

function makeGame(variants) {
  return Engine.newGame({ def: TestDef, players: ["A", "B"], variants: variants || {}, now: 1000 });
}
function round(game, values, now) {
  const roundIndex = new Set(game.log.map((r) => r.roundIndex)).size;
  Engine.addEntry(game, game.players.map((p, i) =>
    ({ playerId: p.id, roundIndex, value: values[i], special: null, flags: {} })), now || 2000);
}

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

test("variants: merge s defaulty (starší hra bez klíče)", () => {
  const game = makeGame();       // variants {} → target spadne na default 30
  round(game, [30, 0]);
  assert.strictEqual(Engine.derive(game, TestDef).finished, true);
});
```

- [ ] **Step 2: Spustit testy, ověřit FAIL** (`Cannot find module '../js/engine.js'`).

- [ ] **Step 3: Implementovat `js/engine.js`** — IIFE vzor jako výše, `Score.Engine = { newGame, addEntry, undo, derive }` přesně podle rozhraní a postupu výpočtu popsaného v hlavičce úkolu. Dílčí body implementace:
  - `newGame` vrací i `rulesVersion: def.rulesVersion`, `endedAt: null`, `label: null`, `variants` uloží **tak, jak přišly** (bez merge — merge probíhá při čtení).
  - `derive` si na začátku spočítá `ctx = { game, def, variants: Games.mergeVariants(def, game.variants), players: game.players }`.
  - Ranking: hráče seřadit komparátorem `(a, b) => direction === "min" ? totals[a]-totals[b] : totals[b]-totals[a]`; při shodě zkusit `def.tiebreak(a, b, core, ctx)`; rank přidělovat competition-style: hráč dostane rank = index prvního hráče se stejným výsledkem (po tiebreaku) + 1.
  - Hráč bez jediného záznamu má total `0` (inicializovat totals nulami pro všechny hráče — u Pirátů může být první total záporný, nuly jsou nutný základ).

- [ ] **Step 4: Spustit testy, ověřit PASS** — `node tests/run.js`, všech 10+6 testů zelených.

- [ ] **Step 5: Commit**

```bash
git add js/engine.js tests/engine.test.js
git commit -m "feat: engine — append-only log, undo po celcích, odvozený stav a ranking"
```

---

### Task 6: Plugin CABO (`games/cabo.js`)

**Files:**
- Create: `games/cabo.js`
- Create: `tests/cabo.test.js`
- Modify: `index.html` (přidat `<script src="games/cabo.js"></script>` za `engine.js`)

**Interfaces:**
- Consumes: `Score.Games.register`, tvary z Úkolu 5.
- Produces: registrovaná hra `cabo` s tímto chováním (zdroj pravdy `rules/cabo.md`):
  - `playerRange` 2–4, `endType` `targetScore`, `winnerDirection` `min`, `inputModel` `allPlayersAtOnce`, `accentColor` `#c0392b`, `icon` `"🃏"`.
  - `variants`: `caboPenalty` enum 10/5 (default 10); `zeroInRound` enum `callerOnly`/`lowest` (default `callerOnly`); `endRule` enum `atOrAbove100`/`over100` (default `atOrAbove100`); `scoreEntry` enum `manual`/`raw` (default `manual`).
  - Vstup kola: hodnota ≥ 0 (celé číslo) na hráče + příznak `flags.cabo` (max 1 hráč/kolo, vynucuje UI) + speciál `kamikaze` (max 1 hráč/kolo). Kamikaze záznam: `{ special: "kamikaze", value: null }`; ostatní hráči v kamikaze kole mají záznam s `value: null`.
  - `roundScores`:
    - kamikaze v kole → kamikaze hráč 0 (flag `kamikaze`), všichni ostatní +50 (flag `kamikazeVictim`); hodnoty ani volání Kabo bodově nehrají roli (Kabo flag zůstane vizuálně).
    - `scoreEntry=manual` → skóre = zapsaná hodnota; `flags.cabo` jen vizuální flag `cabo`.
    - `scoreEntry=raw` → hodnota = surový součet karet; volající s (sdíleně) nejnižším součtem → dle `zeroInRound`: `callerOnly` → volající 0, ostatní svůj součet; `lowest` → všichni hráči s nejnižším součtem 0, ostatní svůj součet; neúspěšný volající → součet + `caboPenalty` (flag `caboFail`); úspěšný volající flag `caboSuccess`.
  - `transformTotals`: total přesně 100 a hráč ještě nemá `memo.halved[pid]` → total 50, event `halved` (jednou za hru na hráče; platí v obou `endRule` variantách).
  - `isGameOver`: `atOrAbove100` → nějaký total ≥ 100 (po transformu); `over100` → nějaký total > 100.
  - `tiebreak`: nižší skóre v posledním kole vyhrává (`< 0` když A má v posledním odehraném kole méně).
  - `validateInput`: celé číslo ≥ 0, jinak `"Zadej celé číslo ≥ 0."`.

- [ ] **Step 1: Napsat testy `tests/cabo.test.js`** — helpery: `makeGame(variants, playerNames)` přes `Engine.newGame` s `Games.get("cabo")`; `caboRound(game, entries)` kde `entries = [{value, cabo, kamikaze}]` dle pořadí hráčů, sestaví records vč. `special`/`flags` a zavolá `Engine.addEntry`. Testy (každý s konkrétními čísly):

```js
"use strict";
const assert = require("node:assert");
require("../js/games.js");
require("../js/engine.js");
require("../games/cabo.js");
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
  assert.deepStrictEqual(st.totalEvents, [{ roundIndex: 1, playerId: "p1", type: "halved" }]);
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
```

- [ ] **Step 2: Spustit testy, ověřit FAIL.**

- [ ] **Step 3: Implementovat `games/cabo.js`** dle rozhraní v hlavičce úkolu. Kostra:

```js
(function (g) {
  "use strict";
  g.Score.Games.register({
    id: "cabo", name: "CABO", rulesVersion: 1,
    accentColor: "#c0392b", icon: "🃏",
    playerRange: { min: 2, max: 4 },
    endType: "targetScore", winnerDirection: "min",
    inputModel: "allPlayersAtOnce",
    variants: [
      { id: "caboPenalty", label: "Penalizace za neúspěšné „Kabo!"", type: "enum",
        options: [{ value: 10, label: "+10" }, { value: 5, label: "+5" }], default: 10,
        help: "Kolik bodů dostane volající, který nemá nejnižší součet." },
      { id: "zeroInRound", label: "Kdo dostává v kole 0", type: "enum",
        options: [{ value: "callerOnly", label: "Jen úspěšný volající" },
                  { value: "lowest", label: "Nejnižší hráč(i)" }], default: "callerOnly" },
      { id: "endRule", label: "Konec hry", type: "enum",
        options: [{ value: "atOrAbove100", label: "≥ 100 (první přesná 100 → 50)" },
                  { value: "over100", label: "Striktně přes 100" }], default: "atOrAbove100" },
      { id: "scoreEntry", label: "Zadávání bodů", type: "enum",
        options: [{ value: "manual", label: "Ručně (finální čísla)" },
                  { value: "raw", label: "Surové součty (appka dopočítá)" }], default: "manual" },
    ],
    validateInput(value) {
      return Number.isInteger(value) && value >= 0 ? null : "Zadej celé číslo ≥ 0.";
    },
    specialMoves: [{ id: "kamikaze", label: "Kamikaze", icon: "💥", params: [] }],
    roundScores(records, ctx) { /* dle specifikace v hlavičce úkolu */ },
    transformTotals(totals, tctx) { /* přesně 100 → 50, memo.halved[pid], event "halved" */ },
    isGameOver(core, ctx) {
      const limit = ctx.variants.endRule === "over100"
        ? (t) => t > 100 : (t) => t >= 100;
      return { finished: Object.values(core.totals).some(limit) };
    },
    tiebreak(a, b, core) {
      const last = core.rounds[core.rounds.length - 1];
      return (last.scores[a] ?? 0) - (last.scores[b] ?? 0);
    },
  });
})(globalThis);
```

`roundScores` napiš takto: (1) když v kole existuje záznam `special === "kamikaze"` → kamikaze hráč 0 + flag `kamikaze`, každý jiný hráč (dle `ctx.players`) +50 + flag `kamikazeVictim`, hráčům s `flags.cabo` přidej i flag `cabo`, návrat; (2) jinak `manual` → `scores[pid] = value`, flag `cabo` volajícímu; (3) jinak `raw` → najdi minimum hodnot; volající: pokud jeho hodnota == minimum → dle `zeroInRound` (viz testy), jinak `value + caboPenalty` + flag `caboFail`; `zeroInRound === "lowest"` navíc nuluje všechny hráče s minimem (flag `lowestZero`); ostatním `value`.

- [ ] **Step 4: Spustit testy, ověřit PASS** (14 nových testů).

- [ ] **Step 5: Přidat `<script src="games/cabo.js"></script>` do `index.html`.**

- [ ] **Step 6: Commit**

```bash
git add games/cabo.js tests/cabo.test.js index.html
git commit -m "feat: plugin CABO — varianty, kamikaze, 100→50, konec hry, tiebreak"
```

---

### Task 7: Plugin Pirátské kostky (`games/pirates.js`)

**Files:**
- Create: `games/pirates.js`
- Create: `tests/pirates.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: tvary z Úkolu 5.
- Produces: registrovaná hra `pirates` (zdroj pravdy `rules/pirates.md`):
  - `playerRange` 2–5, `endType` `targetScore`, `winnerDirection` `max`, `inputModel` `perPlayerSequential`, `accentColor` `#1d5c8f`, `icon` `"🏴‍☠️"`.
  - `variants`: `targetScore` number s předvolbami 5000/6000/8000 + `allowCustom: true`, default 6000, min 1000, krok 100; `defenderReroll` bool, default `false`.
  - Záznamy (vždy 1 hráč / entry; `roundIndex` = osobní počítadlo tahů hráče):
    - běžný tah: `{ value: n }` — násobek 100, může být záporný i 0;
    - `special: "skullIsland"`, `flags: { skulls: N, pirateCard: bool }`, `value: null` → hráč 0 (flag `skullIsland`), každý jiný hráč −100×N (s `pirateCard` −200×N), flag `skullVictim` (efekt se v tabulce zapisuje do řádku `roundIndex` pachatele);
    - `special: "shipFail"`, `flags: { penalty: n }`, `value: null` → hráč −penalty, flag `shipFail`.
  - `validateInput`: celé číslo, násobek 100 (i záporné, i 0), jinak `"Zadej násobek 100 (může být záporný)."`.
  - `nextTurn(core, ctx)` + `isGameOver(core, ctx)` — sdílená interní funkce `replay(ctx)` přehraje log záznam po záznamu (dle `seq`) a vede stavový automat:
    1. **Normální fáze:** hráči táhnou v pořadí `order` dokola. Jakmile má hráč po svém tahu total ≥ cíl → stane se `trigger` a začíná **rozhodující kolo**: fronta = všichni ostatní v pořadí sezení počínaje hráčem za triggerem.
    2. **Rozhodující kolo:** postupně odebírá frontu (každý přesně 1 tah). Pozor: total triggera může mezitím klesnout (ostrov lebek) — fronta se tím nemění.
    3. **Po rozhodujícím kole:** pokud má někdo total ≥ cíl → `defenderReroll=false`: **konec** (vítěz = nejvyšší total; musí ≥ cíl — hráči pod cílem nemohou vyhrát, ale ranking řadí všechny podle totalu); `defenderReroll=true`: pokud trigger už není (sdíleně) nejvyšší, dostane **1 obranný hod** navíc, pak konec.
    4. Pokud po rozhodujícím kole **nikdo** nemá ≥ cíl → hra pokračuje normální rotací (od hráče za posledním, kdo táhl) a **první**, kdo po svém tahu má total ≥ cíl, **okamžitě vyhrává** (bez dalšího rozhodujícího kola).
  - `nextTurn` vrací `{ roundIndex: početDosavadníchTahůHráče, playerId, note }`, kde `note` je česká hláška pro UI: `null` v normální fázi, `"Rozhodující kolo — poslední tah!"` ve frontě, `"Obranný hod!"` u obrany. Po konci `null`.
  - `isGameOver` vrací `{ finished }`; vítěze/ranking dělá engine (winnerDirection max, bez tiebreaku → sdílené pořadí). **Omezení:** vítězem smí být jen hráč ≥ cíl — zajištěno konstrukcí konce (hra končí jen když někdo ≥ cíl a ten je nutně nejvyšší... kromě rozhodujícího kola, kde nejvyšší může být pod cílem jen pokud nikdo není ≥ cíl — a pak hra nekončí). Není potřeba zvláštní zásah do rankingu.

- [ ] **Step 1: Napsat testy `tests/pirates.test.js`** — helper `turn(game, def, value)` si od `Engine.derive(...).next` vyžádá `{playerId, roundIndex}` a vloží entry; obdobně `skullIsland(game, def, skulls, pirateCard)` a `shipFail(game, def, penalty)`. Testy s konkrétními čísly (hráči A, B, C; cíl 6000, pokud test neurčí jinak):

```js
"use strict";
const assert = require("node:assert");
require("../js/games.js");
require("../js/engine.js");
require("../games/pirates.js");
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
```

- [ ] **Step 2: Spustit testy, ověřit FAIL.**

- [ ] **Step 3: Implementovat `games/pirates.js`.** Jádro je `replay(ctx)`:

```js
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
  const log = [...ctx.game.log].sort((a, b) => a.seq - b.seq);
  const expectPlayer = () => phase === "normal" ? order[cursor % order.length]
    : phase === "decisive" ? queue[0] : trigger;
  for (const rec of log) {
    applyRecord(totals, rec, order);          // value / skullIsland / shipFail
    turnsTaken[rec.playerId]++;
    if (phase === "normal") {
      cursor++;
      if (totals[rec.playerId] >= target) {
        trigger = rec.playerId; phase = "decisive";
        const i = order.indexOf(trigger);
        queue = order.slice(i + 1).concat(order.slice(0, i));
      }
    } else if (phase === "decisive") {
      queue.shift();
      if (queue.length === 0) {
        const anyAtTarget = order.some((id) => totals[id] >= target);
        if (!anyAtTarget) { phase = "normal"; trigger = null;
          cursor = order.indexOf(rec.playerId) + 1; }
        else if (variants.defenderReroll &&
                 order.some((id) => id !== trigger && totals[id] >= totals[trigger]))
          phase = "defense";
        else phase = "done";
      }
    } else if (phase === "defense") {
      phase = "done";
    }
    if (phase === "normal" && trigger === null &&
        wasEverDecisive(rec) /* viz níže */) { /* auto-win větev */ }
  }
  return { totals, turnsTaken, phase, expectPlayer, trigger };
}
```

Auto-výhru po návratu z rozhodujícího kola řeš příznakem `decisiveHappened = true` nastaveným při prvním vstupu do `decisive`; v normální fázi pak po každém tahu: `if (decisiveHappened && totals[rec.playerId] >= target) phase = "done";`. (Vlož tuto kontrolu do větve `phase === "normal"` před inkrement fáze — přesné pořadí podmínek ověří testy.) `nextTurn` vrací `phase === "done" ? null : { roundIndex: turnsTaken[pid], playerId: pid, note: ... }`; `isGameOver` vrací `{ finished: phase === "done" }`. `roundScores` (pro tabulku): pro každý záznam kola — `value` → skóre; `skullIsland` → 0 sobě + flag, `−100×skulls×(pirateCard?2:1)` každému jinému hráči (přičíst k případnému jeho skóre v tom kole) + flag `skullVictim`; `shipFail` → `−flags.penalty` + flag.

- [ ] **Step 4: Spustit testy, ověřit PASS** (11 nových testů). Zvláštní pozornost testu „stažení pod cíl" — pokud selže, ladit pořadí podmínek v automatu, ne testy.

- [ ] **Step 5: Přidat `<script src="games/pirates.js"></script>` do `index.html`; commit**

```bash
git add games/pirates.js tests/pirates.test.js index.html
git commit -m "feat: plugin Pirátské kostky — speciály a rozhodující kolo"
```

---

### Task 8: Plugin SCOUT (`games/scout.js`)

**Files:**
- Create: `games/scout.js`
- Create: `tests/scout.test.js`
- Modify: `index.html`

**Interfaces:**
- Produces: registrovaná hra `scout` (zdroj pravdy `rules/scout.md`): `playerRange` 2–5, `endType` `fixedRounds`, `rounds: (n) => n`, `winnerDirection` `max`, `inputModel` `allPlayersAtOnce`, `starter: (roundIndex, n) => roundIndex % n`, `accentColor` `#8e5c9e`, `icon` `"🎪"`, `variants: []`, `specialMoves: []`, `validateInput`: libovolné celé číslo (i záporné), jinak `"Zadej celé číslo."`; `roundScores`: identita (`scores[pid] = value`, bez flagů); `isGameOver`: `core.rounds.length >= ctx.def.rounds(ctx.players.length)`; bez `tiebreak` (sdílené pořadí).

- [ ] **Step 1: Napsat testy `tests/scout.test.js`** — helper `round(...)` jako v engine testech:

```js
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
```

- [ ] **Step 2: Spustit, ověřit FAIL; Step 3: Implementovat `games/scout.js`** (přímočará registrace dle rozhraní — žádná zvláštní logika); **Step 4: ověřit PASS.**

- [ ] **Step 5: Přidat `<script>` do `index.html`; commit**

```bash
git add games/scout.js tests/scout.test.js index.html
git commit -m "feat: plugin SCOUT — pevný počet kol a rotace startéra"
```

---

### Task 9: Domovská obrazovka a rozcestník hry

**Files:**
- Create: `js/ui/home.js`
- Create: `js/ui/hub.js`
- Modify: `index.html` (přidat oba `<script>`), `css/app.css`

**Interfaces:**
- Consumes: `Score.Games.list()`, `Score.DB.allGames()`, `App.show`, `Score.dom.el`.
- Produces: `Score.UI.home.render(container)` a `Score.UI.hub.render(container, { gameTypeId })`.
- Produces: helper `Score.UI.lastGameOf(games, gameTypeId)` → hra s nejvyšším `lastPlayedAt` daného typu | `null` (sdílí ho home i hub; definuj v `home.js`).

Chování dle PRD §3.0:
- **Home:** dlaždice registrovaných her (ikona, název, akcent přes CSS custom property `--accent`). Klik na dlaždici → `App.show("hub", { gameTypeId })`. Pokud je **poslední hra typu** (`lastGameOf`) `in_progress`, dlaždice má navíc tlačítko **„Pokračovat"** → `App.show("game", { gameId })` (klik nesmí probublat do kliku dlaždice — `event.stopPropagation()`).
- **Hub (rozcestník):** nadpis hry + tři akce: **„Pokračovat v poslední hře"** (jen pokud poslední hra typu je `in_progress`; jinak tlačítko vůbec nerenderovat), **„Nová hra"** → `App.show("setup", { gameTypeId })`, **„Historie"** → `App.show("history", { gameTypeId })`. Tlačítko „← Zpět" na home. Uveď i počet nedohraných her typu, např. „3 nedohrané hry" (odkazuje do historie).

- [ ] **Step 1: Implementovat `js/ui/home.js`** — `render` je `async`, načte `await DB.allGames()` jednou a předá do tvorby dlaždic. Kostra dlaždice:

```js
const tile = el("button", { class: "tile", style: "--accent:" + def.accentColor,
    onclick: () => g.App.show("hub", { gameTypeId: def.id }) },
  el("span", { class: "tile-icon" }, def.icon),
  el("span", { class: "tile-name" }, def.name),
  last && last.status === "in_progress"
    ? el("span", { class: "btn-continue", role: "button",
        onclick: (ev) => { ev.stopPropagation(); g.App.show("game", { gameId: last.id }); } },
        "Pokračovat")
    : null);
```

- [ ] **Step 2: Implementovat `js/ui/hub.js`** dle chování výše (tři velká tlačítka pod sebou).

- [ ] **Step 3: Styly** — `.tile` grid/flex, min. výška 88px, `border-left: 6px solid var(--accent)`; dlaždice pod sebou na mobilu, mřížka 3 sloupce od 700px.

- [ ] **Step 4: Manuální ověření** — otevřít `index.html`: vidím 3 dlaždice (CABO, Pirátské kostky, SCOUT); klik vede na rozcestník; „Pokračovat" se zatím nezobrazuje (DB prázdná); rozcestník má Nová hra / Historie a zpět. Konzole bez chyb.

- [ ] **Step 5: Commit**

```bash
git add js/ui/home.js js/ui/hub.js index.html css/app.css
git commit -m "feat: domovská obrazovka s dlaždicemi a rozcestník hry"
```

---

### Task 10: Založení hry — hráči a varianty

**Files:**
- Create: `js/ui/setup.js`
- Modify: `index.html`, `css/app.css`

**Interfaces:**
- Consumes: `Games.get/defaultVariants/mergeVariants`, `Engine.newGame`, `DB.putGame/getMeta/setMeta`, `App.show`.
- Produces: `Score.UI.setup.render(container, { gameTypeId })`.

Chování dle PRD §3.1 + §6b:
- Formulář jmen hráčů **v herním pořadí**: startovně `playerRange.min` textových polí, tlačítko „+ Přidat hráče" (skryté/disabled při dosažení `max`), u pole tlačítko „×" na odebrání (disabled při `min`). Šipky ↑/↓ pro změnu pořadí. Prázdná jména nevalidní; duplicitní jména povolena, ale doplnit číslem? Ne — jednodušší: duplicitní jméno je nevalidní s hláškou `"Jména hráčů se nesmí opakovat."`.
- Pod hráči **formulář variant** z `def.variants`: `enum` → `<select>` (nebo radio pro ≤3 možnosti), `bool` → checkbox, `number` s `allowCustom` → radio předvoleb + pole „vlastní" (`inputmode="numeric"`). Předvyplnění: `Games.mergeVariants(def, (await DB.getMeta("lastVariants") || {})[gameTypeId])`.
- Tlačítko **„Založit hru"**: validace (počet hráčů v `playerRange`, neprázdná unikátní jména, číselné varianty v mezích) → `Engine.newGame({def, players, variants, now: Date.now()})` → `DB.putGame` → aktualizace `lastVariants` (`DB.setMeta`) → `App.show("game", { gameId })`.

- [ ] **Step 1: Implementovat `js/ui/setup.js`** dle chování výše. Stav formuláře drž v lokálním poli `names = ["", ""]` a objektu `variantValues`; po každé změně překresli jen seznam hráčů (funkce `renderPlayers()`), varianty jsou statické inputy čtené až při submitu.

- [ ] **Step 2: Manuální ověření (CABO)** — z rozcestníku CABO → Nová hra: vidím 2 pole hráčů, „+ Přidat" funguje do 4, pak disabled; varianty ukazují defaulty (10, jen úspěšný volající, ≥ 100, ručně); založení s prázdným jménem vypíše hlášku; validní založení přejde na (zatím neexistující) obrazovku `game` → text „Obrazovka „game" neexistuje." — to je v tomto úkolu očekávaný stav.

- [ ] **Step 3: Manuální ověření (předvyplnění)** — založit CABO s penalizací 5, vrátit se (reload → home), znovu Nová hra CABO: formulář předvyplní 5. V devtools smazat DB (`indexedDB.deleteDatabase("score")`), reload: formulář zpět na defaultech.

- [ ] **Step 4: Manuální ověření (Piráti)** — Nová hra Pirátů: cíl 6000 předvolený, „vlastní" pole přijme 7000; obranný hod checkbox default vypnutý.

- [ ] **Step 5: Commit**

```bash
git add js/ui/setup.js index.html css/app.css
git commit -m "feat: založení hry — hráči v pořadí a formulář variant s předvyplněním"
```

---

### Task 11: Herní obrazovka — tabulka, vstup „všichni najednou", undo, speciály

**Files:**
- Create: `js/ui/game.js`
- Modify: `index.html`, `css/app.css`

**Interfaces:**
- Consumes: `DB.getGame/putGame`, `Games.get`, `Engine.derive/addEntry/undo`, `App.show`, `Score.dom.el`.
- Produces: `Score.UI.game.render(container, { gameId })` — celá herní obrazovka; interně `rerender()` po každé mutaci (načíst → mutovat → `DB.putGame` → překreslit).

Chování dle PRD §3.2–3.3 (v tomto úkolu jen `allPlayersAtOnce` — CABO, SCOUT; sekvenční model je Úkol 12, konec hry Úkol 13):
- **Layout:** `<header>` (název hry + label, tlačítko „← Domů" → home, „Zpět" = undo), `<section class="score-table">` vlevo, `<aside class="input-panel">` vpravo (responzivně pod sebou — Úkol 15).
- **Tabulka:** `<table>`; hlavička = jména hráčů (sloupce), první sloupec číslo kola. Řádek na každé odehrané kolo (`state.rounds`); u `fixedRounds` předvyplnit prázdné řádky do `roundsPlanned`. Poslední dva řádky `<tfoot>`: **Součet** (tučně, `state.totals`) a **Pořadí** (průběžné pořadí dle `winnerDirection` — spočítat i u neukončené hry stejným řazením bez tiebreaku; sdílená místa „1.–2."). Buňka kola: skóre + ikonky flagů (mapování flag → emoji + title: `cabo` 📢 „Volal Kabo", `caboFail` ❗ „Neúspěšné Kabo (+penalizace)", `caboSuccess` ✅, `kamikaze` 💥, `kamikazeVictim` ➕50, `halved` ➗ „Přesně 100 → 50" — z `totalEvents` do buňky daného kola, `skullIsland` ☠️, `skullVictim` ☠️➖, `shipFail` ⚓, `lowestZero` 0️⃣). Záporné hodnoty červeně (`.neg`).
- **Vstupní panel (allPlayersAtOnce):** nadpis „Kolo N" (`state.next.roundIndex + 1`), zvýrazněný startér kola (`starterIndex` — jen informativně, štítek „začíná"). Pro každého hráče řádek: jméno + `<input type="text" inputmode="numeric">` + u CABO toggle „📢 Kabo" (max jeden aktivní — přepínání rádiového typu, znovu-klik odznačí) + u her se speciály tlačítko speciálu (CABO „💥 Kamikaze": aktivace označí hráče, deaktivuje všechna číselná pole — hodnoty v kamikaze kole neplatí; znovu-klik zruší).
- **Potvrzení kola:** tlačítko „Zapsat kolo" — validace všech hodnot přes `def.validateInput` (hlášky pod polem, focus na první chybné; při aktivním kamikaze se hodnoty nevalidují a posílají `null`), sestavení records přesně dle tvarů z Úkolu 6/8, `Engine.addEntry`, `DB.putGame`, rerender; inputy se vyčistí, focus na první pole.
- **Undo:** tlačítko „Zpět" v headeru — `Engine.undo` + `DB.putGame` + rerender; disabled na prázdném logu. Opakované mačkání odebírá kola postupně (engine to už umí).
- Když je hra `finished` (nebo `state.finished`), vstupní panel nahradit výsledkem — v tomto úkolu stačí dočasný text „Konec hry" (plný výsledek Úkol 13).

- [ ] **Step 1: Implementovat render tabulky** (funkce `renderTable(state, game, def)` → element; čistá funkce bez DB přístupu).

- [ ] **Step 2: Implementovat vstupní panel all-at-once + potvrzení + undo** dle chování výše.

- [ ] **Step 3: Manuální ověření (SCOUT)** — založit SCOUT se 3 hráči: tabulka má předvyplněné 3 řádky; zapsat kolo `5, 3, -2` → řádek se naplní, součty sedí, −2 červeně, štítek „začíná" se posunul; „Zpět" kolo odebere.

- [ ] **Step 4: Manuální ověření (CABO)** — založit CABO: zapsat kolo s hodnotami a označeným „Kabo" u jednoho hráče → 📢 v buňce; kolo s Kamikaze → 0 a +50 dle testů, pole při aktivním kamikaze disabled; dovést hráče přes součet přesně 100 → v součtu 50 a ➗ v buňce; nevalidní vstup (−1, prázdné) ukáže hlášku a nezapíše.

- [ ] **Step 5: Commit**

```bash
git add js/ui/game.js index.html css/app.css
git commit -m "feat: herní obrazovka — tabulka, vstup celého kola, undo, speciály CABO"
```

---

### Task 12: Vstupní model „po jednom" (Piráti)

**Files:**
- Modify: `js/ui/game.js`, `css/app.css`

**Interfaces:**
- Consumes: `state.next` typu `turn` (`{ playerId, roundIndex, note }`) z Úkolu 7.
- Produces: v `js/ui/game.js` větev vstupního panelu pro `inputModel === "perPlayerSequential"`.

Chování dle PRD §3.2:
- Panel ukazuje **„Teď hraje: X"** (velkým písmem) + případnou `note` („Rozhodující kolo — poslední tah!", „Obranný hod!") jako výrazný banner.
- Jedno číselné pole (hodnota tahu, násobky 100 — validace přes `def.validateInput`) + tlačítko „Zapsat tah". Rychlá tlačítka `+100 +200 +500 +1000` přičítající do pole (usnadnění násobků 100).
- **Tlačítka speciálů** z `def.specialMoves` s parametry: „☠️ Ostrov lebek" → mini-formulář (počet lebek `number`, checkbox „karta Pirát ×2") → záznam `special: "skullIsland"`; „⚓ Pirátská loď — neúspěch" → pole penalizace → `special: "shipFail"`. Speciál nahrazuje běžnou hodnotu (odesílá `value: null`).
- Po zápisu panel automaticky vyzve dalšího hráče dle `state.next` (včetně logiky rozhodujícího kola — tu dodává plugin, UI ji jen zobrazuje).
- V tabulce zvýraznit buňku, kam přijde příští zápis (sloupec hráče na tahu, řádek `roundIndex`).

- [ ] **Step 1: Implementovat sekvenční panel** dle chování výše (rozvětvit v místě, kde Úkol 11 renderuje panel).

- [ ] **Step 2: Manuální ověření** — založit Piráty se 3 hráči, cíl nastavit vlastní 1000 (rychlý test): střídání hráčů sedí; Ostrov lebek 6 lebek → pachatel 0, ostatním −600 v tabulce; po dosažení 1000 banner „Rozhodující kolo" a výzvy jen zbylým dvěma; po jejich tazích „Konec hry" (dočasný text z Úkolu 11); undo vrací po jednotlivých tazích.

- [ ] **Step 3: Commit**

```bash
git add js/ui/game.js css/app.css
git commit -m "feat: sekvenční vstup po hráčích s rozhodujícím kolem Pirátů"
```

---

### Task 13: Konec hry — výsledek a archivace (`frozenResult`)

**Files:**
- Modify: `js/ui/game.js`
- Create/Modify: pomocná funkce `Score.Engine.freeze(game, state)` v `js/engine.js` + testy v `tests/engine.test.js`

**Interfaces:**
- Produces: `Score.Engine.freeze(game, state)` — nastaví `game.status = "finished"`, `game.endedAt = state === derive výstup → čas předá volající` (signatura: `freeze(game, state, now)`), `game.frozenResult = { endedAt: now, ranking, winnerIds, tie, rounds: state.rounds.map(({roundIndex, scores, flags}) => ({roundIndex, scores, flags})), totals, totalEvents }` (bez `records` — syrová fakta zůstávají v `log`). Vrací `game`.
- Produces: `Score.Engine.unfreeze(game)` — `status = "in_progress"`, `endedAt = null`, `frozenResult = null` (pro „Zpět" z výsledkové obrazovky).

Chování dle PRD §3.4 (+ rozhodnutí: výsledek jde vrátit undo-em, dokud uživatel neopustí obrazovku):
- Když `derive` vrátí `finished` a `game.status` je ještě `in_progress` → UI zavolá `Engine.freeze` + `DB.putGame` a zobrazí **výsledkový panel**: 🏆 vítěz (nebo „Remíza: A a B" při `tie`), tabulka pořadí (rank, jméno, total; sdílené ranky „1.–2."), tlačítka **„← Domů"** a **„Zpět (oprava zápisu)"** — to zavolá `Engine.unfreeze` + `Engine.undo` + `DB.putGame` a vrátí hru do zapisování.
- Otevření už dohrané hry (`status === "finished"`, např. z historie) ukáže tabulku z `frozenResult` (ne z derive!) + výsledkový panel **bez** tlačítka opravy — dohraná hra je jen ke čtení (PRD §3.5).

- [ ] **Step 1: Testy `freeze`/`unfreeze`** do `tests/engine.test.js`:

```js
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
```

- [ ] **Step 2: Spustit (FAIL) → implementovat → spustit (PASS).**

- [ ] **Step 3: Napojit do `js/ui/game.js`** dle chování výše (nahradit dočasný text „Konec hry" z Úkolu 11).

- [ ] **Step 4: Manuální ověření** — dohrát rychlou hru SCOUT (2 hráči, 2 kola): výsledkový panel s vítězem; „Zpět (oprava)" vrátí poslední kolo a hra pokračuje; dohrát znovu, odejít Domů, na dlaždici SCOUT už **není** „Pokračovat" (poslední hra je dohraná). Remíza: dohrát se shodou → „Remíza", sdílené pořadí.

- [ ] **Step 5: Commit**

```bash
git add js/engine.js js/ui/game.js tests/engine.test.js
git commit -m "feat: konec hry — výsledkový panel a zamrzlý snímek s možností opravy"
```

---

### Task 14: Historie typu hry

**Files:**
- Create: `js/ui/history.js`
- Modify: `index.html`, `css/app.css`

**Interfaces:**
- Consumes: `DB.allGames/getGame/putGame/deleteGame`, `Games.get`, `App.show`.
- Produces: `Score.UI.history.render(container, { gameTypeId })`.

Chování dle PRD §3.5:
- Seznam **všech her daného typu**, řazený **sestupně dle `lastPlayedAt`**. Položka: datum posledního hraní (`new Date(lastPlayedAt).toLocaleString("cs-CZ")`), `label` (pokud je) jinak jména hráčů, stav — badge „Nedohraná" / u dohrané výsledek („🏆 Pepa — 87"; při remíze „🏆 Remíza: A, B").
- Akce položky: **klik** → u `finished` `App.show("game", { gameId })` (Úkol 13 už umí read-only zobrazení z `frozenResult`); u `in_progress` → totéž, hra normálně pokračuje. Pokračování starší hry přirozeně aktualizuje `lastPlayedAt` při nejbližším zápisu (dělá `Engine.addEntry`) → přesune se nahoru a stane se „poslední hrou" pro Pokračovat (PRD §3.0). 
- **„🗑 Smazat"** → `confirm("Opravdu smazat tuto hru? Akce je nevratná.")` → `DB.deleteGame` + rerender.
- **„✏️ Přejmenovat"** → `prompt("Název / štítek hry:", game.label || "")` → uložit `label` (prázdný string → `null`) přes `DB.putGame`. (Nativní `confirm`/`prompt` stačí — bez buildu a bez vlastních dialogů; upgrade je mimo MVP.)
- Tlačítko „← Zpět" na hub.

- [ ] **Step 1: Implementovat `js/ui/history.js`** dle chování výše.

- [ ] **Step 2: Manuální ověření** — vytvořit 2 rozehrané + 1 dohranou hru CABO: seznam správně řazený (naposledy hraná nahoře); detail dohrané je jen ke čtení; pokračování starší nedohrané + zápis kola → přesun nahoru; přejmenování se ukazuje v seznamu; smazání po potvrzení zmizí; zrušení confirmu nemaže.

- [ ] **Step 3: Ověřit vazbu na home** — po dohrání poslední hry typu zmizí „Pokračovat" z dlaždice; po pokračování starší nedohrané se objeví.

- [ ] **Step 4: Commit**

```bash
git add js/ui/history.js index.html css/app.css
git commit -m "feat: historie her — řazení, pokračování, mazání, štítky"
```

---

### Task 15: Responzivita, mobilní vstup a vizuální doladění

**Files:**
- Modify: `css/app.css`, `js/ui/game.js` (drobnosti — atributy inputů), ostatní UI soubory jen třídami

**Interfaces:** žádná nová API; vizuální vrstva dle PRD §8b + WEB.md checklist.

- [ ] **Step 1: Layout herní obrazovky** — grid: od 900px `grid-template-columns: 1fr 360px` (tabulka | panel); pod 900px panel **nad** tabulkou (u stolu se hlavně zapisuje → panel první, `order`), tabulka scrolluje vodorovně v `overflow-x: auto` wrapperu, sloupec hráče min-width 64px.

- [ ] **Step 2: Mobilní vstup** — všechna číselná pole: `type="text" inputmode="numeric" autocomplete="off"`; u polí povolujících zápor `inputmode="numeric"` ponechat a přidat viditelné tlačítko `±` vedle pole (iOS numerická klávesnice nemá mínus — toggle znaménka je spolehlivější než spoléhat na klávesnici). Parsování vstupu: `parseInt(value, 10)` s odmítnutím `NaN` přes `validateInput`.

- [ ] **Step 3: Dotykové cíle a čitelnost** — všechny buttony min 44×44px; skóre v tabulce `font-variant-numeric: tabular-nums`, součtový řádek větším písmem (1.25rem, tučně); kontrast textu vůči pozadí min 4.5:1 (zkontrolovat akcentové barvy her na světlém pozadí).

- [ ] **Step 4: Akcenty a značky** — header herní obrazovky a aktivní prvky přebarvit přes `--accent` z `def.accentColor`; jednotný vzhled flag-ikonek (`.flag { font-size: .8em }`, `title` tooltip); remíza v pořadí označená „🤝"; `prefers-color-scheme: dark` — nice-to-have: pokud zbývá čas, jen přepnout proměnné `--bg/--fg/--card/--line`, jinak vynechat (PRD to nevyžaduje).

- [ ] **Step 5: Manuální ověření** — devtools responsive mód: iPhone SE šířka (375px) — vše ovladatelné palcem, žádný horizontální scroll stránky (jen tabulky); iPad šířka; desktop 1280px — dva sloupce. Na reálném mobilu (aspoň jednom): numerická klávesnice se otevírá, `±` funguje.

- [ ] **Step 6: Commit**

```bash
git add css/app.css js/ui/game.js
git commit -m "feat: responzivní layout, mobilní numerický vstup, vizuální doladění"
```

---

### Task 16: Závěrečná verifikace a dokumentace

**Files:**
- Modify: `CLAUDE.md` (sekce Stav), `docs/PLAN.md` (odškrtat)

- [ ] **Step 1: Spustit všechny testy** — `node tests/run.js` → vše zelené.

- [ ] **Step 2: E2E průchod CABO** (proti `rules/cabo.md`): hra 3 hráčů, průběh: běžná kola s voláním Kabo, jedno kamikaze kolo, jeden hráč přes přesnou 100 (→ 50), dohrání přes 100, kontrola vítěze (nejnižší) a tiebreaku při shodě; undo uprostřed hry; zavřít prohlížeč, otevřít znovu → hra je v historii a jde dohrát.

- [ ] **Step 3: E2E průchod Piráti** (proti `rules/pirates.md`): cíl 6000; ostrov lebek s kartou Pirát; neúspěšná loď; rozhodující kolo vč. varianty, kdy Ostrov lebek stáhne vedoucího pod cíl a hra pokračuje do auto-výhry; totéž jednou s `defenderReroll` zapnutým.

- [ ] **Step 4: E2E průchod SCOUT** (proti `rules/scout.md`): 4 hráči → 4 předvyplněná kola, rotace startéra, záporná kola, vítěz max.

- [ ] **Step 5: Trvanlivost dat** — s rozehranými hrami zavřít a znovu otevřít prohlížeč (ne jen tab): vše na místě. Simulace „aktualizace aplikace": libovolná kosmetická změna v JS souboru → reload → stará data čitelná.

- [ ] **Step 6: MVP checklist v PRD** — projít `docs/PRD.md` §8 bod po bodu a odškrtnout (`- [x]`); cokoli nesplněné = založit úkol, ne odškrtnout.

- [ ] **Step 7: Aktualizovat `CLAUDE.md`** — sekci „Stav" přepsat z „Fáze návrhu" na popis implementovaného stavu (jedna–dvě věty) + doplnit „Spuštění testů: `node tests/run.js`".

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md docs/PRD.md docs/PLAN.md
git commit -m "docs: MVP hotové — verifikace, checklist, aktualizace stavu"
```

---

## Mapování na MVP checklist PRD §8 (self-review pokrytí)

| Bod PRD §8 | Úkol |
|---|---|
| Kostra bez buildu, `file://` | 1 |
| IndexedDB wrapper + schéma | 4 |
| Registr her + `<script>` moduly | 3 |
| Domovská obrazovka + Pokračovat | 9 |
| Rozcestník hry | 9 |
| Zakládání hry + formulář variant | 10 |
| `lastVariants` + merge s defaulty | 3, 10 |
| Render tabulky + součty + pořadí | 11 |
| Vstup „všichni najednou" | 11 |
| Vstup „po jednom" | 12 |
| Num. klávesnice + responzivita | 15 |
| Undo opakovaně | 5, 11 |
| `playerRange` hlídání | 10 |
| Remíza / tiebreak | 5, 6 |
| Více nedohraných + návrat | 9, 14 |
| Historie (náhled, pokračování, mazání, štítek) | 14 |
| Speciální tahy tlačítky | 11, 12 |
| Detekce konce vč. rozhodujícího kola | 6, 7, 13 |
| Vizuální odlišení speciálů | 11, 15 |
| Archivace + zamrzlý snímek | 13 |
| Hry `cabo`, `pirates`, `scout` | 6, 7, 8 |

Rozhodnutí učiněná tímto plánem nad rámec PRD (all additive, k případné diskusi s Honzou):
1. **`entryId` v log záznamech** — nové aditivní pole kvůli undo po celcích (PRD §3.3 granularitu vyžaduje, pole pro ni definuje tento plán).
2. **`roundIndex` u Pirátů = osobní počítadlo tahů hráče** — řeší řádkování při přeskočení triggera v rozhodujícím kole.
3. **Výsledkovou obrazovku lze vrátit tlačítkem „Zpět (oprava zápisu)"** (unfreeze + undo) — pojistka proti překlepu v posledním zápisu; PRD archivaci popisuje bez opravy, tady je opravitelná jen do opuštění obrazovky.
4. **Kamikaze kolo ignoruje zapsané hodnoty ostatních** (flat +50 dle pravidel) a **kamikaze + cizí volání Kabo** se boduje jen kamikaze pravidlem (Kabo zůstává vizuální značka).
5. **Obranný hod (`defenderReroll=true`)**: trigger dostává právě jeden tah navíc, jen pokud po rozhodujícím kole není (sdíleně) nejvyšší; pak hra končí.

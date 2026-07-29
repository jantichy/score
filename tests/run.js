"use strict";
const fs = require("fs");
const path = require("path");

// Obecné testy enginu a UI + automaticky objevené testy her (games/<slug>/test.js).
const coreFiles = ["games.test.js", "engine.test.js", "ui.test.js"]
  .map((f) => path.join(__dirname, f));
const gamesDir = path.join(__dirname, "..", "public", "games");
const gameFiles = fs.readdirSync(gamesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => path.join(gamesDir, e.name, "test.js"))
  .filter((p) => fs.existsSync(p))
  .sort();

let passed = 0, failed = 0;
// test() jen sbírá do fronty; runner testy vykonává sám a await-uje async testy
// (UI testy čekají na odložený focus a async zápisy do DB).
const queue = [];
globalThis.test = function (name, fn) { queue.push({ name, fn }); };

(async () => {
  for (const p of coreFiles.concat(gameFiles)) {
    try { require.resolve(p); } catch { continue; }  // soubor ještě neexistuje → přeskočit
    console.log(path.relative(path.join(__dirname, ".."), p));
    require(p);
    for (const { name, fn } of queue.splice(0)) {
      try { await fn(); passed++; console.log("  ✓ " + name); }
      catch (err) { failed++; console.error("  ✗ " + name + "\n    " + err.message); }
    }
  }
  console.log(`\n${passed} prošlo, ${failed} selhalo`);
  process.exit(failed ? 1 : 0);
})();

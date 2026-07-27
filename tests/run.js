"use strict";
const fs = require("fs");
const path = require("path");

// Obecné testy enginu + automaticky objevené testy her (games/<slug>/test.js).
const coreFiles = ["games.test.js", "engine.test.js"]
  .map((f) => path.join(__dirname, f));
const gamesDir = path.join(__dirname, "..", "games");
const gameFiles = fs.readdirSync(gamesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => path.join(gamesDir, e.name, "test.js"))
  .filter((p) => fs.existsSync(p))
  .sort();

let passed = 0, failed = 0;
globalThis.test = function (name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (err) { failed++; console.error("  ✗ " + name + "\n    " + err.message); }
};
for (const p of coreFiles.concat(gameFiles)) {
  try { require.resolve(p); } catch { continue; }  // soubor ještě neexistuje → přeskočit
  console.log(path.relative(path.join(__dirname, ".."), p));
  require(p);
}
console.log(`\n${passed} prošlo, ${failed} selhalo`);
process.exit(failed ? 1 : 0);

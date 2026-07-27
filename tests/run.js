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

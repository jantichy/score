"use strict";
const assert = require("node:assert");
require("../js/games.js");
const { Games } = globalThis.Score;

test("registr existuje", () => {
  assert.ok(Games, "Score.Games má existovat");
});

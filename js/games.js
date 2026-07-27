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

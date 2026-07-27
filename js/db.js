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

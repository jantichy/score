"use strict";
// Regresní testy service workeru (public/sw.js) a jeho registrace
// (public/js/sw-register.js) — network-first s revalidací, viz
// docs/superpowers/specs/2026-07-30-service-worker-cache-design.md.
// Worker běží nad stubem `self`/`caches`/`fetch`; require je uvnitř helperů,
// aby chybějící soubor srazil jen tyhle testy, ne celý runner.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ORIGIN = "https://score.example";
const SW_PATH = path.join(__dirname, "..", "public", "sw.js");
const REGISTER_PATH = path.join(__dirname, "..", "public", "js", "sw-register.js");

// Načte sw.js nad čerstvými stuby a vrátí zachycené listenery + záznamy volání.
function loadSw({ cacheNames = [], cached = new Map(), network } = {}) {
  const listeners = {};
  const calls = { skipWaiting: 0, claim: 0, deleted: [], put: [], fetch: [] };

  globalThis.self = {
    addEventListener(type, fn) { listeners[type] = fn; },
    skipWaiting() { calls.skipWaiting++; },
    clients: { async claim() { calls.claim++; } },
    location: { origin: ORIGIN },
  };
  globalThis.caches = {
    async open() {
      return {
        async put(req, res) { calls.put.push([req, res]); cached.set(req.url, res); },
      };
    },
    async keys() { return cacheNames; },
    async delete(name) { calls.deleted.push(name); return true; },
    async match(req) { return cached.get(req.url); },
  };
  globalThis.fetch = async (req, opts) => {
    calls.fetch.push([req, opts]);
    if (!network) throw new Error("síť nedostupná");
    return network(req, opts);
  };

  delete require.cache[require.resolve(SW_PATH)];
  require(SW_PATH);
  return { listeners, calls };
}

// Simulace fetch události: vrátí promise předanou do respondWith (undefined,
// když worker požadavek nechal být).
function dispatchFetch(listeners, request) {
  let result;
  listeners.fetch({ request, respondWith(p) { result = p; } });
  return result;
}

const getRequest = (url) => ({ method: "GET", url });

test("SW install: skipWaiting — nový worker nečeká na zavření stránek", () => {
  const { listeners, calls } = loadSw();
  listeners.install({});
  assert.strictEqual(calls.skipWaiting, 1);
});

test("SW activate: promaže cizí cache, aktuální nechá, převezme klienty", async () => {
  // "score-v1" je jméno aktuální cache v sw.js — při zvednutí verze změnit i tady.
  const { listeners, calls } = loadSw({ cacheNames: ["score-v1", "score-v0"] });
  let settled;
  listeners.activate({ waitUntil(p) { settled = p; } });
  await settled;
  assert.deepStrictEqual(calls.deleted, ["score-v0"]);
  assert.strictEqual(calls.claim, 1);
});

test("SW fetch: síť OK → vrátí čerstvou odpověď, revaliduje a uloží klon do cache", async () => {
  const clone = { jsem: "klon" };
  const fresh = { ok: true, status: 200, clone: () => clone };
  const { listeners, calls } = loadSw({ network: () => fresh });
  const req = getRequest(ORIGIN + "/js/app.js");

  assert.strictEqual(await dispatchFetch(listeners, req), fresh);
  assert.deepStrictEqual(calls.fetch, [[req, { cache: "no-cache" }]],
    "revalidace: fetch s cache:'no-cache', ať se server ptá přes ETag/Last-Modified");
  assert.deepStrictEqual(calls.put, [[req, clone]]);
});

test("SW fetch: chybová odpověď (404) se vrátí, ale necachuje", async () => {
  const notFound = { ok: false, status: 404, clone: () => ({}) };
  const { listeners, calls } = loadSw({ network: () => notFound });

  const res = await dispatchFetch(listeners, getRequest(ORIGIN + "/neni.js"));
  assert.strictEqual(res, notFound);
  assert.deepStrictEqual(calls.put, []);
});

test("SW fetch: síť selže → obslouží z cache (offline režim)", async () => {
  const req = getRequest(ORIGIN + "/js/app.js");
  const cachedRes = { ok: true, z: "cache" };
  const { listeners } = loadSw({ cached: new Map([[req.url, cachedRes]]) });

  assert.strictEqual(await dispatchFetch(listeners, req), cachedRes);
});

test("SW fetch: síť selže a v cache nic → chyba se propaguje", async () => {
  const { listeners } = loadSw();
  await assert.rejects(
    () => dispatchFetch(listeners, getRequest(ORIGIN + "/js/app.js")),
    /síť nedostupná/);
});

test("SW fetch: ne-GET požadavky nechává být", () => {
  const { listeners, calls } = loadSw({ network: () => ({ ok: true }) });
  const result = dispatchFetch(listeners, { method: "POST", url: ORIGIN + "/x" });
  assert.strictEqual(result, undefined);
  assert.deepStrictEqual(calls.fetch, []);
});

test("SW fetch: cizí origin nechává být", () => {
  const { listeners, calls } = loadSw({ network: () => ({ ok: true }) });
  const result = dispatchFetch(listeners, getRequest("https://cdn.example/x.js"));
  assert.strictEqual(result, undefined);
  assert.deepStrictEqual(calls.fetch, []);
});

// --- Registrace (sw-register.js) -------------------------------------------

function loadRegister() {
  delete require.cache[require.resolve(REGISTER_PATH)];
  require(REGISTER_PATH);
  return globalThis.Score.sw;
}

test("registrace SW: jen mimo file:// a jen s podporou serviceWorker", () => {
  const sw = loadRegister();
  const container = {};
  assert.strictEqual(sw.shouldRegister({ serviceWorker: container, protocol: "https:" }), true);
  assert.strictEqual(sw.shouldRegister({ serviceWorker: container, protocol: "file:" }), false,
    "z disku dvojklikem se worker neregistruje");
  assert.strictEqual(sw.shouldRegister({ serviceWorker: undefined, protocol: "https:" }), false);
});

test("registrace SW: register volá serviceWorker.register('sw.js')", () => {
  const sw = loadRegister();
  const registered = [];
  const env = {
    protocol: "https:",
    serviceWorker: { register(url) { registered.push(url); return Promise.resolve(); } },
  };
  sw.register(env);
  assert.deepStrictEqual(registered, ["sw.js"]);
  sw.register({ ...env, protocol: "file:" });
  assert.deepStrictEqual(registered, ["sw.js"], "na file:// se register nevolá");
});

test("registrace SW: index.html načítá sw-register.js", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  assert.ok(html.includes('src="js/sw-register.js"'));
});

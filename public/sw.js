"use strict";
// Service worker: network-first s revalidací. Řeší zastaralou HTTP cache na
// hostingu bez zásahu do hlaviček serveru — každý požadavek se revaliduje
// (server vrátí 304, nebo nový obsah) a úspěšná odpověď se uloží pro offline.
// Žádný precache seznam: cache se plní za běhu, nová hra nevyžaduje úpravu.
// Viz docs/superpowers/specs/2026-07-30-service-worker-cache-design.md.

const CACHE_NAME = "score-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const fresh = await fetch(req, { cache: "no-cache" });
      if (fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});

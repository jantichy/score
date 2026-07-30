---
name: verify
description: Jak ověřit změny v aplikaci Score naživo (statický server + Chrome DevTools MCP)
---

# Ověřování aplikace Score naživo

Aplikace je čisté HTML/JS bez buildu — stačí statický server nad `public/`:

```bash
cd public && python3 -m http.server 8765   # na pozadí
```

Pak Chrome DevTools MCP: `new_page` na `http://localhost:8765/index.html`,
`evaluate_script` pro kontrolu stavu (`document.querySelector("#app")`,
`navigator.serviceWorker`, `caches`), `take_screenshot` pro důkaz.
Druhá plocha: `file:///…/public/index.html` — spuštění z disku musí vždy fungovat.

## Gotchas

- `new_page`/`navigate_page` občas ohlásí „Navigation timeout“, i když se
  stránka v pořádku načetla — ověř přes seznam Pages / `evaluate_script`.
- **Service worker (public/sw.js):** při testování aktualizací souborů nedělej
  reload stejného tabu — Chrome memory cache umí obsloužit `<script>` požadavky
  mimo service worker a ukáže starý obsah. Reálný scénář = **nový tab**
  (čerstvá navigace), tam revalidace přes SW proběhne.
- První načtení po registraci SW ještě neplní cache (stránka není controlled);
  cache `score-v1` se naplní až dalším načtením.
- Offline test: zabít server (`lsof -ti :8765 | xargs kill`) a otevřít nový
  tab — appka se musí načíst z cache workeru.
- Na `file://` je v konzoli preexistující chyba „Unsafe attempt to load URL …
  unique security origins“ (artefakt Chrome, nesouvisí s kódem).

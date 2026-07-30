# Service worker — spolehlivá aktualizace aplikace na hostingu

**Datum:** 2026-07-30
**Stav:** schváleno Honzou (návrh odsouhlasen v konverzaci)

## Problém

Aplikace je nahraná na hostingu (HTTPS) a otevíraná z iPadu. Safari drží JS/CSS
v HTTP cache podle heuristiky klidně dny — po nahrání nové verze na FTP iPad
dál běží na starých souborech.

Omezení řešení:

- Bez zásahu do serverové konfigurace (žádné `.htaccess` / HTTP hlavičky).
- Deploy zůstává ruční kopírování přes FTP — žádný build krok, žádné ruční
  číslování verzí.
- Spouštění z disku přes `file://` (dvojklik na `public/index.html`) musí
  zůstat beze změny funkční.

## Zvolené řešení

Service worker se strategií **network-first s revalidací**. Zvažované
alternativy (loader s časovým razítkem v URL, ruční `?v=N` verzování) byly
zamítnuty: první úplně obětuje cache a offline, druhá vyžaduje ruční krok při
každém deployi a nespolehlivě řeší cache samotného `index.html`.

### Soubory

- `public/sw.js` — nový soubor, service worker (~40 řádek).
- `public/index.html` — přidaná registrace workeru.

### Registrace (`index.html`)

- Spustí se jen když `'serviceWorker' in navigator` **a zároveň** stránka
  neběží z `file://` protokolu.
- Obalená tak, aby případné selhání registrace nijak neovlivnilo běh aplikace.

### Chování workeru (`sw.js`)

- Obsluhuje jen `GET` požadavky na vlastní origin; vše ostatní nechává být.
- **Network-first:** nejdřív `fetch(request, { cache: 'no-cache' })` —
  prohlížeč se serveru zeptá podmíněným požadavkem (ETag/Last-Modified posílá
  hosting automaticky); server vrátí 304, nebo nový obsah.
- Úspěšnou odpověď uloží (klon) do vlastní cache a vrátí stránce.
- Když síť selže (offline), obslouží požadavek ze své cache. Když není ani
  v cache, chyba se propaguje (prohlížeč ukáže standardní offline stav).
- Žádný precache seznam — cache se plní za běhu. Přidání nové hry nevyžaduje
  úpravu `sw.js`.
- Cache má verzované jméno (např. `score-v1`); při `activate` se ostatní cache
  smažou. `skipWaiting()` + `clients.claim()`, aby nový worker převzal stránky
  hned.

## Důsledky pro provoz

- Deploy beze změny: nahrát soubory na FTP, hotovo.
- **Jednorázově po prvním nasazení:** iPad drží starou verzi ještě bez
  workeru — je potřeba jednou ručně obnovit stránku, aby se worker
  nainstaloval. Poté už aktualizace probíhají samy.
- Offline bonus: po prvním úspěšném online načtení aplikace funguje i bez
  připojení.

## Testy

Regresní testy v rámci `node tests/run.js`:

- Logika `sw.js` v Node se stubem (`self.addEventListener`, `fetch`,
  `caches`):
  - síť OK → vrátí síťovou odpověď a uloží ji do cache,
  - síť selže → obslouží z cache,
  - ne-GET požadavek → worker do něj nezasahuje.
- Registrace v `index.html` je podmíněná — na `file://` (a bez
  `navigator.serviceWorker`) se nespouští a nic nerozbije.

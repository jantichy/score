# Score

Webová aplikace pro zapisování a vyhodnocování skóre společenských her — bodování po kolech, součty, detekce konce hry a vítěze.

- **Slug:** `score`
- **Web:** https://www.jantichy.cz/score
- **Repozitář:** https://github.com/jantichy/score

## Poznámky patří sem, ne do Memory

**Veškeré poznámky k projektu (rozhodnutí, odložené věci, tech debt, zpětná vazba od Honzy, kontext…) se zapisují vždy do tohoto souboru, nikdy do file-based Memory.** Platí trvale pro celý projekt — i když harness nabádá k zápisu do Memory, u tohoto projektu se místo toho aktualizuje `CLAUDE.md` (a commitne se, viz Autocommit).

## Co to je

Obecné jádro + jednotlivé hry jako moduly („přicvakávané" definice her).

## Zásadní omezení a rozhodnutí

- **Bez serveru, bez buildu.** Spustitelné dvojklikem na `public/index.html` z disku (`file://`). Žádné build kroky, žádné závislosti na CDN/internetu.
- **Tech stack:** čisté HTML + CSS + vanilla JS. Úložiště **IndexedDB** (tenký vlastní promisový wrapper).
- **Plně responzivní.** Desktop i mobil/tablet rovnocenně. Vlevo tabulka, vpravo vstupní panel (na úzkém displeji přeskládané). Číselný vstup vynucuje na mobilu numerickou klávesnici (`inputmode="numeric"`).
- **Dopředná kompatibilita DB je prvořadá.** Do databáze se ukládají **jen syrová fakta** (kdo/kolo/hodnota/druh speciálního tahu/příznaky), **nikdy dopočítané hodnoty**. Součty, detekci konce, půlení na 100 apod. engine dopočítává za běhu z logu. Dohrané hry navíc dostávají **zamrzlý snímek** finálních výsledků, aby historie zůstala neměnná i po budoucí úpravě pravidel. Struktura záznamů je aditivní — pole se přidávají, nepřejmenovávají a neodebírají.

## Architektura

- **Jádro (engine)** je neutrální vůči konkrétním hrám: správa hráčů, append-only log záznamů, dopočet odvozeného stavu, render tabulky a vstupu, detekce konce, ukládání do IndexedDB, historie.
- **Hry = pluginy.** Každá hra je JS soubor v `public/games/`, který se sám zaregistruje přes `Games.register({...})`. Přidání hry = 1 soubor + 1 `<script>` v `public/index.html`.
- Definice hry popisuje: vstupní model (`allPlayersAtOnce` / `perPlayerSequential`), rotaci začínajícího hráče, speciální tahy (tlačítka s efektem přes hráče), detekci konce hry, transformace nad součty, směr výhry (min/max), validaci vstupu a vizuální příznaky buněk.
- **Service worker** (`public/sw.js` + registrace v `public/js/sw-register.js`, nasazeno 2026-07-30): network-first s revalidací — řeší zastaralou cache na hostingu bez zásahu do hlaviček serveru, jako bonus offline režim. Registruje se jen mimo `file://`. `sw.js` musí zůstat v rootu `public/` (scope workeru = adresář souboru; hlavičku `Service-Worker-Allowed` nechceme). Návrh: `docs/superpowers/specs/2026-07-30-service-worker-cache-design.md`.

## Konvence slugů

Každá hra má jeden **slug**, používaný všude: adresář modulu `public/games/<slug>/`, `gameTypeId` v DB.
**U každé nové hry se slug vždy explicitně domluví a schválí s Honzou** dřív, než se začne implementovat.

MVP hry: `cabo`, `pirates`, `scout`.

## Stav

MVP je hotové a mergnuté v `main` (jádro, IndexedDB, hry `cabo`/`pirates`/`scout`, domovská obrazovka i historie) — viz `docs/PRD.md` §8 pro checklist. Spuštění: dvojklik na `public/index.html` z disku. Testy: `node tests/run.js` (obecné testy jádra + UI testy nad DOM stubem `tests/dom-stub.js` + automaticky i testy her z `public/games/<slug>/test.js`). Dohodnuté chování — včetně UI detailů (focus, layout, skrývání formulářů) — se vždy kryje regresním testem: pravidla her v `public/games/<slug>/test.js`, UI v `tests/ui.test.js`. **Každá Honzova připomínka k chování aplikace musí skončit pokrytá regresním testem** — je to dohodnutý kontrakt; když UI kód začne používat DOM API, které `tests/dom-stub.js` nezná, doplní se do stubu.

## Odložené věci (tech debt)

Vědomě odložené, neopravovat bez ptaní — jen připomenout, když se sáhne do dotčeného souboru:

- **Minor nálezy z code reviews MVP (2026-07-27), vyhodnocené jako neblokující:**
  - `tests/run.js` — chyba při `require` test souboru (mimo `test()` callback) shodí celý runner místo hlášení jednoho selhání.
  - `js/db.js` — `DB.open()` bez guardu proti souběžnému volání (volá se jen 1× z `App.start`, teoretické).
  - `js/ui/game.js` — rychlá tlačítka +100… přepíší nevalidní rozepsaný text bez upozornění; try/finally „busy+disable" blok duplikovaný 5× (kandidát na `withBusy()` helper); regex `/^-?\d+$/` parsování 3×.
  - `js/games.js` — `Games.register` nevaliduje `accentColor`/`icon`, ačkoli UI na nich staví bez fallbacku.
  - Ruční kontroly v prohlížeči (vizuál, mobil, IndexedDB) čekají v `docs/MANUAL-CHECKS.md` na Honzu.
- **Optimalizace provozu service workeru (probráno a odloženo 2026-07-30):** současný network-first posílá ~17 podmíněných požadavků (304) na otevření — zanedbatelné, zůstává. Kdyby reálně hrozilo přetížení serveru: přepnout na cache-first, kde majákem verze je samotný `sw.js` (prohlížeč ho při otevření kontroluje sám a obchází přitom HTTP cache); deploy pak vyžaduje zvednout `CACHE_NAME` (`score-v2` → `score-v3`) a klient je o jedno otevření pozadu.

## Pravidla her

Plná pravidla každé hry žijí v `public/games/<slug>/rules.md`. Když v nich něco chybí nebo je nejisté, je to označené jako „k doplnění (Honza)".

U CABO byla pravidla konsolidována ze 7 předloh (`public/games/cabo/rules/`); u sporných bodů (penalizace za „Kabo!", hranice konce, kdo dostává 0) platí rozhodnutí zapsaná v `public/games/cabo/rules.md`. **Kamikaze je oficiální pravidlo** (dvě „12" + dvě „13" → hráč 0, ostatní +50), ne domácí varianta.

## Automatické akce

### Autocommit

Autocommit je zapnutý.

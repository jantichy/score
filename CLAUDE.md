# Score — kontext projektu pro Claude

## Co to je

Webová aplikace pro **zapisování a vyhodnocování skóre společenských her** (bodování hráčů po kolech, průběžné i celkové součty, automatická detekce konce hry a vítěze). Obecné jádro + jednotlivé hry jako moduly („přicvakávané" definice her).

## Zásadní omezení a rozhodnutí

- **Bez serveru, bez buildu.** Spustitelné dvojklikem na `public/index.html` z disku (`file://`). Žádné build kroky, žádné závislosti na CDN/internetu.
- **Tech stack:** čisté HTML + CSS + vanilla JS. Úložiště **IndexedDB** (tenký vlastní promisový wrapper).
- **Plně responzivní.** Desktop i mobil/tablet rovnocenně. Vlevo tabulka, vpravo vstupní panel (na úzkém displeji přeskládané). Číselný vstup vynucuje na mobilu numerickou klávesnici (`inputmode="numeric"`).
- **Dopředná kompatibilita DB je prvořadá.** Do databáze se ukládají **jen syrová fakta** (kdo/kolo/hodnota/druh speciálního tahu/příznaky), **nikdy dopočítané hodnoty**. Součty, detekci konce, půlení na 100 apod. engine dopočítává za běhu z logu. Dohrané hry navíc dostávají **zamrzlý snímek** finálních výsledků, aby historie zůstala neměnná i po budoucí úpravě pravidel. Struktura záznamů je aditivní — pole se přidávají, nepřejmenovávají a neodebírají.

## Architektura

- **Jádro (engine)** je neutrální vůči konkrétním hrám: správa hráčů, append-only log záznamů, dopočet odvozeného stavu, render tabulky a vstupu, detekce konce, ukládání do IndexedDB, historie.
- **Hry = pluginy.** Každá hra je JS soubor v `public/games/`, který se sám zaregistruje přes `Games.register({...})`. Přidání hry = 1 soubor + 1 `<script>` v `public/index.html`.
- Definice hry popisuje: vstupní model (`allPlayersAtOnce` / `perPlayerSequential`), rotaci začínajícího hráče, speciální tahy (tlačítka s efektem přes hráče), detekci konce hry, transformace nad součty, směr výhry (min/max), validaci vstupu a vizuální příznaky buněk.

## Konvence slugů

Každá hra má jeden **slug**, používaný všude: adresář modulu `public/games/<slug>/`, `gameTypeId` v DB.
**U každé nové hry se slug vždy explicitně domluví a schválí s Honzou** dřív, než se začne implementovat.

MVP hry: `cabo`, `pirates`, `scout`.

## Stav

MVP je hotové a mergnuté v `main` (jádro, IndexedDB, hry `cabo`/`pirates`/`scout`, domovská obrazovka i historie) — viz `docs/PRD.md` §8 pro checklist. Spuštění: dvojklik na `public/index.html` z disku. Testy: `node tests/run.js` (obecné testy jádra + UI testy nad DOM stubem `tests/dom-stub.js` + automaticky i testy her z `public/games/<slug>/test.js`). Dohodnuté chování — včetně UI detailů (focus, layout, skrývání formulářů) — se vždy kryje regresním testem: pravidla her v `public/games/<slug>/test.js`, UI v `tests/ui.test.js`.

## Pravidla her

Plná pravidla každé hry žijí v `public/games/<slug>/rules.md`. Když v nich něco chybí nebo je nejisté, je to označené jako „k doplnění (Honza)".

U CABO byla pravidla konsolidována ze 7 předloh (`public/games/cabo/rules/`); u sporných bodů (penalizace za „Kabo!", hranice konce, kdo dostává 0) platí rozhodnutí zapsaná v `public/games/cabo/rules.md`. **Kamikaze je oficiální pravidlo** (dvě „12" + dvě „13" → hráč 0, ostatní +50), ne domácí varianta.

## Automatické akce

### Autocommit

Autocommit je zapnutý.

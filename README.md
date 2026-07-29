# Score

Webová aplikace pro **zapisování a vyhodnocování skóre společenských her** — bodování hráčů po kolech, průběžné i celkové součty, automatická detekce konce hry a určení vítěze.

## Spuštění

Žádná instalace, žádný server, žádný build. Stačí otevřít soubor v prohlížeči:

```
public/index.html
```

Aplikace běží čistě lokálně (i z `file://`), funguje offline a data ukládá do IndexedDB v prohlížeči.

## Podporované hry

| Hra | Slug |
|---|---|
| Kabo | `cabo` |
| Pirátské kostky | `pirates` |
| Scout | `scout` |

Plná pravidla každé hry jsou v `public/games/<slug>/rules.md`.

## Architektura

- **Jádro (engine)** je neutrální vůči konkrétním hrám: správa hráčů, append-only log záznamů, dopočet odvozeného stavu, render tabulky a vstupního panelu, detekce konce hry, ukládání do IndexedDB a historie dohraných her.
- **Hry jsou pluginy.** Každá hra je JS modul v `public/games/<slug>/`, který se sám zaregistruje přes `Games.register({...})`. Přidání nové hry = 1 soubor + 1 `<script>` v `public/index.html`.
- Definice hry popisuje vstupní model (všichni hráči najednou / postupně po hráčích), rotaci začínajícího hráče, speciální tahy, detekci konce, transformace nad součty, směr výhry (min/max), validaci vstupu a vizuální příznaky buněk.

### Ukládání dat

Do databáze se ukládají **jen syrová fakta** (kdo / kolo / hodnota / druh speciálního tahu), nikdy dopočítané hodnoty — součty a vyhodnocení engine dopočítává za běhu z logu. Dohrané hry navíc dostávají zamrzlý snímek finálních výsledků, takže historie zůstává neměnná i po případné budoucí úpravě pravidel. Struktura záznamů je aditivní (pole se jen přidávají), aby starší data zůstala vždy čitelná.

## Technologie

Čisté HTML + CSS + vanilla JS, bez závislostí a bez build kroku. Plně responzivní — desktop i mobil/tablet rovnocenně.

## Testy

```
node tests/run.js
```

Spouští testy jádra, UI testy nad DOM stubem (`tests/dom-stub.js`) a automaticky i testy pravidel jednotlivých her z `public/games/<slug>/test.js`.

## Struktura repozitáře

```
public/
  index.html        vstupní bod aplikace
  css/              styly
  js/               jádro (engine, úložiště, UI)
  games/<slug>/     herní moduly (game.js, rules.md, test.js)
tests/              testy jádra a UI + testovací runner
docs/               PRD, plán a specifikace
```

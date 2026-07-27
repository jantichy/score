# PRD — Score

**Product Requirements Document**
Stav: **návrh k doladění** (kód se zatím nepíše)
Verze: 0.1 · Datum: 2026-07-26

---

## 1. Pro koho to je

- **Primární uživatel:** Honza a jeho okruh spoluhráčů společenských her.
- **Kontext použití:** u stolu při hraní, jeden „zapisovatel" vede skóre za celou skupinu na jednom zařízení (mobil, tablet nebo notebook).
- **Prostředí:** čeština, lokální použití bez internetu, spuštění dvojklikem na `index.html`.
- **Technická úroveň:** běžný uživatel; ovládání musí být rychlé a odolné proti překlepům (hraje se u stolu, rychle se zadává).

## 2. Co to je

Obecná webová appka pro **zapisování a vyhodnocování bodů** ve společenských hrách, kde se hráčům počítá skóre po kolech, sčítá se a vyhodnocuje vítěz. Společné jádro (engine) + jednotlivé hry jako **moduly** („přicvakávané" definice). Appka:

- vykresluje **výsledkovou tabulku** (hráč = sloupec, kolo = řádek) s průběžnými součty a aktuálním pořadím,
- poskytuje **vstupní panel** pro aktuálně hrané kolo / hráče,
- sama **hlídá konec hry** (podle cílového skóre nebo počtu kol) a vyhodnocuje vítěze,
- **ukládá všechna data** lokálně do prohlížeče (IndexedDB) — všechny hry, rozehrané i dohrané.

### Dva typy her podle konce

| Typ | Konec hry | Tabulka |
|-----|-----------|---------|
| **Na cílové skóre** (CABO, Pirátské kostky) | při dosažení/překročení hranice bodů | řádky **přibývají** s každým kolem |
| **Na počet kol** (SCOUT) | po odehrání pevného počtu kol | řádky **předvyplněné** od začátku |

## 3. Hlavní user flows

### 3.0 Domovská obrazovka a výběr hry
- HP = **seznam registrovaných her** (CABO / Pirátské kostky / SCOUT) jako dlaždice.
- U hry, jejíž **poslední hra je nedohraná**, je přímo na dlaždici tlačítko **Pokračovat** (skok rovnou do hraní). „Poslední hra" = **naposledy hraná** (nejvyšší `lastPlayedAt`, tj. nahoře v historii).
- Po kliknutí na hru se otevře její **rozcestník**:
  - a) **Pokračovat v poslední hře** — jen pokud je poslední hra tohoto typu nedohraná,
  - b) **Nová hra** (viz 3.1),
  - c) **Historie** — všechny předchozí hry tohoto typu (viz 3.5).
- Aplikace umožňuje mít **více nedohraných her současně** (napříč hrami i v rámci jedné hry) a vrátit se ke **kterékoli** z nich (přes historii daného typu, 3.5). Stav hry je `in_progress` nebo `finished`.

### 3.1 Nová hra
1. Z rozcestníku hry → **Nová hra**.
2. Zadání **hráčů** v pořadí, ve kterém hrají (jméno na hráče; pořadí je pro hru pevné).
3. Níže na téže stránce **konfigurace variant pravidel** dané hry (viz sekce 6b) — předvyplněná defaulty (poprvé „naše" defaulty, jindy nastavení z poslední hry téhož typu).
4. Appka založí hru a zobrazí herní obrazovku (tabulka + vstup).

### 3.2 Zápis průběhu (jádro)
- **Hry „všichni najednou" (CABO, SCOUT):** vstupní panel nabídne pole pro každého hráče → zapíšu celé kolo → potvrdím → přidá se řádek (nebo se naplní předvyplněný).
- **Hry „po jednom" (Pirátské kostky):** appka vyzve konkrétního hráče („teď hraje X"), zadám jeho výsledek, appka postoupí na dalšího podle pořadí (a rotace startéra dle pravidel hry).
- U her se **speciálními tahy** jsou vedle běžného číselného vstupu **tlačítka** (kamikaze; pirátská loď; ostrov lebek…), která zapíšou efekt přes více hráčů.
- **Numerická klávesnice** na mobilu; rychlé zadávání.

### 3.3 Oprava — undo
- Tlačítko **Zpět** vrátí **poslední vložený záznam** (ne nutně celé kolo).
- Undo jde mačkat **opakovaně** a odebírat záznamy postupně až k začátku hry (zásobník nad append-only `log`).
- Granularita undo odpovídá vstupnímu modelu hry: u „všichni najednou" je záznam celé kolo, u „po jednom" je záznam výsledek jednoho hráče.

### 3.4 Konec hry
- Engine po každém zápisu vyhodnotí podmínku konce podle definice hry.
- Při splnění zobrazí **výsledek** (pořadí, vítěz) a hru **archivuje** (`finished`) se zamrzlým snímkem výsledků.
- **Remíza:** při shodném součtu rozhodne `tiebreak` dané hry (CABO: nižší skóre v posledním kole); nemá-li hra tiebreak, shodní hráči **sdílejí pořadí** a appka remízu vyznačí.
- U Pirátských kostek zahrnuje konec i **rozhodující kolo** (ostatní dohrají poslední tah, možnost přehození, návrat pod hranici a auto-výhra — viz `rules/pirates.md`; „obranný hod" jen je-li zapnutá varianta `defenderReroll`).

### 3.5 Historie (v rámci konkrétní hry)
- Z rozcestníku hry → **Historie** → seznam **všech her tohoto typu** (dohraných i nedohraných).
- **Řazení: chronologicky sestupně podle času posledního hraní** (`lastPlayedAt`) — naposledy hraná nahoře.
- U **dohrané** (`finished`) hry detail zobrazí zamrzlou tabulku a výsledek (jen ke čtení).
- U **nedohrané** (`in_progress`) hry jde z detailu **pokračovat v hraní**. Obnovení hry (i starší) aktualizuje `lastPlayedAt`, takže se **přesune nahoru** jako aktuálně hraná — a stává se tak „poslední hrou" pro zkratku Pokračovat (3.0).
- U kterékoli hry jde: **smazat** (s potvrzením) a **přejmenovat / oštítkovat** (pole `label`, např. „Vánoční turnaj").

## 4. User stories

- Jako zapisovatel chci **rychle zadat body za kolo**, abych zdržoval hru co nejméně.
- Jako zapisovatel chci na mobilu **numerickou klávesnici**, abych se netrefoval do QWERTY.
- Jako zapisovatel chci **vzít zpět poslední zápis**, když se překlepnu.
- Jako hráč chci vidět **průběžné součty a pořadí**, abych věděl, jak stojím.
- Jako hráč chci, aby appka **sama poznala konec hry** a řekla vítěze.
- Jako hráč CABO chci **označit, kdo volal CABO**, a mít **tlačítko Kamikaze**, ať se efekt (+50 ostatním) zapíše správně a je vidět.
- Jako hráč CABO chci, aby appka **sama ošetřila přesně 100 → 50** (jednou za hru pro každého hráče) a vyznačila to.
- Jako hráč Pirátských kostek chci **tlačítka pro pirátskou loď a ostrov lebek**, ať se záporné efekty rozpočítají ostatním.
- Jako hráč chci, aby appka **nepřišla o data** po zavření prohlížeče i po budoucí aktualizaci aplikace.
- Jako uživatel chci **prohlížet historii** dohraných i nedohraných her a **vrátit se ke kterékoli nedohrané** a dohrát ji.
- Jako uživatel chci na úvodní obrazovce **vybrat hru** a u té s rozehranou poslední partií mít **rovnou tlačítko Pokračovat**.
- Jako uživatel chci při zakládání hry **nastavit varianty pravidel** (např. penalizaci CABO 5/10), předvyplněné podle **minulé hry**, ať nemusím pořád klikat totéž.

## 5. Datový model a dopředná kompatibilita

**Princip:** do DB jdou **jen syrová fakta**, odvozené hodnoty se dopočítávají za běhu. Aditivní změny schématu (pole se přidávají, nepřejmenovávají/neodebírají).

- Úložiště: **IndexedDB**, object store `games` (klíč `id`) + `meta` (`schemaVersion`, poslední použité varianty na typ hry).
- Záznam hry (koncept):
  ```jsonc
  {
    "id": "…",
    "gameTypeId": "cabo",        // slug hry
    "rulesVersion": 1,            // verze pravidel modulu
    "schemaVersion": 1,          // verze obálky dat
    "status": "in_progress | finished",   // nedohraných může být víc současně
    "label": null,                // volitelný název/štítek (historie)
    "createdAt": 0, "endedAt": 0,
    "lastPlayedAt": 0,            // čas posledního hraní; řadí historii a určuje „poslední hru"
    "variants": { "caboPenalty": 10, "zeroInRound": "callerOnly" },  // zvolené varianty pravidel (viz 6b)
    "players": [ { "id": "p1", "name": "Pepa", "order": 0 } ],
    "log": [
      // append-only; tvar záznamu je generický
      { "seq": 0, "roundIndex": 0, "playerId": "p1", "value": 12,
        "special": null, "flags": {}, "ts": 0 }
    ],
    "frozenResult": null          // vyplní se při dohrání (neměnný snímek)
  }
  ```
- **Undo** = odebrání záznamu s nejvyšším `seq` z `log`.
- **Odvozený stav** (součty, pořadí, konec hry, půlení na 100, efekty speciálních tahů) počítá engine z `log` + definice hry **+ `variants` dané hry**. Nikdy se neukládá do `log`.
- **Varianty jsou zvolené při zakládání a pro danou hru neměnné.** Ukládají se do `variants` u hry, takže odvozený stav i archiv se počítají podle nastavení té konkrétní hry — ne podle aktuálních defaultů.
- **Dopředná kompatibilita variant:** `variants` u hry drží jen zvolené hodnoty; při čtení engine chybějící klíče **doplní z defaultů deklarovaných v modulu hry** (merge). Přidání nové varianty do modulu je tedy čistě aditivní — staré hry i uložené „poslední nastavení" se nerozbijí, chybějící parametr prostě spadne na svůj default.
- **Poslední použité nastavení:** v `meta` se pod klíčem typu hry drží naposledy použité `variants` (`lastVariants[gameTypeId]`); slouží jen k předvyplnění formuláře nové hry. Chybí-li (první hra daného typu) nebo neobsahuje nový parametr → default z modulu.
- **Archiv:** při dohrání se vypočtený výsledek uloží do `frozenResult`, aby historie zůstala stabilní i po budoucí změně pravidel.

## 6. Definice hry (plugin API)

Každá hra se registruje objektem přes `Games.register({...})`. Definice popisuje (koncept, doladí se při implementaci):

- `id` (slug), `name`, `rulesVersion`.
- `accentColor`, `icon`: barevný akcent a ikona hry (pro čitelný základ s odlišením her, viz sekce 8b).
- `playerRange`: `{ min, max }` — povolený počet hráčů (CABO 2–4, Pirátské kostky 2–5, SCOUT 2–5); appka mimo rozpětí nedovolí hru založit.
- `endType`: `"targetScore"` | `"fixedRounds"`.
- `winnerDirection`: `"min"` (CABO) | `"max"` (Pirátské kostky, SCOUT).
- `tiebreak(state)`: volitelné pravidlo pro shodný součet (CABO: nižší skóre v posledním kole). Když chybí → shodní hráči sdílejí pořadí a appka remízu vyznačí.
- `inputModel`: `"allPlayersAtOnce"` | `"perPlayerSequential"`.
- `variants[]`: schéma **konfigurovatelných variant pravidel** (viz sekce 6b). Každá varianta má `id`, `label`, nápovědu, typ (`enum` / `number` / `bool`), možnosti/rozsah a **default**. Volby se ukládají do `variants` v záznamu hry a ovlivňují chování enginu (bodování, konec hry, způsob zadávání…).
- `rounds`: pro `fixedRounds` funkce/hodnota (SCOUT = počet hráčů).
- `starterRotation`: pravidlo posunu začínajícího hráče mezi koly (SCOUT: +1 po směru).
- `validateInput(value, ctx)`: povolené hodnoty (CABO ≥ 0; Pirátské kostky násobky 100, zápor OK; SCOUT zápor OK).
- `specialMoves[]`: tlačítka se jménem, ikonou a funkcí `apply(state, ctx)`, která vrátí efekty přes hráče (kamikaze; pirátská loď; ostrov lebek).
- `computeTotals(state)` / transformace nad součty (CABO: přesně 100 → 50, jednou za hru pro každého hráče).
- `isGameOver(state)`: vyhodnocení konce (včetně složitého „dohrávání" u Pirátských kostek).
- `cellFormat(...)` / vizuální příznaky (kamikaze, půlení na 100, ostrov lebek, kdo volal CABO).

> Přesné rozhraní (názvy metod, tvar `ctx`/`state`) se finalizuje v implementačním plánu; PRD fixuje **schopnosti**, které API musí pokrýt.

## 6b. Varianty pravidel (konfigurovatelnost her)

Každá hra má obvykle **více bodů pravidel, které různé skupiny hrají jinak** (u CABO např. penalizace 5 vs 10, kdo dostává v kole 0, jestli uživatel píše body včetně/bez penalizace; u Pirátů „obranný hod" přehozeného vedoucího apod.). Tyto **varianty** jsou součástí definice hry a řídí chování aplikace.

**Princip:**
- Každý modul hry deklaruje seznam `variants[]` — konfigurovatelné parametry pravidel s typem, možnostmi a **defaultem**.
- Při zakládání nové hry se **pod zadáním hráčů** zobrazí formulář těchto variant, **předvyplněný**:
  - **poprvé** (žádná předchozí hra daného typu) → defaulty odsouhlasené v tomto PRD,
  - **jindy** → hodnoty z **poslední hry téhož typu** (`meta.lastVariants[gameTypeId]`).
- Zvolené hodnoty se uloží do `variants` u hry a jsou pro celou hru **neměnné** (mění se jen u nové hry).
- Po založení se `meta.lastVariants[gameTypeId]` aktualizuje na použité hodnoty.
- **Varianty se budou k hrám průběžně doplňovat.** Díky merge s defaulty modulu (viz sekce 5) je přidání nové varianty **zpětně/dopředně kompatibilní** — nerozbije uložené hry ani „poslední nastavení".

**Varianty v MVP** (default = tučně; jsou to rozhodnutí z tohoto PRD):

CABO (`cabo`):
- `caboPenalty` — penalizace za neúspěšné „Kabo!": **10** / 5.
- `zeroInRound` — kdo v kole dostává 0: **jen úspěšný volající (A)** / nejnižší hráč (B).
- `endRule` — konec hry: **≥ 100 s jednorázovou výjimkou pro první přesnou 100** / striktně > 100.
- `scoreEntry` — zadávání bodů: **ručně (uživatel píše finální čísla, appka jen značí volání)** / surové součty (uživatel zadá součty karet + kdo volal, appka dopočítá 0/penalizaci).

Pirátské kostky (`pirates`):
- `targetScore` — cílové skóre: **6000** / 5000 / 8000 / vlastní.
- `defenderReroll` — obranný hod přehozeného vedoucího v rozhodujícím kole: **ne (oficiální)** / ano (domácí varianta).

SCOUT (`scout`):
- zatím bez variant; struktura je připravená doplnit je později (např. detaily bodování).

> Poznámka: varianta `scoreEntry=auto` u CABO znamená, že engine potřebuje surové součty karet + příznak „volal Kabo" a sám aplikuje 0 (dle `zeroInRound`) a penalizaci (dle `caboPenalty`). Při `scoreEntry=manual` appka jen značí a čísla zadává uživatel.

## 7. Hry v MVP

Plná pravidla: `rules/cabo.md`, `rules/pirates.md`, `rules/scout.md`.

| Slug | Hra | Vstup | Konec | Výhra | Zápor | Krok | Speciality |
|------|-----|-------|-------|-------|:-----:|:----:|-----------|
| `cabo` | CABO/KABO | všichni najednou | cílové skóre (≥ 100, viz níže) | min | ne | jednotky–desítky | kdo volal Kabo (+10 za neúspěch), Kamikaze (0 / ostatním +50), přesně 100 → 50 (1×/hráč/hra) |

**CABO — upřesnění (konsolidováno ze 7 předloh, detail v `rules/cabo.md`):**
- Penalizace za neúspěšné „Kabo!" (volající nemá nejnižší součet): **+10 bodů**.
- 0 za kolo dostává **jen úspěšný volající „Kabo!"** (varianta A); ostatní vždy píšou svůj součet.
- **Kamikaze** je oficiální pravidlo (dvě „12" + dvě „13"): daný hráč 0, ostatní +50. Appka aplikuje tlačítkem.
- **Konec hry:** dosažení **≥ 100** = konec. Výjimka: **první** dosažení přesně 100 hru neukončí, ale srazí skóre na 50 (jednou za hru pro každého hráče). Tedy druhá přesná 100 nebo překročení 100 = konec; vyhrává nejnižší součet.
- Appka: volání „Kabo!" jen **vizuálně značí** (bodování 0/+10 zadává uživatel ručně); Kamikaze, přesně 100 → 50 a detekci konce **aplikuje/hlídá sama**.
- Všechna tato rozhodnutí jsou zároveň **defaulty konfigurovatelných variant** (viz 6b) — pro konkrétní hru se dají při zakládání změnit.
| `pirates` | Pirátské kostky | po jednom | cílové skóre (≥ cíl, výchozí 6000; s rozhodujícím kolem) | max | ano | násobky 100 | pirátská loď (mínus sobě), ostrov lebek (mínus ostatním) |

**Pirátské kostky — upřesnění (konsolidováno ze 3 předloh, detail v `rules/pirates.md`):**
- **Cílové skóre je konfigurovatelné** při zakládání hry (5000 / 6000 / 8000 / vlastní; výchozí 6000).
- **Konec hry (oficiální, bez obranného hodu):** první ≥ cíl spustí rozhodující kolo → **všichni ostatní** odehrají 1 poslední tah → vyhrává nejvyšší ≥ cíl. Když po rozhodujícím kole nikdo nemá ≥ cíl (vedoucího stáhl Ostrov lebek), hra pokračuje a **další** hráč s ≥ cíl **auto-vyhrává** (bez dalšího rozhodujícího kola).
- **Ostrov lebek** (tlačítko): zadá se počet lebek N (a zda karta Pirát → ×2) → aktuální hráč 0, každému ostatnímu **−100×N** (resp. −200×N). Lebky z karty se do N počítají.
- **Pirátská loď — neúspěch** (tlačítko): zadá se penalizace z karty → aktuální hráč za kolo **−penalizace**.
- Hodnoty jsou násobky 100, skóre **může být záporné**. Appka aplikuje speciální tlačítka i detekci konce sama.
- Cíl a „obranný hod" jsou **konfigurovatelné varianty** (viz 6b) — defaulty 6000 a „bez obrany".
| `scout` | SCOUT (Cirkus) | všichni najednou | pevný počet kol (= počet hráčů) | max | ano | jednotky–nižší desítky | rotace startéra (+1 po směru) |

**Engine musí být připravený** i na budoucí archetypy (prší/mariáš/žolíky na cílové skóre, hra na X kol, kostky 10000), ale ty se v MVP neimplementují.

## 8. MVP checklist

- [x] Kostra appky bez buildu, spustitelná z `file://`.
- [x] IndexedDB wrapper + schéma `games`/`meta` s dopřednou kompatibilitou.
- [x] Registr her (`Games.register`) + načítání modulů přes `<script>`.
- [x] Domovská obrazovka: dlaždice her + „Pokračovat" u hry s nedohranou poslední hrou.
- [x] Rozcestník hry: pokračovat v poslední (jen nedohraná) / nová hra / historie tohoto typu.
- [x] Zakládání hry: výběr typu, zadání hráčů s pořadím, **formulář variant pravidel** (viz 6b) předvyplněný z poslední hry téhož typu / defaultů.
- [x] Uložení a předvyplňování `meta.lastVariants[gameTypeId]`; merge s defaulty modulu (dopředná kompatibilita variant).
- [x] Render výsledkové tabulky (hráč = sloupec, kolo = řádek) + průběžné součty + pořadí.
- [x] Vstupní panel — model „všichni najednou".
- [x] Vstupní panel — model „po jednom" (výzva konkrétnímu hráči, postup dle pořadí + rotace).
- [x] Numerická klávesnice na mobilu; responzivní layout (2 sloupce ↔ přeskládání).
- [x] Undo posledního vloženého záznamu (opakovaně, zásobník).
- [x] Hlídání povoleného počtu hráčů dle `playerRange`.
- [x] Vyhodnocení remízy přes `tiebreak` (fallback sdílené pořadí).
- [x] Více nedohraných her současně; návrat ke kterékoli z historie daného typu (`in_progress` / `finished`).
- [x] Historie (per typ hry): náhled výsledků, pokračování u nedohraných, smazání (s potvrzením), přejmenování/štítek.
- [x] Speciální tahy jako tlačítka s efektem přes hráče.
- [x] Detekce konce hry (cílové skóre / počet kol) + rozhodující kolo u Pirátských kostek (vč. návratu pod hranici a auto-výhry).
- [x] Vizuální odlišení speciálních událostí (kamikaze, 100→50, ostrov lebek, volání CABO).
- [x] Archivace dohrané hry se zamrzlým snímkem + obrazovka Historie.
- [x] Implementace her: `cabo`, `pirates`, `scout`.

## 8b. Vizuální styl a UX

- **Směr:** čistý, střízlivý a dobře čitelný základ (velká čísla, jasná tabulka, minimum ozdob — čitelnost u stolu), přičemž **každá hra má svůj barevný akcent a ikonu** (`accentColor`, `icon` v definici) pro rychlé odlišení.
- Vysoký kontrast, velké dotykové cíle; primárně světlý motiv, tmavý režim je nice-to-have (dle systému).
- Speciální události mají konzistentní vizuální jazyk (barevné/ikonové značky): Kamikaze, 100 → 50, kdo volal Kabo, Ostrov lebek, záporné hodnoty, remíza.
- Detailní vizuální design se dolaďuje až při implementaci.

## 9. Tech stack

- **HTML + CSS + vanilla JS**, bez buildu, bez závislostí, bez CDN.
- **IndexedDB** pro perzistenci (tenký vlastní wrapper).
- Hry jako self-registrující JS moduly načtené přes `<script>` (kvůli `file://` bez ES-module CORS problémů).
- Cílové prohlížeče: aktuální desktop i mobilní (Chrome/Safari/Firefox/Edge).

## 10. Out of scope (zatím)

- Online synchronizace / sdílení mezi zařízeními, cloud.
- Plná editace libovolné buňky (jen undo posledních záznamů).
- Export / tisk / sdílení výsledků.
- PWA / instalace / offline-first servisní vrstva (appka je i tak offline z podstaty).
- Přihlašování, účty, více zapisovatelů současně.
- Statistiky napříč hrami, žebříčky.

## 11. Success metrics

- **Funkční správnost:** u každé MVP hry sedí součty, detekce konce a vítěz podle pravidel (ověřeno reálným odehráním).
- **Rychlost zápisu:** zapsání kola/hráče na pár klepnutí, bez zdržování hry.
- **Trvanlivost dat:** data přežijí zavření prohlížeče i aktualizaci aplikace (žádná ztráta historie).
- **Rozšiřitelnost:** přidání nové hry = přidání `rules/<slug>.md` + `games/<slug>.js` + 1 řádek v `index.html`, beze změn v jádře.
- **Použitelnost:** ovladatelné jednou rukou na mobilu i pohodlně na desktopu.

## 12. Otevřené otázky k doladění

- ~~CABO: penalizace za neúspěšné volání~~ — **vyřešeno: +10 bodů** (viz sekce 7 a `rules/cabo.md`).
- ~~CABO: hranice konce a interakce s pravidlem 100 → 50~~ — **vyřešeno: ≥ 100 s jednorázovou výjimkou** (viz sekce 7).
- ~~Pirátské kostky: konec hry a cílové skóre~~ — **vyřešeno: oficiální konec bez obranného hodu, konfigurovatelný cíl (default 6000)** (viz sekce 7 a `rules/pirates.md`).
- ~~Chování při remíze~~ — **vyřešeno: `tiebreak` dané hry, jinak sdílené pořadí** (sekce 3.4 a 6).
- ~~Počet hráčů~~ — **vyřešeno: hlídat `playerRange` dle hry** (sekce 6).
- ~~Undo~~ — **vyřešeno: opakovaně do hloubky** (sekce 3.3).
- ~~Rozehraná hra / návrat k nedohraným~~ — **vyřešeno: víc nedohraných současně, návrat ke kterékoli přes historii typu; workflow HP → rozcestník hry** (sekce 3.0, 3.5).
- ~~Správa historie~~ — **vyřešeno: smazat + přejmenovat/štítek** (sekce 3.5).
- ~~Vizuální styl~~ — **směr určen: čistý základ + akcenty her** (sekce 8b); detaily při implementaci.
- Pirátské kostky: konkrétní hodnoty penalizací na kartách Pirátská loď jsou volitelné (appka je bere jako zadávané číslo).
- SCOUT: zatím stačí číslo za kolo; přesné bodování a případné varianty doplníme později.

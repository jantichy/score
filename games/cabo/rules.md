# CABO / KABO — pravidla

> **Slug:** `cabo` — používá se všude (tento adresář `games/cabo/`: modul `game.js`, testy `test.js`, tato pravidla `rules.md`, `gameTypeId` v databázi).
>
> **Zdroj:** konsolidováno ze 7 předloh v `games/cabo/rules/` — dvě fyzická česká vydání **Mindok „KABO"** (ilustrace Klára Svačinová; a vydání Bézier Games / Ted Alspach, ©2019) + několik textových překladů „CABO". Kde se předlohy lišily, platí rozhodnutí odsouhlasené s Honzou (viz „Rozhodnutí u sporných bodů").

## Cíl hry

Mít po skončení hry **co nejméně bodů**. Skóre se sčítá přes kola; hra končí, jakmile někdo dosáhne hranice bodů, a vyhrává hráč s **nejnižším** součtem.

## Příprava a průběh (shrnutí)

- Každý hráč dostane 4 karty lícem dolů do řady, na začátku si tajně prohlédne 2 z nich.
- Hráči se střídají po směru hodinových ručiček. Ve svém tahu hráč dobere kartu (z dobíracího balíčku nebo z odhazovací hromádky), vymění/odhodí, nebo zvolá **„Kabo!"**.
- Číselné karty mají hodnotu podle svého čísla. **Karty s akcí** (ovlivňují hru u stolu, ne způsob zápisu):
  - **7–8 KUK (Peek):** podívej se na jednu svou kartu,
  - **9–10 ŠPION (Spy):** podívej se na jednu soupeřovu kartu,
  - **11–12 KŠEFT (Swap):** vyměň naslepo jednu svou kartu za soupeřovu.
- Na začátku každého kola si každý hráč sám spočítá součet hodnot svých karet a zapíše ho.

## Volání „Kabo!" a konec kola

- Kdo zvolá „Kabo!", ukončí tím kolo — ostatní mají ještě jeden poslední tah, pak všichni odkryjí karty.
- Kolo končí i okamžitě, když se vyčerpá dobírací balíček.
- Nové kolo začíná hráč s nejnižším skóre z právě dohraného kola (při shodě ten nejblíž po směru od předchozího začínajícího).

## Bodování kola

- Každý hráč si zapíše **součet hodnot svých karet** (celé číslo **≥ 0**; řádově jednotky až desítky).
- **Volající „Kabo!":**
  - má-li **nejnižší** součet (nebo je mezi nejnižšími), za kolo píše **0**;
  - **nemá-li** nejnižší součet, píše svůj součet **+ 10 bodů** penalizace.
- Ostatní hráči (kteří „Kabo!" nevolali) **vždy** píšou svůj součet karet — i kdyby byli nejnižší. (Nulu za kolo tedy může získat jen úspěšný volající — „varianta A".)
- **Kdo volal „Kabo!":** appka to v každém kole eviduje jako marker u daného hráče (viz „Co appka dělá").

## Kamikaze

- Skončí-li hráč kolo přesně se **dvěma kartami „12" a dvěma kartami „13"** (a žádnou další), jde o **Kamikaze**:
  - tento hráč získává za kolo **0 bodů**,
  - **všichni ostatní** hráči získávají **+50 bodů** (bez ohledu na své karty).
- Kamikaze hráč může navíc zvolat „Kabo!" (obojí se může sejít).
- V tabulce graficky odlišit.

## Přesně 100 → sleva na 50

- Jakmile **celkový součet** hráče dosáhne **přesně 100**, sníží se mu na **50 bodů**.
- Platí **jen jednou za hru pro každého hráče** (jednorázová „záchrana").
- Appka to hlídá a aplikuje automaticky a v tabulce vyznačí, že k tomu došlo.

## Konec hry

- Hra končí, jakmile první hráč dosáhne **≥ 100 bodů** — s jednou výjimkou: **první** dosažení **přesně 100** hru neukončí, ale spustí slevu na 50 (viz výše).
- Z toho plyne: **první** přesná 100 → 50 a hraje se dál; **druhá** přesná 100 (už bez záchrany) nebo **jakékoli překročení 100** → **konec hry**.
- V okamžiku konce vyhrává hráč s **nejnižším** celkovým součtem (při shodě vítězí ten z nich, kdo měl nižší skóre v posledním kole).
- Řádky (kola) **přibývají** s každým odehraným kolem — tabulka nemá předem daný počet řádků.

## Rozhodnutí u sporných bodů (kde se předlohy lišily)

| Sporný bod | Nalezené varianty | **Rozhodnuto** |
|---|---|---|
| Penalizace za neúspěšné „Kabo!" | +10 (vyd. Mindok KABO, překlady „2. edice") vs +5 (angl. originál, 2 překlady) | **+10** |
| Hranice konce | „> 100" (většina) vs „≥ 100" (vyd. Bézier) | **≥ 100** s jednorázovou výjimkou pro první přesnou 100 |
| Kdo dostává 0 v kole | jen úspěšný volající (Mindok KABO) vs nejnižší hráč v kole (2 překlady) | **jen úspěšný volající** (varianta A) |

## Konfigurovatelné varianty pravidel

Tyto body se v různých skupinách hrají jinak; v appce jsou to **volitelné varianty** nastavované při zakládání hry (default = tučně, viz tabulka výše). Seznam se bude průběžně doplňovat.

| Varianta | Možnosti | Default |
|---|---|---|
| `caboPenalty` — penalizace za neúspěšné „Kabo!" | 5 / 10 | **10** |
| `zeroInRound` — kdo dostává v kole 0 | jen úspěšný volající (A) / nejnižší hráč (B) | **A** |
| `endRule` — konec hry | ≥ 100 s výjimkou pro první přesnou 100 / striktně > 100 | **≥ 100 s výjimkou** |
| `scoreEntry` — zadávání bodů | ručně (appka jen značí volání) / surové součty (appka dopočítá 0 i penalizaci) | **ručně** |

## Co appka dělá

- **Vstupní model:** všichni hráči najednou (`allPlayersAtOnce`).
- **Za kolo se zapisuje** hodnota každého hráče (celé číslo ≥ 0) + příznaky:
  - „volal Kabo" (max jeden hráč / kolo) — appka **jen značí**, bodování (0 / +10) zadává Honza ručně,
  - „Kamikaze" (tlačítko; max jeden hráč / kolo) — appka **aplikuje** efekt: daný hráč 0, ostatní +50.
- **Appka počítá automaticky:** průběžné součty, přesně 100 → 50 (1×/hráč/hra), detekci konce hry (≥ 100 s výjimkou) a vyhodnocení vítěze.
- **Mobilní vstup:** numerická klávesnice.
- **Vizuálně odlišit:** kdo volal Kabo, Kamikaze, snížení na 50.

## Nezahrnuté varianty

- **Face-up:** karta líznutá z odhazovací hromádky zůstává lícem nahoru — volitelná varianta, v běžné hře se nepoužívá; do appky se nepromítá.

# SCOUT / Cirkus — pravidla

> **Slug:** `scout` — používá se všude (tento soubor `rules/scout.md`, modul `games/scout.js`, `gameTypeId` v databázi).
>
> **Zdroj:** návod ze Zatrolených her — lokálně `rules/scout/scout.pdf` ([online](https://www.zatrolene-hry.cz/spolecenska-hra/cirkus-12559/)). Autor: Kei Kajino (2019), CZ vydavatel 4 Kavky / Oink Games. Pro **2–5 hráčů**, od 9 let, ~15–20 min. Jiný název: **SCOUT**.

## Cíl hry

Získat po všech kolech **nejvíc bodů**. Vyhrává hráč s **nejvyšším** součtem.

## Struktura hry

- Hraje se **počet kol rovný počtu hráčů** (3 hráči → 3 kola, 4 hráči → 4 kola, …).
- V každém kole se **začínající hráč posouvá** na dalšího **po směru hodinových ručiček** (rotace startéra je pravidlem hry; ovlivňuje pořadí zápisu, ne bodování).
- Tabulka má tedy **předem daný počet řádků** (= počet hráčů) a je vypsaná od začátku, i když jsou řádky prázdné.

## Příprava kola

- Každý hráč dostane do ruky **9–12 karet** (podle počtu hráčů).
- Karty v ruce **nelze přemisťovat**, pořadí musí zůstat zachováno.
- Jediné, co může hráč na začátku kola (a jen tehdy) udělat, je **otočit celou ruku vzhůru nohama** — každá karta má **dvě čísla** (nahoře a dole), otočením se aktivuje druhá sada hodnot.

## Průběh kola (tah = jedna ze dvou akcí)

1. **Vyložit (Show)** — kartu nebo **kombinaci sousedících karet** z ruky:
   - kombinace = **postupka** (2+3+4, 7+6+5) nebo **stejná hodnota** (3+3),
   - výnos musí **přebít** to, co leží na stole:
     - stejná hodnota > postupka o **stejném počtu** karet,
     - **víc karet** vždy přebíjí kombinaci z menšího počtu karet (i samostatnou kartu),
     - při shodě rozhoduje **bodová hodnota** (tři pětky > tři dvojky).
   - **Odměna za přebití:** hráč si vezme karty, které ležely na stole před jeho výnosem — na konci kola se počítají jako **body**.
2. **Vzít si kartu (Scout)** — **krajní** kartu z výnosu předchozího hráče a vložit ji na **libovolnou pozici** ve své ruce (lze ji převrátit na druhou hodnotu). Hráč, od kterého se karta bere, získá **žeton vítězného bodu**.

- **Žeton autíčka:** jednou za hru může hráč zahrát **obě akce najednou** (Scout + Show v jednom tahu).

## Konec kola a bodování

- Kolo končí, když **někomu dojdou karty**, nebo když **všichni hráči v řadě za sebou** zvolí druhou akci (vezmou kartu ze stolu).
- Na konci kola se **sečtou/odečtou body**:
  - **+** body za **získané karty** (přebité výnosy) a za nasbírané **žetony** (vítězné body + autíčko),
  - **−** body za karty, které hráči **zůstaly v ruce**.
  - Body za kolo bývají řádově jednotky až nižší desítky a mohou být i **záporné**.
- Zapíše se výsledek kola a hraje se další kolo.

## Konec hry

- Po odehrání všech kol (= počet hráčů) se sečtou body ze všech kol.
- Vyhrává hráč s **nejvyšším** součtem.

## Co appka zaznamenává (syrová data)

- Vstupní model: **všichni hráči** za kolo (`allPlayersAtOnce`) — každý si spočítá skóre kola a zapíše.
- Rotace: začínající hráč se každé kolo posune o +1 po směru hodinových ručiček (informativní; řídí pořadí/zvýraznění, ne bodování).
- Za kolo: hodnota každého hráče (celé číslo, může být záporné).
- Tabulka je od začátku vypsaná na pevný počet řádků (= počet hráčů).
- Mobilní vstup: numerická klávesnice (včetně znaménka mínus).

> **Poznámka:** Přesné bodové hodnoty (kolik přesně za kartu / žeton / kartu v ruce, výjimka pro hráče, který kolo ukončil) najdeš v návodu `rules/scout/scout.pdf`. Pro skórovací appku je stejně nepotřebujeme — hráči si výsledné číslo za kolo spočítají u stolu a jen ho zapíšou. Kdybychom je chtěli mít i natvrdo tady v `scout.md`, vytáhnu je z toho PDF.

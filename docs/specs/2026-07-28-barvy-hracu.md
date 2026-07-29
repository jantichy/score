# Barvy hráčů — design

Schváleno Honzou 2026-07-28 (brainstorming v Claude Code).

## Cíl

Každý hráč má svou barvu, viditelnou během hry (hlavně sloupce grafu). Po
skončení hry se barvy hráčů nikde neuplatňují — tam platí výsledkové barvy
(zlatá/stříbrná/bronzová, šedá pro vybouchlé).

## Paleta a datový model

- Pevná paleta **8 pastelových barev** v jádru: `Score.dom.PLAYER_COLORS`
  (hex řetězce). Dnešní maximum hráčů je 5, paleta má rezervu.
- DB: `players[].color` — hex řetězec, syrový fakt. Aplikace zatím nemá
  žádné existující databáze, takže barva je **povinnou součástí hráče** —
  žádné fallbacky pro hráče bez barvy.
- `Engine.newGame` přijímá hráče jako objekty `{name, color}`.

## Zakládání hry

- Chip hráče: `⠿ [jméno] ● ×` — barevný puntík (button s `aria-label`,
  viditelný focus) mezi jménem a mazacím tlačítkem.
- Klik na puntík otevře popover s mřížkou 8 vzorků; klik na vzorek nastaví
  barvu a zavře popover. Zavírá i Esc a klik mimo. Vybraný vzorek označen.
- **Auto-přiřazení:** předvyplnění hráčů z poslední hry převezme i barvy;
  nový hráč (výchozí prázdný i ručně přidaný) dostane první barvu palety,
  kterou zatím nikdo nemá. Duplicita se tvrdě nevaliduje.
- **Dědění mezi hrami:** barvy se předvyplňují spolu se jmény ze zdrojové
  hry (poslední hra stejného typu, jinak poslední hra jakéhokoliv typu).

## Použití během hry

Barva vždy jako plocha/linka, nikdy barva textu (kontrast, WEB.md).

1. **Graf:** sloupec hráče v jeho barvě. Signální přebarvení při překročení
   hranice (win/lost) zůstává nadřazené.
2. **Sekvenční hry (Piráti):** banner „Teď hraje: …" dostane levý proužek
   + jemné podbarvení v barvě hráče na tahu.
3. **Hlavička tabulky:** jméno hráče podtržené jeho barvou (3px linka).
4. **Zvýraznění příštího tahu v tabulce** (`next-player`, `next-cell`)
   v barvě hráče na tahu místo akcentové barvy hry.
5. **Panel „všichni najednou" (KABO, SCOUT):** puntík před jménem hráče.

## Po skončení hry

Beze změny: graf i panel přebírají výsledkové barvy, barvy hráčů se po
`freeze` nikde nekreslí — ani v historii.

## Testy

Regresní testy (tests/ui.test.js + tests/engine.test.js): auto-přiřazení
různých barev včetně nově přidaného hráče, dědění barev ze zdrojové hry,
uložení `color` v players, sloupec grafu v barvě hráče během hry, žádné
barvy hráčů po dohrání, banner tahu v barvě hráče.

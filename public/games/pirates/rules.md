# Pirátské kostky — pravidla

> **Slug:** `pirates` — používá se všude (tento adresář `games/pirates/`: modul `game.js`, testy `test.js`, tato pravidla `rules.md`, `gameTypeId` v databázi).
>
> **Zdroj:** konsolidováno ze 3 předloh v `games/pirates/rules/` — oficiální **česká pravidla Albi** „Pirátské kostky", český **„Doplnění pravidel"** a **polská pravidla** téže hry („Piraten Kapern" / „Piraten Kapern", autor Haim Shafir, vyd. Amigo). Kde bylo třeba rozhodnout, platí volby odsouhlasené s Honzou (viz „Rozhodnutí u sporných bodů").

## Cíl hry

Jako první získat **cílové skóre** (výchozí **6000 bodů**; lze nastavit i 5000, 8000 nebo vlastní hodnotu). Vyhrává hráč s **nejvyšším** skóre.

## Průběh kola

- Hráči se **střídají po jednom** (na řadě je vždy jeden hráč, hodí si a hned se zapíše jeho výsledek za kolo, pak jde další, po směru hodinových ručiček).
- Hráč si na začátku tahu vezme jednu **pirátskou kartu** (upravuje pravidla/bonusy jeho tahu) a hází kostkami.
- **První hod:** všemi 8 kostkami. Další hody: vždy **minimálně dvěma** kostkami; kostku, na které padla **lebka**, už nelze házet znovu.
- Hráč tah ukončí dobrovolně a body se počítají — musí tak učinit **dřív, než hodí třetí lebku**.

## Bodování kombinací (počet stejných symbolů)

| Symbolů | Body |
|--------:|-----:|
| 3 | 100 |
| 4 | 200 |
| 5 | 500 |
| 6 | 1000 |
| 7 | 2000 |
| 8 | 4000 |

- **Diamanty a zlaté mince:** +100 za každý kus **a navíc** se počítají do kombinací (bodují „dvakrát" — nominál + jako součást sady).
- **Truhla plná pokladů:** pokud hráč získá body za **všech 8 kostek**, dostává **+500** bonus (propadá, pokud pak hodí lebku).
- **Zvířata:** opice a papoušci se počítají jako **stejné** kostky (2 papoušci + 3 opice = 5 stejných).
- Body jsou vždy **násobky 100**. Skóre **může být záporné**.

## Lebky a Ostrov lebek

- **Tři lebky** během tahu → tah okamžitě končí, hráč získává **0 bodů**.
- **Ostrov lebek:** hodí-li hráč **4+ lebek při prvním hodu**, dostane se na Ostrov lebek (jen pro tento tah):
  - sám získává **0 bodů**,
  - hází dál zbývajícími kostkami a snaží se hodit **další lebky**; každý hod musí přinést aspoň jednu lebku, jinak tah končí,
  - **každému ostatnímu hráči se odečte 100 bodů za každou hozenou lebku** (s kartou Pirát **200** za lebku); ostatní symboly na Ostrově lebek nemají hodnotu.
- **Dodatek:** lebky, se kterými hráč **začíná díky kartě**, se **počítají do limitu 4 lebek** pro vstup na Ostrov lebek i do výsledného počtu lebek. Příklad: karta se 2 lebkami + 4 lebky na kostkách = 6 lebek → každému ostatnímu −600. Pokud to potká úplně **prvního hráče na startu hry**, má 0 a **ostatní začínají na −600**.

## Pirátské karty (výběr; ovlivňují tah)

- **Ostrov pokladů** — kostky lze odkládat na kartu a házet zbytek znovu; při „vybití" (3. lebka) hráč **ztrácí body mimo kartu**, počítají se jen kostky na kartě.
- **Pirát** — **zdvojnásobuje** body kola; na Ostrově lebek ostatní ztrácejí **200** za lebku. (V polském vydání karta „Kapitan".)
- **Lebka/Lebky** — hráč začíná s 1–2 lebkami.
- **Strážkyně** — jednou za kolo smí znovu hodit jedinou kostku s lebkou. (Polsky „Czarownica".)
- **Pirátská loď** — hráč musí hodit alespoň daný počet **šavlí**. Uspěje-li → body + bonus; **selže-li → 0 za tah a navíc se odečte penalizace uvedená na kartě** (proměnná dle karty). S touto kartou se **nelze** dostat na Ostrov lebek. (Polsky „Bitwa morska".)
- **Zlatá mince / Diamant** — hráč začíná s bonusovou kostkou (mincí / diamantem).

## Konec hry

- Jakmile první hráč dosáhne **cílového skóre (≥ cíl)**, spustí se **rozhodující kolo**: **všichni ostatní** hráči odehrají **ještě jeden poslední tah**.
- Po rozhodujícím kole vyhrává hráč s **nejvyšším** skóre (musí být ≥ cíl).
- **Poslední výprava přehozeného vítěze** (varianta `defenderReroll`, dle oficiálních pravidel Albi — foto `rules/Ukončení hry.jpeg`): jestliže někdo během závěrečných výprav dosáhne vyššího skóre než hráč, který cíle dosáhl první, smí se přehozený hráč vydat ještě na jednu poslední výpravu.
- Pokud po rozhodujícím kole **nikdo** nemá ≥ cíl (vedoucího někdo stáhl Ostrovem lebek pod hranici), hra **pokračuje** dál a **další** hráč, který dosáhne ≥ cíl, **automaticky vyhrává** (už bez rozhodujícího kola). Stejně se appka zachová i po **poslední výpravě přehozeného vítěze** — stáhne-li její Ostrov lebek všechny hráče pod cíl, hra pokračuje stejně jako po neúspěšném rozhodujícím kole.
- Řádky (kola) **přibývají** s každým odehraným kolem.
- **Pirátská magie** (vzácné): kombinace 9 stejných kostek → hráč **automaticky vyhrává** hru. (V MVP appka neřeší automaticky; při výskytu lze hru ukončit ručně.)

## Rozhodnutí u sporných bodů

| Sporný bod | Varianty | **Rozhodnuto** |
|---|---|---|
| Konec hry / poslední výprava přehozeného vítěze | s poslední výpravou (oficiální pravidla Albi, viz foto `rules/Ukončení hry.jpeg`) vs bez ní | **konfigurovatelné (varianta `defenderReroll`), výchozí bez výpravy** |
| Cílové skóre | pevně 6000 vs volitelně 5000/8000 | **konfigurovatelné, výchozí 6000** |

## Konfigurovatelné varianty pravidel

Nastavují se při zakládání hry (default = tučně). Seznam se bude průběžně doplňovat.

| Varianta | Možnosti | Default |
|---|---|---|
| `targetScore` — cílové skóre | 5000 / 6000 / 8000 / vlastní | **6000** |
| `defenderReroll` — poslední výprava přehozeného vítěze | smí házet ještě jednou (dle pravidel Albi) / už neháže | **už neháže** |

## Co appka dělá

- **Vstupní model:** jeden hráč po druhém (`perPlayerSequential`) — appka vyzývá „teď hraje X, zadej jeho výsledek".
- **Nastavení hry:** při zakládání se volí **cílové skóre** (5000 / 6000 / 8000 / vlastní; default 6000).
- **Za záznam** se zapisuje hodnota jednoho hráče v jednom kole (celé číslo, **nezáporný násobek 100** — zápory vznikají jen režimy Pirátská loď a Ostrov lebek).
- **Režimy zápisu** (záložky v panelu, v pořadí): **Běžná hra · Výbuch · Pirátská loď · Ostrov lebek**.
  - **Běžná hra** — číselný vstup, rychlá tlačítka +100/+200/+500/+1000 a tlačítko **0** (vynuluje zadání).
  - **Výbuch** (tři lebky) — bez vstupu, hráč dostává **0 bodů**, tah se počítá.
  - **Pirátská loď (neúspěch)** — eviduje se jen nesplněný počet šavlí: volba penalizace tlačítky **−300 / −500 / −1000** (hodnoty z karet), aktuální hráč za kolo **−penalizace**.
  - **Ostrov lebek** — počet lebek se vybírá tlačítky **4–10** (na Ostrov se vstupuje od 4 lebek; maximum 10 = 8 kostek + až 2 lebky z karty) + zaškrtávátko karta Pirát (→ ×2): aktuální hráč 0, **každému ostatnímu −100×N** (resp. −200×N).
- **Appka počítá/hlídá automaticky:** průběžné součty, detekci konce hry včetně **rozhodujícího kola** a návratu pod hranici (viz „Konec hry"), vyhodnocení vítěze.
- **Mobilní vstup:** numerická klávesnice; rychlá tlačítka pro násobky 100.
- **Vizuálně odlišit:** Ostrov lebek (☠️), Výbuch (💥), neúspěšnou Pirátskou loď (🚢), záporné hodnoty.

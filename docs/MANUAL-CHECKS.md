# Manuální kontroly pro Honzu

Automatizované testy (`node tests/run.js`, 48/48) a DOM harness
(`node .superpowers/sdd/PLAN/task-11-harness/game-harness.js`, 90/90) v rámci
Tasku 16 prošly zeleně. Interaktivní prohlížeč (chrome-devtools MCP) byl v
době verifikace obsazený jinou instancí, takže následující kontroly je potřeba
provést ručně v reálném prohlížeči, ideálně na skutečném zařízení.

## Vizuál a responzivita

- [ ] Layout na šířce 375 px (mobil): panely se přeskládají pod sebe, nic
      nepřetéká, tabulka je scrollovatelná.
- [ ] Layout na šířce 768 px (tablet): rozložení odpovídá střednímu breakpointu.
- [ ] Layout na šířce 1280 px (desktop): tabulka vlevo, vstupní panel vpravo,
      oba čitelné bez zoomu.
- [ ] Na mobilu (skutečné zařízení nebo emulace) se po klepnutí do číselného
      pole otevře numerická klávesnice (`inputmode="numeric"`).
- [ ] Vizuální odlišení speciálních událostí je na první pohled srozumitelné:
      Kamikaze, 100 → 50, volání CABO, Ostrov lebek, záporné hodnoty, remíza.

## `tests/db.html` v prohlížeči

- [ ] Otevřít `tests/db.html` přímo z disku (`file://`) v prohlížeči a ověřit,
      že IndexedDB wrapper testy proběhnou zeleně (žádné selhání v konzoli).

## E2E průchody u stolu (reálná hra, ne jen harness)

- [ ] **CABO** (`games/cabo/rules.md`): 3 hráči, běžná kola s voláním Kabo, jedno
      kamikaze kolo, jeden hráč přes přesnou 100 (→ 50, hra pokračuje),
      dohrání přes 100, ověřit vítěze (nejnižší skóre) a tiebreak při shodě;
      undo uprostřed hry funguje.
- [ ] **Piráti** (`games/pirates/rules.md`): cíl 6000, ostrov lebek s kartou Pirát,
      neúspěšná loď, rozhodující kolo vč. varianty kdy Ostrov lebek stáhne
      vedoucího pod cíl (hra pokračuje do auto-výhry), totéž jednou s
      variantou `defenderReroll` zapnutou.
- [ ] **SCOUT** (`games/scout/rules.md`): 4 hráči, 4 předvyplněná kola, rotace
      startéra, záporná kola, vyhrává nejvyšší součet.
- [ ] **Trvanlivost dat**: s rozehranou hrou zavřít prohlížeč úplně (ne jen
      tab) a znovu otevřít `index.html` — hra je v historii a jde dohrát.
- [ ] **Aktualizace appky**: udělat libovolnou kosmetickou změnu v JS/CSS,
      reload stránky — stará rozehraná data v IndexedDB zůstanou čitelná
      (dopředná kompatibilita schématu).
- [ ] **Drag & drop hráčů na dotyku**: na tabletu/mobilu při zakládání hry
      chytit box se jménem prstem za úchyt ⠿ a přetáhnout na jinou pozici —
      pořadí se přeskládá (stejně jako myší na desktopu).

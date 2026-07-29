(function (g) {
  "use strict";
  const el = g.Score.dom.el;
  const domClear = g.Score.dom.clear;

  // Jádro UI nezná žádné herní vlajky ani pravidla — ikony/tooltipty vlajek
  // dodává hra přes def.flagMeta, korekce součtů nesou samy události
  // z def.transformTotals (pole adjust + title).
  function flagCell(def, playerId, roundFlags) {
    const icons = [];
    const meta = def.flagMeta || {};
    for (const flag of (roundFlags && roundFlags[playerId]) || []) {
      const m = meta[flag];
      if (m) icons.push(el("span", { class: "cell-flag", title: m.title }, m.icon));
    }
    return icons;
  }

  // Událost nad součty s polem adjust (např. půlení 100 → 50 u KABA) se
  // v buňce vypisuje explicitně za hodnotou ("5−50"); popisek nese ev.title,
  // volitelná ev.icon se přidá za rozpis (KABO: ❤️ jako signál oživení).
  function adjustSuffix(playerId, roundIndex, totalEvents) {
    for (const ev of totalEvents) {
      if (ev.roundIndex === roundIndex && ev.playerId === playerId &&
          typeof ev.adjust === "number") {
        const parts = [el("span", { class: "cell-adjust", title: ev.title || null },
          g.Score.dom.fmtScore(ev.adjust < 0 ? String(ev.adjust) : "+" + ev.adjust))];
        if (ev.icon) {
          parts.push(el("span", { class: "cell-flag", title: ev.title || null }, ev.icon));
        }
        return parts;
      }
    }
    return null;
  }

  // Validace číselného parametru speciálu: celé číslo > 0; násobek param.step,
  // pokud ho definice parametru ve hře uvádí.
  function validateSeqParam(param, raw) {
    const parsed = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
    if (!Number.isInteger(parsed) || parsed <= 0) return "Zadej celé číslo větší než 0.";
    if (param.step && parsed % param.step !== 0) return "Zadej násobek " + param.step + ".";
    return null;
  }

  // showColors: barvy hráčů se kreslí jen během hry — po dohrání platí
  // výsledkové barvy (viz docs/specs/2026-07-28-barvy-hracu.md).
  function renderTable(state, game, def, showColors) {
    const playerIds = game.players.map((p) => p.id);
    const colorOf = {};
    if (showColors) {
      for (const p of game.players) colorOf[p.id] = p.color;
    }
    // zvýraznění příštího zápisu (jen pro sekvenční tahy, viz Task 12)
    const nextTurn = state.next && state.next.type === "turn" ? state.next : null;

    const headerRow = el("tr", null,
      el("th", { class: "col-round" }),
      ...game.players.map((p) => {
        const cls = [
          nextTurn && p.id === nextTurn.playerId ? "next-player" : null,
          colorOf[p.id] ? "pc" : null,
        ].filter(Boolean).join(" ") || null;
        return el("th", {
          class: cls,
          style: colorOf[p.id] ? "--pc:" + colorOf[p.id] : null,
        }, p.name);
      }));

    const rowCount = state.roundsPlanned !== null
      ? state.roundsPlanned
      : state.rounds.length;

    const bodyRows = [];
    for (let i = 0; i < rowCount; i++) {
      const round = state.rounds[i];
      const cells = playerIds.map((pid) => {
        const isNextCell = nextTurn && nextTurn.roundIndex === i && nextTurn.playerId === pid;
        const nextStyle = isNextCell && colorOf[pid] ? "--pc:" + colorOf[pid] : null;
        if (!round) return el("td", { class: isNextCell ? "next-cell" : null, style: nextStyle });
        const value = round.scores[pid];
        const flags = flagCell(def, pid, round.flags);
        // rozpis od pluginu ("2+10", "+50", "800-600") má přednost před sečteným
        // číslem; fmtScore převádí spojovníky na typografický minus U+2212
        const displayText = round.display && round.display[pid];
        const valueText = value === undefined && !displayText
          ? ""
          : g.Score.dom.fmtScore(displayText || value);
        const adjust = adjustSuffix(pid, round.roundIndex, state.totalEvents);
        const isNeg = typeof value === "number" && value < 0;
        const cls = [isNeg ? "neg" : null, isNextCell ? "next-cell" : null].filter(Boolean).join(" ") || null;
        return el("td", { class: cls, style: nextStyle }, valueText, adjust, ...flags);
      });
      bodyRows.push(el("tr", null,
        el("td", { class: "col-round" }, String(i + 1)), ...cells));
    }

    return el("section", { class: "score-table" },
      el("table", null,
        el("thead", null, headerRow),
        el("tbody", null, ...bodyRows)));
  }

  // === Scoreboard — sekce nad tabulkou ===
  // Rozehraná hra: sloupcový graf průběžných součtů (jméno / sloupec / číslo).
  // U her s cílovou hranicí (def.scoreScale) se kreslí i čára hranice a sloupce,
  // které ji překročily, dostávají „vítěznou" (reach) nebo „vybouchlou" (avoid)
  // barvu. Záporné součty rostou pod nulovou osu.
  function scoreScaleOf(game, def) {
    if (typeof def.scoreScale !== "function") return null;
    const variants = g.Score.Games.mergeVariants(def, game.variants);
    return def.scoreScale({ variants });
  }

  // badges (jen u dohrané hry): sloupce dostanou barvy dle finálního pořadí —
  // zlatá/stříbrná/bronzová pro medailisty, nevýrazná šedá pro vybouchlé,
  // ostatní výchozí barvu. U rozehrané hry se barví jen překročení hranice.
  function renderScoreboard(game, def, tState, badges) {
    const scale = scoreScaleOf(game, def);
    const totals = tState.totals;
    const values = game.players.map((p) => totals[p.id] ?? 0);
    const top = Math.max(scale ? scale.max : 0, ...values, 1);
    const bottom = Math.min(0, ...values);
    const HEIGHT = 150; // px kreslicí plochy
    const px = HEIGHT / (top - bottom);
    const zeroY = top * px;

    const nameCells = [];
    const barCells = [];
    const totalCells = [];
    for (const p of game.players) {
      const v = totals[p.id] ?? 0;
      const badge = badges ? badges[p.id] : null;
      let barCls = "sb-bar";
      let totalCls = "sb-total" + (v < 0 ? " neg" : "");
      if (badge) {
        if (badge.tone) barCls += " sb-" + badge.tone;
        if (badge.tone === "busted") totalCls += " sb-total-busted";
      } else if (scale && v >= scale.max) {
        barCls += scale.kind === "reach" ? " sb-win" : " sb-lost";
        totalCls += scale.kind === "reach" ? " sb-total-win" : " sb-total-lost";
      }
      const barTop = v >= 0 ? (top - v) * px : zeroY;
      const barH = Math.max(Math.abs(v) * px, 2);
      // Během hry (bez badges) nese sloupec barvu hráče přes --pc; signální
      // třídy překročení hranice (sb-win/sb-lost) ji v CSS přebíjejí.
      const colorStyle = badges ? "" : ";--pc:" + p.color;
      nameCells.push(el("span", { class: "sb-name" }, p.name));
      barCells.push(el("div", { class: "sb-cell" },
        el("div", {
          class: barCls,
          style: "top:" + barTop.toFixed(1) + "px;height:" + barH.toFixed(1) + "px" + colorStyle,
        })));
      totalCells.push(el("span", { class: totalCls }, g.Score.dom.fmtScore(v)));
    }

    const overlays = [];
    if (scale) {
      const y = (top - scale.max) * px;
      overlays.push(el("div", {
        class: "sb-line sb-line-" + scale.kind,
        style: "top:" + y.toFixed(1) + "px",
      }, el("span", { class: "sb-line-label" }, String(scale.max))));
    }
    if (bottom < 0) {
      overlays.push(el("div", { class: "sb-line sb-line-zero", style: "top:" + zeroY.toFixed(1) + "px" }));
    }

    return el("section", { class: "scoreboard" },
      el("div", { class: "sb-row" }, ...nameCells),
      el("div", { class: "sb-bars", style: "height:" + HEIGHT + "px" }, ...overlays, ...barCells),
      el("div", { class: "sb-row" }, ...totalCells));
  }

  // Odznaky finálního pořadí: hry s plnohodnotným pořadím (def.rankingStyle
  // "podium") dostanou 🥇🥈🥉 pro první tři NEvybouchlé; „vybouchlí" (přes
  // hranici u avoid her, nebo v mínusu) vypadávají a nesou 💥. Hry rozlišující
  // jen vítěze (def.rankingStyle "winnerOnly" — závod Pirátů k cíli) mají 🏆.
  const MEDALS = ["🥇", "🥈", "🥉"];
  function rankingBadges(def, game, ranking) {
    const scale = scoreScaleOf(game, def);
    const style = def.rankingStyle || "podium";
    const out = {};
    for (const r of ranking) {
      const busted = (scale && scale.kind === "avoid" && r.total >= scale.max) || r.total < 0;
      if (busted) { out[r.playerId] = { icon: "💥", busted: true, tone: "busted" }; continue; }
      if (style === "winnerOnly") {
        out[r.playerId] = {
          icon: r.rank === 1 ? "🏆" : null, busted: false,
          tone: r.rank === 1 ? "gold" : null,
        };
      } else {
        out[r.playerId] = {
          icon: r.rank <= 3 ? MEDALS[r.rank - 1] : null, busted: false,
          tone: r.rank <= 3 ? ["gold", "silver", "bronze"][r.rank - 1] : null,
        };
      }
    }
    return out;
  }

  // Zjišťuje z pravidel hry (ne ze seznamu slugů natvrdo), jestli je záporná hodnota
  // v hlavním číselném poli validní — u her, kde ano (SCOUT, ruční zápis u Pirátů),
  // se vedle pole kreslí tlačítko „±" (iOS numerická klávesnice nemá mínus).
  function allowsNegativeInput(def) {
    return def.validateInput(-100) === null;
  }

  function toggleSign(input) {
    const v = input.value;
    if (v.trim() === "") return;
    input.value = v.startsWith("-") ? v.slice(1) : "-" + v;
    input.focus();
  }

  function signToggleBtn(input) {
    return el("button", {
      type: "button", class: "btn-sign", "aria-label": "Přepnout znaménko",
      onclick: () => toggleSign(input),
    }, "±");
  }

  function renderSequentialPanel(game, def, state, rerender, busyRef, undoBtn, prefill) {
    const next = state.next;
    const player = game.players.find((p) => p.id === next.playerId);
    const specialMoves = def.specialMoves || [];
    const allowsNegative = allowsNegativeInput(def);

    const paramInputs = {}; // paramId -> input element (pro aktivní speciál)
    const errorEl = el("p", { class: "field-error" });
    const specialErrorEl = el("p", { class: "field-error" });

    const input = el("input", {
      type: "text", inputmode: "numeric", autocomplete: "off",
      class: "score-input score-input-wide",
    });
    const signBtn = allowsNegative ? signToggleBtn(input) : null;
    // Tlačítko „0" (def.quickZero): vynuluje rozklikané rychlé přičítání.
    const zeroBtn = def.quickZero ? el("button", {
      type: "button", class: "btn-quick", title: "Vynulovat zadání",
      onclick: () => { input.value = "0"; input.focus(); },
    }, "0") : null;

    // Rychlá přičítací tlačítka deklaruje hra (Piráti: násobky 100).
    const quickAmounts = def.quickAmounts || [];
    const quickBtns = quickAmounts.map((amt) => el("button", {
      type: "button", class: "btn-quick",
      onclick: () => {
        const raw = input.value.trim();
        const cur = /^-?\d+$/.test(raw) ? parseInt(raw, 10) : 0;
        input.value = String(cur + amt);
      },
    }, "+" + amt));

    const confirmBtn = el("button", {
      type: "button", class: "btn-action", style: "--accent:" + def.accentColor,
      onclick: onConfirmTurn,
    }, "Zapsat tah");

    const specialArea = el("div", { class: "special-area" });

    // Režimy zápisu se přepínají celé (hidden) — viditelný je vždy jen
    // formulář aktivního režimu, nic se nedisabluje.
    const normalForm = el("div", { class: "mode-form" },
      el("div", { class: "input-controls" }, input),
      (signBtn || zeroBtn || quickBtns.length)
        ? el("div", { class: "input-controls" }, signBtn, zeroBtn, ...quickBtns)
        : null,
      errorEl,
      confirmBtn);

    async function onConfirmTurn() {
      if (busyRef.value) return;
      busyRef.value = true;
      confirmBtn.disabled = true;
      const undoWasDisabled = undoBtn ? undoBtn.disabled : false;
      if (undoBtn) undoBtn.disabled = true;
      try {
        errorEl.textContent = "";
        const raw = input.value.trim();
        const parsed = /^-?\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
        const err = def.validateInput(parsed, { player });
        if (err) {
          errorEl.textContent = err;
          input.focus();
          return;
        }
        const record = {
          playerId: next.playerId, roundIndex: next.roundIndex,
          value: parsed, special: null, flags: {},
        };
        g.Score.Engine.addEntry(game, [record], Date.now());
        await g.Score.DB.putGame(game);
        await rerender();
      } finally {
        busyRef.value = false;
        confirmBtn.disabled = false;
        if (undoBtn) undoBtn.disabled = undoWasDisabled;
      }
    }

    function renderSpecialForm(move) {
      domClear(specialArea);
      Object.keys(paramInputs).forEach((k) => delete paramInputs[k]);
      specialErrorEl.textContent = "";

      if (!move) return;

      // paramInputs drží jednotné rozhraní {param, get, set, focus} — potvrzení
      // i předvyplnění po undo tak nemusí rozlišovat druh pole.
      const rows = (move.params || []).map((param) => {
        if (param.type === "bool") {
          const field = el("input", { type: "checkbox" });
          paramInputs[param.id] = {
            param,
            get: () => !!field.checked,
            set: (v) => { field.checked = !!v; },
            focus: () => field.focus(),
          };
          return el("label", { class: "param-row" }, param.label, field);
        }
        if (param.type === "choice") {
          // Výběr z pevné sady hodnot: segmentovaná tlačítka, max jedno aktivní.
          // Bez výběru se zápis odmítne (viz onConfirmSpecial).
          let selected;
          const setSelected = (v) => {
            selected = v;
            btns.forEach((b, j) => b.classList.toggle("active", param.options[j].value === v));
          };
          const btns = (param.options || []).map((opt) => el("button", {
            type: "button", class: "btn-special",
            onclick: () => setSelected(opt.value),
          }, opt.label));
          paramInputs[param.id] = {
            param,
            get: () => selected,
            set: setSelected,
            focus: () => { if (btns[0]) btns[0].focus(); },
          };
          return el("div", { class: "param-row param-row-choice" },
            param.label ? el("span", { class: "param-label" }, param.label) : null,
            el("div", { class: "choice-group" }, ...btns));
        }
        const field = el("input", {
          type: "text", inputmode: "numeric", autocomplete: "off", class: "score-input",
        });
        paramInputs[param.id] = {
          param,
          get: () => field.value,
          set: (v) => { field.value = String(v); },
          focus: () => field.focus(),
          isText: true,
        };
        return el("label", { class: "param-row" }, param.label, field);
      });

      const submitBtn = el("button", {
        type: "button", class: "btn-action", style: "--accent:" + def.accentColor,
        onclick: () => onConfirmSpecial(move),
      }, "Zapsat: " + move.label);

      specialArea.append(...rows, specialErrorEl, submitBtn);
    }

    async function onConfirmSpecial(move) {
      if (busyRef.value) return;
      busyRef.value = true;
      const undoWasDisabled = undoBtn ? undoBtn.disabled : false;
      if (undoBtn) undoBtn.disabled = true;
      try {
        specialErrorEl.textContent = "";
        const flags = {};
        let firstErrorField = null;
        for (const param of move.params || []) {
          const field = paramInputs[param.id];
          if (param.type === "bool") {
            flags[param.id] = field.get();
            continue;
          }
          if (param.type === "choice") {
            const value = field.get();
            if (value === undefined) {
              specialErrorEl.textContent = param.requiredMessage || "Vyber hodnotu.";
              if (!firstErrorField) firstErrorField = field;
              continue;
            }
            flags[param.id] = value;
            continue;
          }
          const raw = field.get().trim();
          const err = validateSeqParam(param, raw);
          if (err) {
            specialErrorEl.textContent = err;
            if (!firstErrorField) firstErrorField = field;
            continue;
          }
          flags[param.id] = parseInt(raw, 10);
        }
        if (firstErrorField) {
          firstErrorField.focus();
          return;
        }
        const record = {
          playerId: next.playerId, roundIndex: next.roundIndex,
          value: null, special: move.id, flags,
        };
        g.Score.Engine.addEntry(game, [record], Date.now());
        await g.Score.DB.putGame(game);
        await rerender();
      } finally {
        busyRef.value = false;
        if (undoBtn) undoBtn.disabled = undoWasDisabled;
      }
    }

    // Přepínač režimu nahoře: „Běžná hra" + jeden režim za každý speciální
    // tah hry v pořadí z def.specialMoves. Zmáčknutý režim určuje, který
    // formulář je vykreslený — ostatní jsou úplně schované. Záložky jsou bez
    // ikon a úzké, aby se všechny vešly vedle sebe do jednoho řádku panelu.
    const modes = [{ id: null, label: "Běžná hra", move: null }].concat(
      specialMoves.map((move) => ({ id: move.id, label: move.label, move })));
    const modeBtns = modes.map((mode) => el("button", {
      type: "button", class: "btn-special",
      onclick: () => { setMode(mode.id); if (!mode.id) input.focus(); },
    }, mode.label));
    const modeToggle = el("div", {
      class: "mode-toggle", style: "--accent:" + def.accentColor,
    }, ...modeBtns);

    function setMode(moveId) {
      const mode = modes.find((m) => m.id === moveId);
      renderSpecialForm(mode ? mode.move : null);
      normalForm.hidden = !!moveId;
      specialArea.hidden = !moveId;
      modeBtns.forEach((btn, i) => btn.classList.toggle("active", modes[i].id === moveId));
    }
    setMode(null);

    // Předvyplnění vráceného tahu (viz rerender({prefill}) u undo/opravy):
    // po undo je na tahu tentýž hráč — obnoví se hodnota, nebo otevřený
    // speciál s vyplněnými parametry.
    if (prefill && prefill.length === 1 && prefill[0].playerId === next.playerId) {
      const rec = prefill[0];
      if (rec.special) {
        const move = specialMoves.find((m) => m.id === rec.special);
        if (move) {
          setMode(move.id);
          for (const param of move.params || []) {
            const entry = paramInputs[param.id];
            if (!entry) continue;
            if (param.type === "bool") entry.set(!!rec.flags[param.id]);
            else if (rec.flags[param.id] !== undefined) entry.set(rec.flags[param.id]);
          }
        }
      } else if (rec.value !== null && rec.value !== undefined) {
        input.value = String(rec.value);
      }
    }

    const bannerChildren = [
      el("p", { class: "turn-player" }, "Teď hraje: " + (player ? player.name : "?")),
    ];
    if (next.note) bannerChildren.push(el("p", { class: "turn-note" }, next.note));

    // Barva hráče na tahu podtrhuje celý banner (proužek + jemné podbarvení).
    const banner = el("div", {
      class: "turn-banner pc",
      style: "--pc:" + player.color,
    }, ...bannerChildren);
    banner.addEventListener("click", () => { if (!normalForm.hidden) input.focus(); });

    const panel = el("aside", { class: "input-panel" },
      banner,
      specialMoves.length ? modeToggle : null,
      normalForm,
      specialArea,
      undoBtn);

    setTimeout(() => { if (!normalForm.hidden) input.focus(); }, 0);

    return panel;
  }

  function rankLabels(ranking) {
    const byRank = new Map();
    for (const r of ranking) {
      if (!byRank.has(r.rank)) byRank.set(r.rank, []);
      byRank.get(r.rank).push(r);
    }
    const label = {};
    for (const [rank, group] of byRank) {
      const last = rank + group.length - 1;
      label[rank] = rank === last ? rank + "." : rank + ".–" + last + ".";
    }
    return label;
  }

  function renderResultPanel(game, def, result, canFix, rerender, busyRef) {
    const ranking = result.ranking;
    const headline = el("p", { class: "panel-title" }, "Stupně vítězů");

    // Finální pořadí: hráči pod sebou s medailemi/odznaky (viz rankingBadges);
    // pozadí řádků zlaté/stříbrné/bronzové pro medailisty, nevýrazně šedé
    // („disabled") pro vybouchlé s 🧨, ostatní bílé.
    const labels = rankLabels(ranking);
    const badges = rankingBadges(def, game, ranking);
    const rows = ranking.map((r) => {
      const b = badges[r.playerId];
      const cls = "rank-row" + (b.tone ? " rank-" + b.tone : "");
      return el("div", { class: cls },
        el("span", { class: "rank-pos" }, b.icon || labels[r.rank]),
        el("span", { class: "rank-name" }, r.name),
        el("span", { class: "rank-total" }, g.Score.dom.fmtScore(r.total)));
    });

    const children = [headline, el("div", { class: "final-ranking" }, ...rows)];

    if (canFix) {
      const fixBtn = el("button", {
        type: "button", class: "btn-back",
        onclick: async () => {
          if (busyRef.value) return;
          busyRef.value = true;
          fixBtn.disabled = true;
          try {
            const maxEntry = Math.max(...game.log.map((r) => r.entryId));
            const removed = game.log.filter((r) => r.entryId === maxEntry);
            g.Score.Engine.unfreeze(game);
            g.Score.Engine.undo(game);
            await g.Score.DB.putGame(game);
            await rerender({ prefill: removed });
          } finally {
            busyRef.value = false;
            fixBtn.disabled = false;
          }
        },
      }, "Zpět (oprava zápisu)");
      children.push(fixBtn);
    }

    return el("aside", { class: "input-panel result-panel" }, ...children);
  }

  // Pozn.: all-at-once panel zatím nevykresluje def.specialMoves[].params (kamikaze má
  // params: [] — nemá je co kreslit). Budoucí all-at-once hra se specialMove, který nese
  // vlastní parametry (jako Piráti v sekvenčním panelu), bude vyžadovat rozšíření zdejšího
  // renderování o formulář parametrů (viz renderSpecialForm v renderSequentialPanel).
  function renderInputPanel(game, def, state, rerender, busyRef, undoBtn, prefill) {
    if (def.inputModel !== "allPlayersAtOnce") {
      return renderSequentialPanel(game, def, state, rerender, busyRef, undoBtn, prefill);
    }

    const next = state.next;
    const roundIndex = next.roundIndex;
    const starterIndex = next.starterIndex;

    const inputs = {}; // playerId -> input element
    const errorEls = {}; // playerId -> error element
    // Per-hráč přepínače kola deklaruje hra přes def.roundFlags (KABO: volání
    // „Kabo") — jádro UI o konkrétních vlajkách nic neví. Každý přepínač drží
    // max jednoho označeného hráče (flagSel[rf.id] = playerId | null).
    const roundFlagDefs = def.roundFlags || [];
    const flagSel = {};
    // aktivace jakéhokoli speciálu z def.specialMoves deaktivuje číselná pole (max 1 aktivní)
    const specialState = { moveId: null, playerId: null };
    const specialMoves = def.specialMoves || [];
    const allowsNegative = allowsNegativeInput(def);

    const signBtns = {}; // playerId -> tlačítko ± (jen když allowsNegative)

    function setNumericInputsDisabled() {
      const active = !!specialState.playerId;
      for (const pid of Object.keys(inputs)) {
        inputs[pid].disabled = active;
        if (signBtns[pid]) signBtns[pid].disabled = active;
      }
    }

    const playerRows = game.players.map((p) => {
      const input = el("input", {
        type: "text", inputmode: "numeric", autocomplete: "off",
        class: "score-input",
      });
      inputs[p.id] = input;
      const errorEl = el("p", { class: "field-error" });
      errorEls[p.id] = errorEl;

      const showStarter = typeof def.starter === "function" && p.order === starterIndex;
      // Jméno hráče na vlastním řádku, veškeré ovládání (input + tlačítka) pod ním
      // v jedné wrapovací řadě — nikdy se nesmí stát, že část ovládání je vedle
      // jména a zbytek přeteče pod něj.
      const controls = [input];
      if (allowsNegative) {
        const signBtn = signToggleBtn(input);
        signBtns[p.id] = signBtn;
        controls.push(signBtn);
      }

      for (const rf of roundFlagDefs) {
        const flagBtn = el("button", {
          type: "button", class: "btn-special btn-flag-" + rf.id,
          onclick: () => {
            flagSel[rf.id] = flagSel[rf.id] === p.id ? null : p.id;
            refreshToggleStates();
            if (!input.disabled) input.focus();
          },
        }, rf.label);
        controls.push(flagBtn);
        flagBtn._pid = p.id;
      }

      for (const move of specialMoves) {
        const btn = el("button", {
          type: "button", class: "btn-special btn-move-" + move.id,
          onclick: () => {
            const isActive = specialState.playerId === p.id && specialState.moveId === move.id;
            specialState.playerId = isActive ? null : p.id;
            specialState.moveId = isActive ? null : move.id;
            setNumericInputsDisabled();
            refreshToggleStates();
            if (!input.disabled) input.focus();
          },
        }, (move.icon ? move.icon + " " : "") + move.label);
        btn._pid = p.id;
        btn._moveId = move.id;
        controls.push(btn);
      }

      // Klik kamkoli do oblasti řádku hráče (jméno, volné místo) přesune focus
      // do jeho číselného pole — na input se tak není potřeba trefovat přesně.
      // Kliky na tlačítka/input samotný se nechávají být (mají vlastní chování).
      const row = el("div", { class: "input-row" },
        el("span", { class: "input-player-name" },
          el("span", { class: "pc-dot", style: "--pc:" + p.color, "aria-hidden": "true" }),
          p.name, showStarter ? el("span", { class: "starter-badge" }, " začíná") : null),
        el("div", { class: "input-controls" }, ...controls),
        errorEl);
      row.addEventListener("click", (ev) => {
        if (ev.target.closest("button") || ev.target === input) return;
        if (!input.disabled) input.focus();
      });
      return row;
    });

    function refreshToggleStates() {
      for (const row of playerRows) {
        for (const rf of roundFlagDefs) {
          for (const btn of row.querySelectorAll(".btn-flag-" + rf.id)) {
            btn.classList.toggle("active", btn._pid === flagSel[rf.id]);
          }
        }
        for (const move of specialMoves) {
          for (const btn of row.querySelectorAll(".btn-move-" + move.id)) {
            btn.classList.toggle("active",
              btn._pid === specialState.playerId && btn._moveId === specialState.moveId);
          }
        }
      }
    }
    refreshToggleStates();

    // Předvyplnění vráceného kola (viz rerender({prefill}) u undo/opravy):
    // hodnoty, přepínače kola i aktivní speciál se obnoví, stačí opravit detail.
    if (prefill) {
      for (const rec of prefill) {
        if (!inputs[rec.playerId]) continue;
        for (const rf of roundFlagDefs) {
          if (rec.flags && rec.flags[rf.id]) flagSel[rf.id] = rec.playerId;
        }
        if (rec.special) {
          specialState.playerId = rec.playerId;
          specialState.moveId = rec.special;
        }
        if (rec.value !== null && rec.value !== undefined) {
          inputs[rec.playerId].value = String(rec.value);
        }
      }
      setNumericInputsDisabled();
      refreshToggleStates();
    }

    const confirmBtn = el("button", {
      type: "button", class: "btn-action", style: "--accent:" + def.accentColor,
      onclick: onConfirm,
    }, "Zapsat kolo");
    const panelError = el("p", { class: "field-error" });

    async function onConfirm() {
      // re-entrancy guard: brání dvojímu zápisu kola při dvojkliku (viz undo handler v render())
      if (busyRef.value) return;
      busyRef.value = true;
      confirmBtn.disabled = true;
      const undoWasDisabled = undoBtn ? undoBtn.disabled : false;
      if (undoBtn) undoBtn.disabled = true;
      try {
        for (const pid of Object.keys(errorEls)) errorEls[pid].textContent = "";
        panelError.textContent = "";

        const specialActive = !!specialState.playerId;

        // Povinné přepínače kola (deklaruje hra, KABO: volající) — v běžném
        // kole musí být označen hráč; kolo se speciálem povinnost nemá.
        for (const rf of roundFlagDefs) {
          if (rf.required && !specialActive && !flagSel[rf.id]) {
            panelError.textContent = rf.requiredMessage || "Označ hráče (" + rf.label + ").";
            return;
          }
        }
        const records = [];
        let firstErrorInput = null;

        for (const p of game.players) {
          const flags = {};
          for (const rf of roundFlagDefs) {
            if (flagSel[rf.id] === p.id) flags[rf.id] = true;
          }

          if (specialActive) {
            records.push({
              playerId: p.id,
              roundIndex,
              value: null,
              special: p.id === specialState.playerId ? specialState.moveId : null,
              flags,
            });
            continue;
          }

          let raw = inputs[p.id].value.trim();
          // Nevyplněné skóre hráče označeného přepínačem s emptyScoreValue
          // (KABO: potvrzené úspěšné volání → 0) se doplní deklarovanou hodnotou.
          if (raw === "") {
            const rf = roundFlagDefs.find((f) =>
              flagSel[f.id] === p.id && f.emptyScoreValue !== undefined);
            if (rf) raw = String(rf.emptyScoreValue);
          }
          const parsed = /^-?\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
          const err = def.validateInput(parsed, { player: p });
          if (err) {
            errorEls[p.id].textContent = err;
            if (!firstErrorInput) firstErrorInput = inputs[p.id];
            continue;
          }
          records.push({
            playerId: p.id,
            roundIndex,
            value: parsed,
            special: null,
            flags,
          });
        }

        if (firstErrorInput) {
          firstErrorInput.focus();
          return;
        }

        g.Score.Engine.addEntry(game, records, Date.now());
        await g.Score.DB.putGame(game);
        await rerender();
      } finally {
        busyRef.value = false;
        confirmBtn.disabled = false;
        if (undoBtn) undoBtn.disabled = undoWasDisabled;
      }
    }

    const panel = el("aside", { class: "input-panel" },
      el("h2", { class: "panel-title" }, (roundIndex + 1) + ". kolo"),
      ...playerRows,
      panelError,
      confirmBtn,
      undoBtn);

    setNumericInputsDisabled();

    // focus první pole po vykreslení
    setTimeout(() => {
      const first = game.players[0] && inputs[game.players[0].id];
      if (first && !first.disabled) first.focus();
    }, 0);

    return panel;
  }

  const gameScreen = {
    async render(container, { gameId, prefill }) {
      // idempotentní vyčištění: App.show čistí kontejner před prvním renderem, ale interní
      // rerender() (po zápisu kola/tahu, undo, opravě dohrané hry) volá gameScreen.render
      // přímo bez App.show mezikroku — bez clear() by se celý screen jen přidával vedle starého.
      domClear(container);
      const game = await g.Score.DB.getGame(gameId);
      if (!game) {
        container.textContent = "Hra nenalezena.";
        return;
      }
      const def = g.Score.Games.get(game.gameTypeId);

      // wasFinished: hra byla dohraná a zamrzlá už PŘED tímto renderem (např. otevřená
      // z historie) → čte se jen z frozenResult, žádná oprava není možná (Task 14).
      // Pokud derive teprve TEĎ zjistí konec hry, zamrzneme ji tady a oprava (Zpět) zůstává
      // dostupná, dokud uživatel neopustí obrazovku (viz brief Úkolu 13).
      const wasFinished = game.status === "finished";
      let state = null;
      if (!wasFinished) {
        state = g.Score.Engine.derive(game, def);
        if (state.finished) {
          g.Score.Engine.freeze(game, state, Date.now());
          await g.Score.DB.putGame(game);
        }
      }
      const isFinished = wasFinished || state.finished;

      // rerender(extra): extra.prefill = záznamy právě odmazané přes undo/opravu —
      // vstupní panel se jimi předvyplní, aby se kolo/tah nemusely psát celé znovu.
      async function rerender(extra) {
        await gameScreen.render(container, { gameId, ...(extra || {}) });
      }

      // sdílený re-entrancy guard mezi undo/opravou a potvrzením kola (viz onConfirm
      // v renderInputPanel a fixBtn v renderResultPanel): brání dvojímu zápisu/odebrání
      // kola při rychlém dvojkliku, dokud běží mutace + DB.putGame.
      const busyRef = { value: false };

      const undoBtn = isFinished ? null : el("button", {
        class: "btn-undo",
        disabled: game.log.length === 0 ? "disabled" : null,
        onclick: async () => {
          if (busyRef.value) return;
          busyRef.value = true;
          undoBtn.disabled = true;
          try {
            const maxEntry = Math.max(...game.log.map((r) => r.entryId));
            const removed = game.log.filter((r) => r.entryId === maxEntry);
            g.Score.Engine.undo(game);
            await g.Score.DB.putGame(game);
            await rerender({ prefill: removed });
          } finally {
            busyRef.value = false;
            undoBtn.disabled = false;
          }
        },
      }, "↩ Vrátit poslední zápis");

      const header = g.Score.dom.pageHeader({
        icon: def.icon, title: def.name, accent: def.accentColor,
        onBack: () => g.App.show("hub", { gameTypeId: game.gameTypeId }),
      });

      // tabulka: dohraná hra (wasFinished) čte jen ze zamrzlého snímku — NE z derive —
      // aby historie zůstala neměnná i po budoucí úpravě pravidel dané hry.
      const tableState = wasFinished
        ? {
          rounds: game.frozenResult.rounds,
          totals: game.frozenResult.totals,
          totalEvents: game.frozenResult.totalEvents,
          roundsPlanned: null,
          next: null,
          ranking: game.frozenResult.ranking,
        }
        : state;
      // Tabulka kol se nekreslí, dokud není zapsané ani jedno kolo — VÝJIMKOU
      // jsou hry s předem známým počtem kol (roundsPlanned, např. SCOUT):
      // tam se od začátku vypisuje celá tabulka s očíslovanými prázdnými řádky.
      const table = tableState.rounds.length > 0 || tableState.roundsPlanned !== null
        ? renderTable(tableState, game, def, !isFinished)
        : null;

      // Levý sloupec vypadá u rozehrané i dohrané hry stejně: nahoře graf
      // součtů, pod ním tabulka kol. Finální pořadí ukazuje pravý panel;
      // u dohrané hry přebírá graf barvy medailí.
      const badges = isFinished
        ? rankingBadges(def, game, wasFinished ? game.frozenResult.ranking : state.ranking)
        : null;
      const scoreboard = renderScoreboard(game, def, tableState, badges);

      const panel = isFinished
        ? renderResultPanel(game, def, wasFinished ? game.frozenResult : state, !wasFinished, rerender, busyRef)
        : renderInputPanel(game, def, state, rerender, busyRef, undoBtn, prefill);

      container.append(
        header,
        el("div", { class: "game-body", style: "--accent:" + def.accentColor },
          el("div", { class: "game-main" }, scoreboard, table),
          panel));
    },
  };

  g.Score.UI = g.Score.UI || {};
  g.Score.UI.game = gameScreen;
  g.Score.UI.rankingBadges = rankingBadges;
})(globalThis);

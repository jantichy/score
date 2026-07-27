(function (g) {
  "use strict";
  const el = g.Score.dom.el;
  const domClear = g.Score.dom.clear;

  // Pozn.: kamikazeVictim a halved nemají ikonu — jejich efekt se v buňce
  // vypisuje explicitně jako rozpis ("+50", "5-50"), ikona by ho zdvojovala.
  const FLAG_META = {
    cabo: { icon: "📢", title: "Volal Kabo" },
    caboFail: { icon: "❗", title: "Neúspěšné Kabo (+penalizace)" },
    caboSuccess: { icon: "✅", title: "Úspěšné Kabo" },
    kamikaze: { icon: "🛩️", title: "Kamikaze" },
    skullIsland: { icon: "☠️", title: "Ostrov lebek" },
    skullVictim: { icon: "☠️➖", title: "Ostrov lebek — oběť" },
    shipFail: { icon: "⚓", title: "Pirátská loď — neúspěch" },
    lowestZero: { icon: "0️⃣", title: "Nejnižší součet — 0" },
  };

  // Vstupní pravidla pro číselné parametry speciálů v sekvenčním panelu (klíčováno přes
  // paramId — jde jen o validaci formuláře, ne o popis/typ parametru; ten dodává
  // def.specialMoves[].params přímo z pluginu, viz Task 12 fix).
  const SEQ_PARAM_RULES = {
    penalty: { multipleOf100: true },
  };

  function validateSeqParam(paramId, raw) {
    const parsed = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
    if (!Number.isInteger(parsed) || parsed <= 0) return "Zadej celé číslo větší než 0.";
    const rule = SEQ_PARAM_RULES[paramId];
    if (rule && rule.multipleOf100 && parsed % 100 !== 0) return "Zadej násobek 100.";
    return null;
  }

  function flagCell(playerId, roundIndex, roundFlags, totalEvents) {
    const icons = [];
    const flagsForPlayer = (roundFlags && roundFlags[playerId]) || [];
    for (const flag of flagsForPlayer) {
      const meta = FLAG_META[flag];
      if (meta) icons.push(el("span", { class: "cell-flag", title: meta.title }, meta.icon));
    }
    return icons;
  }

  // Půlení přesné 100 → 50 se v buňce vypisuje explicitně jako „-50"
  // za zapsanou hodnotou (např. "5-50"), ne ikonou.
  function halvedSuffix(playerId, roundIndex, totalEvents) {
    for (const ev of totalEvents) {
      if (ev.roundIndex === roundIndex && ev.playerId === playerId && ev.type === "halved") {
        return el("span", { class: "cell-adjust", title: "Přesně 100 → 50" }, "-50");
      }
    }
    return null;
  }

  function renderTable(state, game, def) {
    const playerIds = game.players.map((p) => p.id);
    // zvýraznění příštího zápisu (jen pro sekvenční tahy, viz Task 12)
    const nextTurn = state.next && state.next.type === "turn" ? state.next : null;

    const headerRow = el("tr", null,
      el("th", { class: "col-round" }),
      ...game.players.map((p) => el("th", {
        class: nextTurn && p.id === nextTurn.playerId ? "next-player" : null,
      }, p.name)));

    const rowCount = state.roundsPlanned !== null
      ? state.roundsPlanned
      : state.rounds.length;

    const bodyRows = [];
    for (let i = 0; i < rowCount; i++) {
      const round = state.rounds[i];
      const cells = playerIds.map((pid) => {
        const isNextCell = nextTurn && nextTurn.roundIndex === i && nextTurn.playerId === pid;
        if (!round) return el("td", { class: isNextCell ? "next-cell" : null });
        const value = round.scores[pid];
        const flags = flagCell(pid, round.roundIndex, round.flags, state.totalEvents);
        // rozpis od pluginu ("2+10", "+50", "800-600") má přednost před sečteným číslem
        const displayText = round.display && round.display[pid];
        const valueText = displayText || (value === undefined ? "" : String(value));
        const halved = halvedSuffix(pid, round.roundIndex, state.totalEvents);
        const isNeg = typeof value === "number" && value < 0;
        const cls = [isNeg ? "neg" : null, isNextCell ? "next-cell" : null].filter(Boolean).join(" ") || null;
        return el("td", { class: cls }, valueText, halved, ...flags);
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
      nameCells.push(el("span", { class: "sb-name" }, p.name));
      barCells.push(el("div", { class: "sb-cell" },
        el("div", {
          class: barCls,
          style: "top:" + barTop.toFixed(1) + "px;height:" + barH.toFixed(1) + "px",
        })));
      totalCells.push(el("span", { class: totalCls }, String(v)));
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
  // hranici u avoid her, nebo v mínusu) vypadávají a nesou 🧨. Hry rozlišující
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

  function renderSequentialPanel(game, def, state, rerender, busyRef, undoBtn) {
    const next = state.next;
    const player = game.players.find((p) => p.id === next.playerId);
    const specialMoves = def.specialMoves || [];
    const allowsNegative = allowsNegativeInput(def);

    const specialState = { moveId: null };
    const paramInputs = {}; // paramId -> input element (pro aktivní speciál)
    const errorEl = el("p", { class: "field-error" });
    const specialErrorEl = el("p", { class: "field-error" });

    const input = el("input", {
      type: "text", inputmode: "numeric", autocomplete: "off",
      class: "score-input score-input-wide",
    });
    const signBtn = allowsNegative ? signToggleBtn(input) : null;

    const quickAmounts = [100, 200, 500, 1000];
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

    function setNormalDisabled(disabled) {
      input.disabled = disabled;
      confirmBtn.disabled = disabled;
      if (signBtn) signBtn.disabled = disabled;
      for (const btn of quickBtns) btn.disabled = disabled;
    }

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

      const rows = (move.params || []).map((param) => {
        let field;
        if (param.type === "bool") {
          field = el("input", { type: "checkbox" });
        } else {
          field = el("input", { type: "text", inputmode: "numeric", autocomplete: "off", class: "score-input" });
        }
        paramInputs[param.id] = { field, param };
        return el("label", { class: "param-row" }, param.label, field);
      });

      const submitBtn = el("button", {
        type: "button", class: "btn-action",
        onclick: () => onConfirmSpecial(move),
      }, "Zapsat: " + move.label);
      const cancelBtn = el("button", {
        type: "button", class: "btn-back",
        onclick: () => {
          specialState.moveId = null;
          setNormalDisabled(false);
          renderSpecialForm(null);
          refreshMoveButtons();
        },
      }, "Zrušit");

      specialArea.append(...rows, specialErrorEl, submitBtn, cancelBtn);
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
          const { field } = paramInputs[param.id];
          if (param.type === "bool") {
            flags[param.id] = !!field.checked;
            continue;
          }
          const raw = field.value.trim();
          const err = validateSeqParam(param.id, raw);
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

    const moveButtons = specialMoves.map((move) => el("button", {
      type: "button", class: "btn-special btn-move-" + move.id,
      onclick: () => {
        specialState.moveId = specialState.moveId === move.id ? null : move.id;
        setNormalDisabled(!!specialState.moveId);
        if (specialState.moveId) renderSpecialForm(move);
        else renderSpecialForm(null);
        refreshMoveButtons();
      },
    }, (move.icon ? move.icon + " " : "") + move.label));

    function refreshMoveButtons() {
      moveButtons.forEach((btn, i) => {
        btn.classList.toggle("active", specialMoves[i].id === specialState.moveId);
      });
    }

    const bannerChildren = [
      el("p", { class: "turn-player" }, "Teď hraje: " + (player ? player.name : "?")),
    ];
    if (next.note) bannerChildren.push(el("p", { class: "turn-note" }, next.note));

    const banner = el("div", { class: "turn-banner" }, ...bannerChildren);
    banner.addEventListener("click", () => { if (!input.disabled) input.focus(); });

    const panel = el("aside", { class: "input-panel" },
      banner,
      el("div", { class: "input-controls" }, input, signBtn, ...quickBtns),
      errorEl,
      confirmBtn,
      moveButtons.length ? el("div", { class: "special-buttons" }, ...moveButtons) : null,
      specialArea,
      undoBtn);

    setTimeout(() => { if (!input.disabled) input.focus(); }, 0);

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
    const headline = el("p", { class: "result-headline" }, "Stupně vítězů");

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
        el("span", { class: "rank-total" }, String(r.total)));
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
            g.Score.Engine.unfreeze(game);
            g.Score.Engine.undo(game);
            await g.Score.DB.putGame(game);
            await rerender();
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
  function renderInputPanel(game, def, state, rerender, busyRef, undoBtn) {
    if (def.inputModel !== "allPlayersAtOnce") {
      return renderSequentialPanel(game, def, state, rerender, busyRef, undoBtn);
    }

    const next = state.next;
    const roundIndex = next.roundIndex;
    const starterIndex = next.starterIndex;

    const inputs = {}; // playerId -> input element
    const errorEls = {}; // playerId -> error element
    const caboState = { playerId: null };
    // aktivace jakéhokoli speciálu z def.specialMoves deaktivuje číselná pole (max 1 aktivní)
    const specialState = { moveId: null, playerId: null };
    const hasCaboFlag = def.id === "cabo"; // toggle „Kabo" je specifický pro CABO, ne obecná specialMove
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

      if (hasCaboFlag) {
        const caboBtn = el("button", {
          type: "button", class: "btn-special btn-cabo",
          onclick: () => {
            caboState.playerId = caboState.playerId === p.id ? null : p.id;
            refreshToggleStates();
            if (!input.disabled) input.focus();
          },
        }, "📢 Kabo");
        controls.push(caboBtn);
        caboBtn._pid = p.id;
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
        for (const btn of row.querySelectorAll(".btn-cabo")) {
          btn.classList.toggle("active", btn._pid === caboState.playerId);
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

        // CABO: běžné kolo končí voláním „Kabo!" — bez označeného volajícího
        // kolo nejde zapsat (kamikaze kolo volajícího nevyžaduje).
        if (hasCaboFlag && !specialActive && !caboState.playerId) {
          panelError.textContent = "Označ hráče, který zahlásil Kabo.";
          return;
        }
        const records = [];
        let firstErrorInput = null;

        for (const p of game.players) {
          const flags = {};
          if (caboState.playerId === p.id) flags.cabo = true;

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

          const raw = inputs[p.id].value.trim();
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
      el("h2", null, (roundIndex + 1) + ". kolo"),
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
    async render(container, { gameId }) {
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

      async function rerender() {
        await gameScreen.render(container, { gameId });
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
            g.Score.Engine.undo(game);
            await g.Score.DB.putGame(game);
            await rerender();
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
        ? renderTable(tableState, game, def)
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
        : renderInputPanel(game, def, state, rerender, busyRef, undoBtn);

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

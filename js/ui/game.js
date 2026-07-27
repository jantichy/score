(function (g) {
  "use strict";
  const el = g.Score.dom.el;
  const domClear = g.Score.dom.clear;

  const FLAG_META = {
    cabo: { icon: "📢", title: "Volal Kabo" },
    caboFail: { icon: "❗", title: "Neúspěšné Kabo (+penalizace)" },
    caboSuccess: { icon: "✅", title: "Úspěšné Kabo" },
    kamikaze: { icon: "💥", title: "Kamikaze" },
    kamikazeVictim: { icon: "➕50", title: "Kamikaze — oběť (+50)" },
    halved: { icon: "➗", title: "Přesně 100 → 50" },
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

  function ordinalRanking(playerIds, totals, direction) {
    const sorted = [...playerIds].sort((a, b) =>
      direction === "min" ? totals[a] - totals[b] : totals[b] - totals[a]);
    const ranks = {};
    sorted.forEach((pid, idx) => {
      if (idx === 0) { ranks[pid] = 1; return; }
      const prev = sorted[idx - 1];
      ranks[pid] = totals[pid] === totals[prev] ? ranks[prev] : idx + 1;
    });
    // seskup sdílená místa do "N.–M."
    const byRank = new Map();
    for (const pid of sorted) {
      if (!byRank.has(ranks[pid])) byRank.set(ranks[pid], []);
      byRank.get(ranks[pid]).push(pid);
    }
    const label = {};
    for (const [rank, pids] of byRank) {
      const last = rank + pids.length - 1;
      label[rank] = rank === last ? rank + "." : rank + ".–" + last + ".";
      for (const pid of pids) label[pid] = label[rank];
    }
    return label;
  }

  function flagCell(playerId, roundIndex, roundFlags, totalEvents) {
    const icons = [];
    const flagsForPlayer = (roundFlags && roundFlags[playerId]) || [];
    for (const flag of flagsForPlayer) {
      const meta = FLAG_META[flag];
      if (meta) icons.push(el("span", { class: "cell-flag", title: meta.title }, meta.icon));
    }
    for (const ev of totalEvents) {
      if (ev.roundIndex === roundIndex && ev.playerId === playerId) {
        const meta = FLAG_META[ev.type];
        if (meta) icons.push(el("span", { class: "cell-flag", title: meta.title }, meta.icon));
      }
    }
    return icons;
  }

  function renderTable(state, game, def) {
    const playerIds = game.players.map((p) => p.id);
    // zvýraznění příštího zápisu (jen pro sekvenční tahy, viz Task 12)
    const nextTurn = state.next && state.next.type === "turn" ? state.next : null;

    const headerRow = el("tr", null,
      el("th", { class: "col-round" }, "#"),
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
        const valueText = value === undefined ? "" : String(value);
        const isNeg = typeof value === "number" && value < 0;
        const cls = [isNeg ? "neg" : null, isNextCell ? "next-cell" : null].filter(Boolean).join(" ") || null;
        return el("td", { class: cls }, valueText, ...flags);
      });
      bodyRows.push(el("tr", null, el("td", { class: "col-round" }, String(i + 1)), ...cells));
    }

    const totalsRow = el("tr", { class: "row-totals" },
      el("td", { class: "col-round" }, "Součet"),
      ...playerIds.map((pid) => {
        const total = state.totals[pid];
        return el("td", { class: total < 0 ? "neg" : null }, String(total));
      }));

    const rankLabel = ordinalRanking(playerIds, state.totals, def.winnerDirection);
    const rankRow = el("tr", { class: "row-ranking" },
      el("td", { class: "col-round" }, "Pořadí"),
      ...playerIds.map((pid) => el("td", null, rankLabel[pid])));

    return el("section", { class: "score-table" },
      el("table", null,
        el("thead", null, headerRow),
        el("tbody", null, ...bodyRows),
        el("tfoot", null, totalsRow, rankRow)));
  }

  function renderSequentialPanel(game, def, state, rerender, busyRef) {
    const next = state.next;
    const player = game.players.find((p) => p.id === next.playerId);
    const specialMoves = def.specialMoves || [];

    const specialState = { moveId: null };
    const paramInputs = {}; // paramId -> input element (pro aktivní speciál)
    const errorEl = el("p", { class: "field-error" });
    const specialErrorEl = el("p", { class: "field-error" });

    const input = el("input", {
      type: "text", inputmode: "numeric", autocomplete: "off",
      class: "score-input score-input-wide",
    });

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
      for (const btn of quickBtns) btn.disabled = disabled;
    }

    async function onConfirmTurn() {
      if (busyRef.value) return;
      busyRef.value = true;
      confirmBtn.disabled = true;
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

    const panel = el("aside", { class: "input-panel" },
      el("div", { class: "turn-banner" }, ...bannerChildren),
      el("div", { class: "input-row" }, input, ...quickBtns),
      errorEl,
      confirmBtn,
      moveButtons.length ? el("div", { class: "special-buttons" }, ...moveButtons) : null,
      specialArea);

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

  function joinNames(names) {
    if (names.length <= 1) return names.join("");
    if (names.length === 2) return names[0] + " a " + names[1];
    return names.slice(0, -1).join(", ") + " a " + names[names.length - 1];
  }

  function renderResultPanel(game, def, result, canFix, rerender, busyRef) {
    const ranking = result.ranking;
    const winnerNames = result.winnerIds.map((id) => {
      const r = ranking.find((x) => x.playerId === id);
      return r ? r.name : "?";
    });

    const headline = result.tie
      ? el("p", { class: "result-headline" }, "Remíza: " + joinNames(winnerNames))
      : el("p", { class: "result-headline" }, "🏆 " + winnerNames[0]);

    const labels = rankLabels(ranking);
    const rows = ranking.map((r) => el("tr", null,
      el("td", null, labels[r.rank]),
      el("td", null, r.name),
      el("td", null, String(r.total))));

    const table = el("table", { class: "result-table" }, el("tbody", null, ...rows));

    const homeBtn = el("button", {
      type: "button", class: "btn-action", style: "--accent:" + def.accentColor,
      onclick: () => g.App.show("home"),
    }, "← Domů");

    const children = [headline, table, homeBtn];

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

  function renderInputPanel(container, game, def, state, rerender, busyRef) {
    if (def.inputModel !== "allPlayersAtOnce") {
      return renderSequentialPanel(game, def, state, rerender, busyRef);
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

    function setNumericInputsDisabled() {
      const active = !!specialState.playerId;
      for (const pid of Object.keys(inputs)) {
        inputs[pid].disabled = active;
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
      const rowChildren = [
        el("span", { class: "input-player-name" },
          p.name, showStarter ? el("span", { class: "starter-badge" }, " začíná") : null),
        input,
      ];

      if (hasCaboFlag) {
        const caboBtn = el("button", {
          type: "button", class: "btn-special btn-cabo",
          onclick: () => {
            caboState.playerId = caboState.playerId === p.id ? null : p.id;
            refreshToggleStates();
          },
        }, "📢 Kabo");
        rowChildren.push(caboBtn);
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
          },
        }, (move.icon ? move.icon + " " : "") + move.label);
        btn._pid = p.id;
        btn._moveId = move.id;
        rowChildren.push(btn);
      }

      return el("div", { class: "input-row" }, ...rowChildren, errorEl);
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

    async function onConfirm() {
      // re-entrancy guard: brání dvojímu zápisu kola při dvojkliku (viz undo handler v render())
      if (busyRef.value) return;
      busyRef.value = true;
      confirmBtn.disabled = true;
      try {
        for (const pid of Object.keys(errorEls)) errorEls[pid].textContent = "";

        const specialActive = !!specialState.playerId;
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
      }
    }

    const panel = el("aside", { class: "input-panel" },
      el("h2", null, "Kolo " + (roundIndex + 1)),
      ...playerRows,
      confirmBtn);

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
        class: "btn-back btn-undo",
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
      }, "Zpět");

      const header = el("header", { class: "game-header" },
        el("button", {
          class: "btn-back",
          onclick: () => g.App.show("home"),
        }, "← Domů"),
        el("h1", { style: "--accent:" + def.accentColor },
          el("span", { class: "tile-icon" }, def.icon),
          " " + def.name + (game.label ? " — " + game.label : "")),
        undoBtn);

      // tabulka: dohraná hra (wasFinished) čte jen ze zamrzlého snímku — NE z derive —
      // aby historie zůstala neměnná i po budoucí úpravě pravidel dané hry.
      const tableState = wasFinished
        ? {
          rounds: game.frozenResult.rounds,
          totals: game.frozenResult.totals,
          totalEvents: game.frozenResult.totalEvents,
          roundsPlanned: null,
          next: null,
        }
        : state;
      const table = renderTable(tableState, game, def);

      const panel = isFinished
        ? renderResultPanel(game, def, wasFinished ? game.frozenResult : state, !wasFinished, rerender, busyRef)
        : renderInputPanel(container, game, def, state, rerender, busyRef);

      container.append(
        header,
        el("div", { class: "game-body" }, table, panel));
    },
  };

  g.Score.UI = g.Score.UI || {};
  g.Score.UI.game = gameScreen;
})(globalThis);

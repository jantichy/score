(function (g) {
  "use strict";
  const el = g.Score.dom.el;

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
    const headerRow = el("tr", null,
      el("th", { class: "col-round" }, "#"),
      ...game.players.map((p) => el("th", null, p.name)));

    const rowCount = state.roundsPlanned !== null
      ? state.roundsPlanned
      : state.rounds.length;

    const bodyRows = [];
    for (let i = 0; i < rowCount; i++) {
      const round = state.rounds[i];
      const cells = playerIds.map((pid) => {
        if (!round) return el("td", null);
        const value = round.scores[pid];
        const flags = flagCell(pid, round.roundIndex, round.flags, state.totalEvents);
        const valueText = value === undefined ? "" : String(value);
        const isNeg = typeof value === "number" && value < 0;
        return el("td", { class: isNeg ? "neg" : null }, valueText, ...flags);
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

  function renderSequentialPlaceholder() {
    return el("aside", { class: "input-panel" },
      el("p", null, "Vstup po jednom doplní další úkol."));
  }

  function renderInputPanel(container, game, def, state, rerender) {
    if (state.finished) {
      return el("aside", { class: "input-panel" }, el("p", null, "Konec hry"));
    }
    if (def.inputModel !== "allPlayersAtOnce") {
      return renderSequentialPlaceholder();
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

      const rowChildren = [
        el("span", { class: "input-player-name" },
          p.name, p.order === starterIndex ? el("span", { class: "starter-badge" }, " začíná") : null),
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
      rerender();
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
      const state = g.Score.Engine.derive(game, def);

      async function rerender() {
        await gameScreen.render(container, { gameId });
      }

      const undoBtn = el("button", {
        class: "btn-back btn-undo",
        disabled: game.log.length === 0 ? "disabled" : null,
        onclick: async () => {
          g.Score.Engine.undo(game);
          await g.Score.DB.putGame(game);
          rerender();
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

      const table = renderTable(state, game, def);
      const panel = renderInputPanel(container, game, def, state, rerender);

      container.append(
        header,
        el("div", { class: "game-body" }, table, panel));
    },
  };

  g.Score.UI = g.Score.UI || {};
  g.Score.UI.game = gameScreen;
})(globalThis);

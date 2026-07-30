(function (g) {
  "use strict";
  const el = g.Score.dom.el;
  const clear = g.Score.dom.clear;

  function isBoolType(type) {
    return type === "bool" || type === "boolean";
  }

  function optionValueMatches(optValue, raw) {
    return String(optValue) === raw;
  }

  function parseIntStrict(raw) {
    if (typeof raw !== "string" || !/^-?\d+$/.test(raw.trim())) return NaN;
    return parseInt(raw.trim(), 10);
  }

  function validateNumberValue(v, value) {
    if (typeof value !== "number" || Number.isNaN(value)) return "Zadej platné celé číslo.";
    if (!Number.isInteger(value)) return "Zadej celé číslo.";
    if (typeof v.min === "number" && value < v.min) return "Zadej číslo ≥ " + v.min + ".";
    if (typeof v.step === "number" && v.step > 0 && value % v.step !== 0)
      return "Zadej násobek " + v.step + ".";
    return null;
  }

  // Postaví pole pro jednu variantu. Vrátí { node, getValue, errorEl }.
  function buildVariantField(v, current) {
    const errorEl = el("p", { class: "field-error" });
    let node;
    let getValue;

    if (v.type === "enum") {
      if (v.options.length <= 3) {
        const radios = v.options.map((opt) =>
          el("label", { class: "radio-option" },
            el("input", {
              type: "radio", name: "variant-" + v.id,
              checked: opt.value === current || String(opt.value) === String(current) ? "checked" : null,
              onchange: () => { current = opt.value; },
            }),
            " " + opt.label));
        node = el("div", { class: "variant-radio-group" }, ...radios);
        getValue = () => current;
      } else {
        const select = el("select", {
          onchange: (e) => {
            const opt = v.options.find((o) => optionValueMatches(o.value, e.target.value));
            current = opt ? opt.value : current;
          },
        }, ...v.options.map((opt) =>
          el("option", {
            value: String(opt.value),
            selected: opt.value === current ? "selected" : null,
          }, opt.label)));
        node = select;
        getValue = () => current;
      }
    } else if (isBoolType(v.type)) {
      const checkbox = el("input", {
        type: "checkbox",
        checked: current ? "checked" : null,
      });
      node = el("label", { class: "checkbox-option" }, checkbox, " " + v.label);
      getValue = () => checkbox.checked;
    } else if (v.type === "number" && v.allowCustom) {
      const presetMatch = (v.options || []).some((opt) => opt.value === current);
      const customInput = el("input", {
        type: "text", inputmode: "numeric", autocomplete: "off",
        disabled: presetMatch ? "disabled" : null,
        value: presetMatch ? "" : String(current),
      });
      let selected = presetMatch ? current : "custom";
      const presetRadios = (v.options || []).map((opt) =>
        el("label", { class: "radio-option" },
          el("input", {
            type: "radio", name: "variant-" + v.id,
            checked: opt.value === current ? "checked" : null,
            onchange: () => { selected = opt.value; customInput.disabled = true; },
          }),
          " " + opt.label));
      const customRadio = el("input", {
        type: "radio", name: "variant-" + v.id,
        checked: !presetMatch ? "checked" : null,
        onchange: () => { selected = "custom"; customInput.disabled = false; customInput.focus(); },
      });
      node = el("div", { class: "variant-radio-group" },
        ...presetRadios,
        el("label", { class: "radio-option" }, customRadio, " Vlastní", customInput));
      getValue = () => (selected === "custom" ? parseIntStrict(customInput.value) : selected);
    } else if (v.type === "number") {
      const input = el("input", {
        type: "text", inputmode: "numeric", autocomplete: "off",
        value: String(current),
      });
      node = input;
      getValue = () => parseIntStrict(input.value);
    } else {
      // neznámý typ — fallback na text
      const input = el("input", { type: "text", value: String(current) });
      node = input;
      getValue = () => input.value;
    }

    return { node, getValue, errorEl, def: v };
  }

  const setup = {
    async render(container, { gameTypeId }) {
      const def = g.Score.Games.get(gameTypeId);
      const lastVariantsAll = (await g.Score.DB.getMeta("lastVariants")) || {};
      const initialVariants = g.Score.Games.mergeVariants(def, lastVariantsAll[gameTypeId]);

      // Předvyplnění hráčů (počet, jména i pořadí): z naposledy hrané hry
      // stejného typu; u úplně první hry daného typu z naposledy hrané hry
      // KTERÉHOKOLIV typu (oříznuté na maximum hráčů této hry). Prázdná pole
      // jen když se v celé aplikaci ještě nikdy nic nehrálo.
      const games = await g.Score.DB.allGames();
      const lastGame = g.Score.UI.lastGameOf(games, gameTypeId);
      // Bez historie tohoto typu se rozcestník přeskakuje (viz hub.js) —
      // „← Zpět" by se na něj jen zacyklil, proto se v tom případě nekreslí.
      const hasHistory = !!lastGame;
      const sourceGame = lastGame || games.reduce(
        (best, game) => (!best || game.lastPlayedAt > best.lastPlayedAt ? game : best), null);
      // Hráči vč. barev (docs/specs/2026-07-28-barvy-hracu.md): barvy se dědí
      // ze zdrojové hry spolu se jmény; nový hráč dostane první volnou z palety.
      const PLAYER_COLORS = g.Score.dom.PLAYER_COLORS;
      function freeColor(list) {
        const used = new Set(list.map((p) => p.color));
        const free = PLAYER_COLORS.find((c) => !used.has(c.id));
        return (free || PLAYER_COLORS[list.length % PLAYER_COLORS.length]).id;
      }
      const players = sourceGame
        ? [...sourceGame.players].sort((a, b) => a.order - b.order)
            .map((p) => ({ name: p.name, color: p.color }))
            .slice(0, def.playerRange.max)
        : [];
      while (players.length < def.playerRange.min)
        players.push({ name: "", color: freeColor(players) });
      let dragIndex = null;
      let openColorIndex = null; // index hráče s rozbaleným popoverem barev
      const playersError = el("p", { class: "field-error" });

      const playersList = el("div", { class: "player-chips" });
      const addBtn = el("button", {
        type: "button", class: "btn-add-player",
        onclick: () => {
          players.push({ name: "", color: freeColor(players) });
          openColorIndex = null;
          renderPlayers();
          const inputs = playersList.querySelectorAll("input");
          inputs[inputs.length - 1].focus();
        },
      }, "+ Přidat hráče");

      function focusColorBtn(i) {
        const dots = playersList.querySelectorAll(".btn-color");
        if (dots[i]) dots[i].focus();
      }

      function renderPlayers() {
        clear(playersList);
        players.forEach((player, i) => {
          const nameInput = el("input", {
            type: "text", autocomplete: "off",
            placeholder: "Hráč " + (i + 1), value: player.name,
            oninput: (e) => { players[i].name = e.target.value; },
          });
          // Puntík barvy mezi jménem a mazacím tlačítkem; klik rozbalí popover
          // s celou paletou (žádné míchátko). Duplicitní volba se nevaliduje.
          const colorMeta = PLAYER_COLORS.find((c) => c.id === player.color);
          const colorBtn = el("button", {
            type: "button", class: "btn-color pc-" + player.color,
            "aria-label": "Barva hráče" + (colorMeta ? ": " + colorMeta.label : ""),
            "aria-expanded": openColorIndex === i ? "true" : "false",
            onclick: () => {
              openColorIndex = openColorIndex === i ? null : i;
              renderPlayers();
              focusColorBtn(i);
            },
          });
          const popover = openColorIndex !== i ? null : el("div", {
            class: "color-popover",
            onkeydown: (ev) => {
              if (ev.key !== "Escape") return;
              openColorIndex = null;
              renderPlayers();
              focusColorBtn(i);
            },
          }, ...PLAYER_COLORS.map((c) => el("button", {
            type: "button",
            class: "color-swatch pc-" + c.id + (c.id === player.color ? " selected" : ""),
            "aria-label": c.label,
            onclick: () => {
              players[i].color = c.id;
              openColorIndex = null;
              renderPlayers();
              focusColorBtn(i);
            },
          }, c.id === player.color ? "✓" : null)));
          const removeBtn = el("button", {
            type: "button", class: "btn-remove", "aria-label": "Odebrat hráče",
            disabled: players.length <= def.playerRange.min ? "disabled" : null,
            onclick: () => { players.splice(i, 1); openColorIndex = null; renderPlayers(); },
          }, "×");
          const handle = el("span", {
            class: "drag-handle", title: "Přetažením změníš pořadí",
          }, "⠿");
          const chip = el("div", { class: "player-chip" },
            handle, nameInput, colorBtn, popover, removeBtn);

          // Drag & drop pořadí přes Pointer Events — jednotně myš i dotyk
          // (prst na úchytu ⠿ chip „chytne" a táhne; touch-action: none na
          // úchytu brání scrollování stránky během tažení).
          function chipUnderPointer(ev) {
            const hit = document.elementFromPoint(ev.clientX, ev.clientY);
            return hit ? hit.closest(".player-chip") : null;
          }
          function clearDragMarks() {
            for (const c of playersList.querySelectorAll(".player-chip")) {
              c.classList.remove("dragging", "drop-target");
            }
          }
          handle.addEventListener("pointerdown", (ev) => {
            ev.preventDefault();
            dragIndex = i;
            chip.classList.add("dragging");
            handle.setPointerCapture(ev.pointerId);
          });
          handle.addEventListener("pointermove", (ev) => {
            if (dragIndex === null) return;
            const target = chipUnderPointer(ev);
            for (const c of playersList.querySelectorAll(".player-chip")) {
              c.classList.toggle("drop-target", c === target && c !== chip);
            }
          });
          handle.addEventListener("pointerup", (ev) => {
            if (dragIndex === null) return;
            const target = chipUnderPointer(ev);
            const chips = [...playersList.querySelectorAll(".player-chip")];
            const targetIdx = target ? chips.indexOf(target) : -1;
            const fromIdx = dragIndex;
            dragIndex = null;
            clearDragMarks();
            if (targetIdx >= 0 && targetIdx !== fromIdx) {
              const [moved] = players.splice(fromIdx, 1);
              players.splice(targetIdx, 0, moved);
              openColorIndex = null;
              renderPlayers();
            }
          });
          handle.addEventListener("pointercancel", () => {
            dragIndex = null;
            clearDragMarks();
          });

          playersList.append(chip);
        });
        addBtn.disabled = players.length >= def.playerRange.max;
        playersList.append(addBtn);
      }
      renderPlayers();

      // Klik/tap kamkoli mimo popover barev ho zavře. Posluchač sedí na
      // kontejneru obrazovky (ne na document), takže zaniká spolu s ní.
      container.addEventListener("pointerdown", (ev) => {
        if (openColorIndex === null) return;
        if (ev.target && ev.target.closest &&
            ev.target.closest(".color-popover, .btn-color")) return;
        openColorIndex = null;
        renderPlayers();
      });

      const variantFields = def.variants.map((v) => buildVariantField(v, initialVariants[v.id]));
      const variantsSection = el("div", { class: "setup-variants" },
        ...variantFields.map((f) =>
          el("div", { class: "variant-field" },
            // U typu "bool" nese popisek text uvnitř f.node (checkbox-option label z
            // buildVariantField) — samostatný "variant-label" by ho vykreslil 2×.
            isBoolType(f.def.type) ? null : el("label", { class: "variant-label" }, f.def.label),
            f.def.help ? el("p", { class: "variant-help" }, f.def.help) : null,
            f.node,
            f.errorEl)));

      const submitBtn = el("button", {
        type: "button", class: "btn-start", style: "--accent:" + def.accentColor,
        onclick: onSubmit,
      }, "Začít hru");

      async function onSubmit() {
        let hasError = false;
        playersError.textContent = "";

        const trimmed = players.map((p) => p.name.trim());
        if (trimmed.some((n) => n === "")) {
          playersError.textContent = "Vyplň jména všech hráčů.";
          hasError = true;
        } else if (new Set(trimmed).size !== trimmed.length) {
          playersError.textContent = "Jména hráčů se nesmí opakovat.";
          hasError = true;
        } else if (trimmed.length < def.playerRange.min || trimmed.length > def.playerRange.max) {
          playersError.textContent = "Počet hráčů musí být mezi " + def.playerRange.min +
            " a " + def.playerRange.max + ".";
          hasError = true;
        }

        const variantValues = {};
        for (const f of variantFields) {
          f.errorEl.textContent = "";
          const value = f.getValue();
          if (f.def.type === "number") {
            const err = validateNumberValue(f.def, value);
            if (err) { f.errorEl.textContent = err; hasError = true; }
          }
          variantValues[f.def.id] = value;
        }

        if (hasError) return;

        const game = g.Score.Engine.newGame({
          def, players: players.map((p, i) => ({ name: trimmed[i], color: p.color })),
          variants: variantValues, now: Date.now(),
        });
        await g.Score.DB.putGame(game);

        const allLastVariants = (await g.Score.DB.getMeta("lastVariants")) || {};
        allLastVariants[gameTypeId] = variantValues;
        await g.Score.DB.setMeta("lastVariants", allLastVariants);

        g.App.show("game", { gameId: game.id });
      }

      container.append(
        g.Score.dom.pageHeader({
          icon: def.icon, title: def.name, accent: def.accentColor,
          onBack: hasHistory ? () => g.App.show("hub", { gameTypeId }) : null,
        }),
        el("h2", { class: "section-title" }, "Hráči"),
        playersList,
        playersError,
        variantsSection,
        submitBtn);
    },
  };

  g.Score.UI = g.Score.UI || {};
  g.Score.UI.setup = setup;
})(globalThis);

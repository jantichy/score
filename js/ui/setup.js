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

      // Předvyplnění hráčů (počet, jména i pořadí) z naposledy hrané hry
      // stejného typu; bez předchozí hry prázdná pole v minimálním počtu.
      const games = await g.Score.DB.allGames();
      const lastGame = g.Score.UI.lastGameOf(games, gameTypeId);
      let names = lastGame
        ? [...lastGame.players].sort((a, b) => a.order - b.order).map((p) => p.name)
        : Array.from({ length: def.playerRange.min }, () => "");
      let dragIndex = null;
      const playersError = el("p", { class: "field-error" });

      const playersList = el("div", { class: "player-chips" });
      const addBtn = el("button", {
        type: "button", class: "btn-add-player",
        onclick: () => { names.push(""); renderPlayers(); },
      }, "+ Přidat hráče");

      function renderPlayers() {
        clear(playersList);
        names.forEach((name, i) => {
          const nameInput = el("input", {
            type: "text", autocomplete: "off",
            placeholder: "Hráč " + (i + 1), value: name,
            oninput: (e) => { names[i] = e.target.value; },
          });
          const removeBtn = el("button", {
            type: "button", class: "btn-remove", "aria-label": "Odebrat hráče",
            disabled: names.length <= def.playerRange.min ? "disabled" : null,
            onclick: () => { names.splice(i, 1); renderPlayers(); },
          }, "×");
          const handle = el("span", {
            class: "drag-handle", title: "Přetažením změníš pořadí",
          }, "⠿");
          const chip = el("div", { class: "player-chip" }, handle, nameInput, removeBtn);

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
              const [moved] = names.splice(fromIdx, 1);
              names.splice(targetIdx, 0, moved);
              renderPlayers();
            }
          });
          handle.addEventListener("pointercancel", () => {
            dragIndex = null;
            clearDragMarks();
          });

          playersList.append(chip);
        });
        addBtn.disabled = names.length >= def.playerRange.max;
        playersList.append(addBtn);
      }
      renderPlayers();

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

        const trimmed = names.map((n) => n.trim());
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
          def, players: trimmed, variants: variantValues, now: Date.now(),
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
          onBack: () => g.App.show("hub", { gameTypeId }),
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

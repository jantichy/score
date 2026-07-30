(function (g) {
  "use strict";
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") node.className = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function")
        node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Klávesová dostupnost pro prvky, které nejsou nativní <button>/<a>, ale mají
  // role="button" a onclick handler (viz home.js .tile, history.js .history-item).
  // Přidá tabindex a Enter/mezerník = click().
  // Kontroluje e.target === node, aby se předešlo dvojímu spuštění, když je uvnitř
  // vnořené interaktivní dítě (např. tlačítka v history-item) a klávesová událost
  // probublá nahoru z jeho vlastního focusu.
  function pressable(node) {
    node.tabIndex = 0;
    node.addEventListener("keydown", (ev) => {
      if (ev.target !== node) return;
      if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
        ev.preventDefault();
        node.click();
      }
    });
    return node;
  }

  // Jednotná hlavička stránky: vlevo titulek (na homepage „Score", jinde název hry
  // s ikonou, bez dodatků), vpravo navigace — volitelné „← Zpět" a vždy „Domů"
  // (mimo homepage). Jediné společné místo pro návrat domů napříč aplikací.
  function pageHeader({ icon, title, accent, onBack, home }) {
    const nav = [];
    if (onBack) nav.push(el("button", {
      type: "button", class: "btn-nav", onclick: onBack,
    }, "← Zpět"));
    if (!home) nav.push(el("button", {
      type: "button", class: "btn-nav", onclick: () => g.App.show("home"),
    }, "Domů"));
    return el("header", {
      class: "page-header",
      style: accent ? "--accent:" + accent : null,
    },
      el("h1", null,
        icon ? el("span", { class: "tile-icon" }, icon) : null,
        icon ? " " : null,
        title),
      nav.length ? el("nav", { class: "top-nav" }, ...nav) : null);
  }

  // Typografický zápis čísel/rozpisů bodů: ASCII spojovník z dat (String(-600),
  // display rozpisy pluginů) se pro zobrazení nahrazuje skutečným minusem U+2212.
  function fmtScore(value) {
    return String(value).replace(/-/g, "−");
  }

  // Paleta barev hráčů (viz docs/specs/2026-07-28-barvy-hracu.md): hráč nese
  // v DB i v JS jen token ("red", "blue", …); prvek dostane třídu pc-<token>
  // a konkrétní odstíny (pastelový --pc, sytější --pc-strong pro graf přes
  // hranici) definuje výhradně CSS v app.css. Popisek je pro aria-label.
  const PLAYER_COLORS = [
    { id: "red", label: "červená" },
    { id: "orange", label: "oranžová" },
    { id: "yellow", label: "žlutá" },
    { id: "green", label: "zelená" },
    { id: "teal", label: "tyrkysová" },
    { id: "blue", label: "modrá" },
    { id: "purple", label: "fialová" },
    { id: "pink", label: "růžová" },
  ];

  g.Score = g.Score || {};
  g.Score.dom = { el, clear, pressable, pageHeader, fmtScore, PLAYER_COLORS };
})(globalThis);

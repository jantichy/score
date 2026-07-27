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
  // role="button" a onclick handler (viz home.js .btn-continue, hub.js .hub-unfinished,
  // history.js .history-item). Přidá tabindex a Enter/mezerník = click().
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

  g.Score = g.Score || {};
  g.Score.dom = { el, clear, pressable };
})(globalThis);

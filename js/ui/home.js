(function (g) {
  "use strict";
  const el = g.Score.dom.el;

  function lastGameOf(games, gameTypeId) {
    let last = null;
    for (const game of games) {
      if (game.gameTypeId !== gameTypeId) continue;
      if (!last || game.lastPlayedAt > last.lastPlayedAt) last = game;
    }
    return last;
  }

  // Sdílená dvojice akcí hry — stejné pořadí i vzhled na dlaždici (homepage)
  // i na rozcestníku: [Nová hra] [Pokračovat]. „Pokračovat" jen když je poslední
  // hra daného typu rozehraná.
  function gameActions(def, last) {
    const buttons = [
      el("button", {
        type: "button", class: "btn-game-action primary",
        onclick: (ev) => { ev.stopPropagation(); g.App.show("setup", { gameTypeId: def.id }); },
      }, "Nová hra"),
    ];
    if (last && last.status === "in_progress") {
      buttons.push(el("button", {
        type: "button", class: "btn-game-action",
        title: "Pokračovat v poslední rozehrané hře",
        onclick: (ev) => { ev.stopPropagation(); g.App.show("game", { gameId: last.id }); },
      }, "Pokračovat"));
    }
    return buttons;
  }

  function tileFor(def, games) {
    const last = lastGameOf(games, def.id);
    // Dlaždice je div[role=button] (ne <button>), protože uvnitř jsou skutečná
    // vnořená tlačítka akcí — <button> uvnitř <button> je nevalidní HTML.
    return g.Score.dom.pressable(el("div", {
      class: "tile", style: "--accent:" + def.accentColor, role: "button",
      onclick: () => g.App.show("hub", { gameTypeId: def.id }),
    },
      el("div", { class: "tile-head" },
        el("span", { class: "tile-icon" }, def.icon),
        el("span", { class: "tile-name" }, def.name)),
      el("div", { class: "tile-buttons" }, ...gameActions(def, last))));
  }

  const home = {
    async render(container) {
      const games = await g.Score.DB.allGames();
      const defs = g.Score.Games.list();
      const grid = el("div", { class: "tile-grid" },
        ...defs.map((def) => tileFor(def, games)));
      container.append(
        g.Score.dom.pageHeader({ title: "Score", home: true }),
        grid);
    },
  };

  g.Score.UI = g.Score.UI || {};
  g.Score.UI.home = home;
  g.Score.UI.lastGameOf = lastGameOf;
  g.Score.UI.gameActions = gameActions;
})(globalThis);

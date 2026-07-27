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

  function tileFor(def, games) {
    const last = lastGameOf(games, def.id);
    return el("button", {
      class: "tile", style: "--accent:" + def.accentColor,
      onclick: () => g.App.show("hub", { gameTypeId: def.id }),
    },
      el("span", { class: "tile-icon" }, def.icon),
      el("span", { class: "tile-name" }, def.name),
      last && last.status === "in_progress"
        ? g.Score.dom.pressable(el("span", {
            class: "btn-continue", role: "button",
            onclick: (ev) => { ev.stopPropagation(); g.App.show("game", { gameId: last.id }); },
          }, "Pokračovat"))
        : null);
  }

  const home = {
    async render(container) {
      const games = await g.Score.DB.allGames();
      const defs = g.Score.Games.list();
      const grid = el("div", { class: "tile-grid" },
        ...defs.map((def) => tileFor(def, games)));
      container.append(
        el("h1", {}, "Score"),
        grid);
    },
  };

  g.Score.UI = g.Score.UI || {};
  g.Score.UI.home = home;
  g.Score.UI.lastGameOf = lastGameOf;
})(globalThis);

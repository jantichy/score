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
    // Dlaždice je div[role=button] (ne <button>), protože uvnitř může být skutečné
    // vnořené tlačítko „Pokračovat" — <button> uvnitř <button> je nevalidní HTML.
    return g.Score.dom.pressable(el("div", {
      class: "tile", style: "--accent:" + def.accentColor, role: "button",
      onclick: () => g.App.show("hub", { gameTypeId: def.id }),
    },
      el("span", { class: "tile-icon" }, def.icon),
      el("span", { class: "tile-name" }, def.name),
      last && last.status === "in_progress"
        ? el("button", {
            type: "button", class: "btn-continue",
            onclick: (ev) => { ev.stopPropagation(); g.App.show("game", { gameId: last.id }); },
          }, "Pokračovat")
        : null));
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

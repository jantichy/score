(function (g) {
  "use strict";
  const el = g.Score.dom.el;
  const clear = g.Score.dom.clear;

  const hub = {
    async render(container, { gameTypeId }) {
      const def = g.Score.Games.get(gameTypeId);
      const games = await g.Score.DB.allGames();
      const last = g.Score.UI.lastGameOf(games, gameTypeId);

      async function rerender() {
        clear(container);
        await hub.render(container, { gameTypeId });
      }

      container.append(
        g.Score.dom.pageHeader({
          icon: def.icon, title: def.name, accent: def.accentColor,
        }),
        el("div", { class: "hub-actions", style: "--accent:" + def.accentColor },
          ...g.Score.UI.gameActions(def, last)),
        el("h2", { class: "section-title" }, "Historie"),
        g.Score.UI.historyList(games, gameTypeId, rerender));
    },
  };

  g.Score.UI = g.Score.UI || {};
  g.Score.UI.hub = hub;
})(globalThis);

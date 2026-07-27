(function (g) {
  "use strict";
  const el = g.Score.dom.el;

  function unfinishedLabel(count) {
    if (count === 1) return "1 nedohraná hra";
    if (count >= 2 && count <= 4) return count + " nedohrané hry";
    return count + " nedohraných her";
  }

  const hub = {
    async render(container, { gameTypeId }) {
      const def = g.Score.Games.get(gameTypeId);
      const games = await g.Score.DB.allGames();
      const last = g.Score.UI.lastGameOf(games, gameTypeId);
      const unfinishedCount = games.filter(
        (game) => game.gameTypeId === gameTypeId && game.status !== "finished").length;

      const actions = [];
      if (last && last.status === "in_progress") {
        actions.push(el("button", {
          class: "btn-action", style: "--accent:" + def.accentColor,
          onclick: () => g.App.show("game", { gameId: last.id }),
        }, "Pokračovat v poslední hře"));
      }
      actions.push(el("button", {
        class: "btn-action", style: "--accent:" + def.accentColor,
        onclick: () => g.App.show("setup", { gameTypeId }),
      }, "Nová hra"));
      actions.push(el("button", {
        class: "btn-action", style: "--accent:" + def.accentColor,
        onclick: () => g.App.show("history", { gameTypeId }),
      }, "Historie"));

      const rows = [
        el("h1", { style: "--accent:" + def.accentColor },
          el("span", { class: "tile-icon" }, def.icon),
          " " + def.name),
      ];
      if (unfinishedCount > 0) {
        rows.push(g.Score.dom.pressable(el("p", {
            class: "hub-unfinished", role: "button",
            onclick: () => g.App.show("history", { gameTypeId }),
          }, unfinishedLabel(unfinishedCount))));
      }
      rows.push(el("div", { class: "hub-actions" }, ...actions));
      rows.push(el("button", {
        class: "btn-back",
        onclick: () => g.App.show("home"),
      }, "← Zpět"));

      container.append(...rows);
    },
  };

  g.Score.UI = g.Score.UI || {};
  g.Score.UI.hub = hub;
})(globalThis);

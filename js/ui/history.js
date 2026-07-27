(function (g) {
  "use strict";
  const el = g.Score.dom.el;
  const domClear = g.Score.dom.clear;

  function itemLabel(game) {
    if (game.label) return game.label;
    return game.players.map((p) => p.name).join(", ");
  }

  function resultText(game) {
    const r = game.frozenResult;
    if (!r) return "";
    if (r.tie) {
      const names = r.winnerIds.map((id) => {
        const rank = r.ranking.find((x) => x.playerId === id);
        return rank ? rank.name : "?";
      });
      return "🏆 Remíza: " + names.join(", ");
    }
    const winner = r.ranking.find((x) => x.playerId === r.winnerIds[0]);
    return winner ? "🏆 " + winner.name + " — " + winner.total : "";
  }

  const history = {
    async render(container, { gameTypeId }) {
      const def = g.Score.Games.get(gameTypeId);
      const games = await g.Score.DB.allGames();
      const list = games
        .filter((game) => game.gameTypeId === gameTypeId)
        .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);

      async function rerender() {
        domClear(container);
        await history.render(container, { gameTypeId });
      }

      const rows = [
        el("h1", { style: "--accent:" + def.accentColor },
          el("span", { class: "tile-icon" }, def.icon),
          " " + def.name + " — historie"),
      ];

      if (list.length === 0) {
        rows.push(el("p", { class: "history-empty" }, "Zatím žádné hry."));
      } else {
        const items = list.map((game) => {
          const dateText = new Date(game.lastPlayedAt).toLocaleString("cs-CZ");
          const statusEl = game.status === "finished"
            ? el("span", { class: "history-result" }, resultText(game))
            : el("span", { class: "history-badge" }, "Nedohraná");

          const renameBtn = el("button", {
            type: "button", class: "btn-history-action",
            onclick: async (ev) => {
              ev.stopPropagation();
              const value = prompt("Název / štítek hry:", game.label || "");
              if (value === null) return;
              game.label = value === "" ? null : value;
              await g.Score.DB.putGame(game);
              await rerender();
            },
          }, "✏️ Přejmenovat");

          const deleteBtn = el("button", {
            type: "button", class: "btn-history-action btn-history-delete",
            onclick: async (ev) => {
              ev.stopPropagation();
              if (!confirm("Opravdu smazat tuto hru? Akce je nevratná.")) return;
              await g.Score.DB.deleteGame(game.id);
              await rerender();
            },
          }, "🗑 Smazat");

          return el("div", {
            class: "history-item", role: "button",
            onclick: () => g.App.show("game", { gameId: game.id }),
          },
            el("div", { class: "history-main" },
              el("span", { class: "history-date" }, dateText),
              el("span", { class: "history-label" }, itemLabel(game)),
              statusEl),
            el("div", { class: "history-actions" }, renameBtn, deleteBtn));
        });
        rows.push(el("div", { class: "history-list" }, ...items));
      }

      rows.push(el("button", {
        class: "btn-back",
        onclick: () => g.App.show("hub", { gameTypeId }),
      }, "← Zpět"));

      container.append(...rows);
    },
  };

  g.Score.UI = g.Score.UI || {};
  g.Score.UI.history = history;
})(globalThis);

(function (g) {
  "use strict";
  const el = g.Score.dom.el;

  function itemLabel(game) {
    if (game.label) return game.label;
    return game.players.map((p) => p.name).join(", ");
  }

  // Shrnutí výsledku pro řádek historie: u „podium" her se vypíší medailisté
  // (a případní vybouchlí s 🧨), u „winnerOnly" her jen vítěz s 🏆.
  function resultText(def, game) {
    const r = game.frozenResult;
    if (!r) return "";
    if ((def.rankingStyle || "podium") === "winnerOnly") {
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
    const badges = g.Score.UI.rankingBadges(def, game, r.ranking);
    return r.ranking
      .filter((x) => badges[x.playerId].icon)
      .map((x) => badges[x.playerId].icon + " " + x.name + " " + x.total)
      .join(" · ");
  }

  // Komponenta seznamu historie jednoho typu hry (vypisuje se přímo na rozcestníku).
  // games = všechny hry z DB; onChange se volá po smazání/přejmenování (překreslí stránku).
  function historyList(games, gameTypeId, onChange) {
    const def = g.Score.Games.get(gameTypeId);
    const list = games
      .filter((game) => game.gameTypeId === gameTypeId)
      .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);

    if (list.length === 0) {
      return el("p", { class: "history-empty" }, "Zatím žádné hry.");
    }

    const items = list.map((game) => {
      const dateText = new Date(game.lastPlayedAt).toLocaleString("cs-CZ");
      const statusEl = game.status === "finished"
        ? el("span", { class: "history-result" }, resultText(def, game))
        : el("span", { class: "history-badge" }, "Nedohraná");

      const renameBtn = el("button", {
        type: "button", class: "btn-history-action",
        title: "Přejmenovat / oštítkovat", "aria-label": "Přejmenovat",
        onclick: async (ev) => {
          ev.stopPropagation();
          const value = prompt("Název / štítek hry:", game.label || "");
          if (value === null) return;
          game.label = value === "" ? null : value;
          await g.Score.DB.putGame(game);
          await onChange();
        },
      }, "✏️");

      const deleteBtn = el("button", {
        type: "button", class: "btn-history-action btn-history-delete",
        title: "Smazat hru", "aria-label": "Smazat",
        onclick: async (ev) => {
          ev.stopPropagation();
          if (!confirm("Opravdu smazat tuto hru? Akce je nevratná.")) return;
          await g.Score.DB.deleteGame(game.id);
          await onChange();
        },
      }, "🗑");

      return g.Score.dom.pressable(el("div", {
        class: "history-item", role: "button",
        onclick: () => g.App.show("game", { gameId: game.id }),
      },
        el("div", { class: "history-main" },
          el("span", { class: "history-date" }, dateText),
          el("span", { class: "history-label" }, itemLabel(game)),
          statusEl),
        el("div", { class: "history-actions" }, renameBtn, deleteBtn)));
    });

    return el("div", { class: "history-list" }, ...items);
  }

  g.Score.UI = g.Score.UI || {};
  g.Score.UI.historyList = historyList;
})(globalThis);

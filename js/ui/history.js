(function (g) {
  "use strict";
  const el = g.Score.dom.el;

  // Úvod řádku historie: u nedohrané hry hráči s průběžnými body (v pořadí
  // u stolu), u dohrané celé pořadí s medailemi/odznaky a body
  // (např. "🥇 Marky 52 · 💥 Honza 107").
  function leadText(def, game) {
    if (game.status !== "finished" || !game.frozenResult) {
      const totals = g.Score.Engine.derive(game, def).totals;
      return game.players
        .map((p) => p.name + " " + g.Score.dom.fmtScore(totals[p.id] ?? 0))
        .join(" · ");
    }
    const r = game.frozenResult;
    const badges = g.Score.UI.rankingBadges(def, game, r.ranking);
    return r.ranking
      .map((x) => {
        const icon = badges[x.playerId].icon;
        return (icon ? icon + " " : "") + x.name + " " + g.Score.dom.fmtScore(x.total);
      })
      .join(" · ");
  }

  function dateText(ts) {
    return new Date(ts).toLocaleDateString("cs-CZ", {
      day: "numeric", month: "numeric", year: "numeric",
    });
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

      // Jeden řádek: [hráči / pořadí s medailemi] [label — jen když je]
      // [datum] [✏️] [🗑]. Label vyplňuje střed (flex: 1), takže datum
      // a tlačítka drží vpravo i bez něj.
      return g.Score.dom.pressable(el("div", {
        class: "history-item", role: "button",
        onclick: () => g.App.show("game", { gameId: game.id }),
      },
        el("span", { class: "history-lead" }, leadText(def, game)),
        el("span", { class: "history-label" }, game.label || ""),
        el("span", { class: "history-date" }, dateText(game.lastPlayedAt)),
        renameBtn, deleteBtn));
    });

    return el("div", { class: "history-list" }, ...items);
  }

  g.Score.UI = g.Score.UI || {};
  g.Score.UI.historyList = historyList;
})(globalThis);

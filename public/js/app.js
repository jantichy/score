(function (g) {
  "use strict";

  const App = {
    show(name, params) {
      const container = document.getElementById("app");
      g.Score.dom.clear(container);
      const screen = g.Score.UI && g.Score.UI[name];
      if (!screen) { container.textContent = `Obrazovka „${name}“ neexistuje.`; return; }
      // render() bývá async (DB dotazy) — bez zachycení by odmítnutý promise skončil jako
      // unhandled rejection a uživatel by zůstal koukat na prázdnou obrazovku.
      Promise.resolve(screen.render(container, params || {})).catch((err) => {
        container.textContent = "Chyba: " + err.message;
      });
    },
    async start() {
      await g.Score.DB.open();
      App.show("home");
    },
  };
  g.App = App;
  window.addEventListener("DOMContentLoaded", () => {
    App.start().catch((err) => {
      document.getElementById("app").textContent = "Chyba při startu: " + err.message;
    });
  });
})(globalThis);

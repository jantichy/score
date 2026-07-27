(function (g) {
  "use strict";

  const App = {
    show(name, params) {
      const container = document.getElementById("app");
      g.Score.dom.clear(container);
      const screen = g.Score.UI && g.Score.UI[name];
      if (!screen) { container.textContent = `Obrazovka „${name}“ neexistuje.`; return; }
      screen.render(container, params || {});
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

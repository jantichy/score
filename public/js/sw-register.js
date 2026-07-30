(function (g) {
  "use strict";
  const Score = (g.Score = g.Score || {});

  Score.sw = {
    // Jen na skutečném serveru — z file:// (dvojklik na index.html) service
    // workery nefungují a pokus o registraci by jen házel chybu do konzole.
    shouldRegister(env) {
      return Boolean(env && env.serviceWorker) && env.protocol !== "file:";
    },
    register(env) {
      if (!Score.sw.shouldRegister(env)) return;
      // Selhání registrace nesmí ovlivnit aplikaci — funguje i bez workeru.
      Promise.resolve(env.serviceWorker.register("sw.js")).catch(() => {});
    },
  };

  if (g.window && g.window.navigator && g.window.location) {
    Score.sw.register({
      serviceWorker: g.window.navigator.serviceWorker,
      protocol: g.window.location.protocol,
    });
  }
})(globalThis);

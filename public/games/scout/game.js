(function (g) {
  "use strict";

  g.Score.Games.register({
    id: "scout",
    name: "Scout",
    rulesVersion: 1,
    accentColor: "#8e5c9e",
    icon: "🎪",
    playerRange: { min: 2, max: 5 },
    endType: "fixedRounds",
    winnerDirection: "max",
    // Plnohodnotné pořadí dle součtu bodů → medaile 🥇🥈🥉.
    rankingStyle: "podium",
    inputModel: "allPlayersAtOnce",
    variants: [],
    specialMoves: [],
    validateInput(value) {
      return Number.isInteger(value) ? null : "Zadej celé číslo.";
    },
    rounds(playerCount) {
      return playerCount;
    },
    starter(roundIndex, playerCount) {
      return roundIndex % playerCount;
    },
    roundScores(records, ctx) {
      const scores = {};
      for (const rec of records) {
        scores[rec.playerId] = rec.value;
      }
      return { scores, flags: {} };
    },
    isGameOver(core, ctx) {
      return { finished: core.rounds.length >= ctx.def.rounds(ctx.players.length) };
    },
  });
})(globalThis);

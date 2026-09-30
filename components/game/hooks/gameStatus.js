const FINAL_MATCH_SPORTS = new Set([
  "Badminton",
  "TableTennis",
  "Table Tennis",
  "Tennis",
  "Pickleball",
]);

export const isRacketMatchFinal = (game) => {
  const sportName = game?.base?.sport;
  return FINAL_MATCH_SPORTS.has(sportName) && game?.sport?.matchStatus === "final";
};

export const isGameFinished = (game) => {
  if (!game) return false;
  return game?.base?.status === "finished" || isRacketMatchFinal(game);
};
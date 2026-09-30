/** Per-game commentary preferences sent with batch event sync. */
const prefsByGame = new Map();

const DEFAULT_PREFS = { mode: "broadcast", language: "en", voiceEnabled: true };

export function setCommentaryPrefsForGame(gameId, prefs = {}) {
  if (!gameId) return;
  prefsByGame.set(String(gameId), { ...DEFAULT_PREFS, ...prefs });
}

export function getCommentaryPrefsForGame(gameId) {
  return prefsByGame.get(String(gameId)) || { ...DEFAULT_PREFS };
}

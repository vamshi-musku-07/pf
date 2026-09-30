import createApiService from "@/lib/apiService";
import { GAME_API_URL } from "@/config/api";

const gameApi = createApiService(GAME_API_URL);

// ==================== Basic Game Operations ====================
export const createGameAPI = (gameData) =>
  gameApi.post("/games", gameData).then((r) => r.data);

export const getGamesByTeamAPI = (teamId, queryParams = {}) => {
  const queryString = new URLSearchParams(queryParams).toString();
  const query = queryString ? `?${queryString}` : "";
  return gameApi.get(`/games/team/${teamId}${query}`).then((r) => r.data);
};

export const getGameByIdAPI = (gameId) =>
  gameApi.get(`/games/${gameId}`).then((r) => r.data);

export const startGameAPI = (gameId, startData = {}) =>
  gameApi.put(`/games/${gameId}/start`, startData).then((r) => r.data);

export const updateGameProgressAPI = (gameId, progressData) =>
  gameApi.put(`/games/${gameId}/progress`, progressData).then((r) => r.data);

export const endGameAPI = (gameId, gameResult) =>
  gameApi.put(`/games/${gameId}/end`, gameResult).then((r) => r.data);

export const deleteGameAPI = (gameId) =>
  gameApi.delete(`/games/${gameId}`).then((r) => r.data);

// ==================== Game Events ====================
export const addGameEventAPI = (gameId, eventData) =>
  gameApi.post(`/games/${gameId}/events`, eventData).then((r) => r.data);

export const getGameEventsAPI = (gameId) =>
  gameApi.get(`/games/${gameId}/events`).then((r) => r.data);

export const removeLastEventAPI = (gameId, options = {}) => {
  const query = options?.teamId
    ? `?teamId=${encodeURIComponent(options.teamId)}`
    : "";
  return gameApi.delete(`/games/${gameId}/events/last${query}`).then((r) => r.data);
};

// ==================== Football-specific ====================
export const updateFootballMatchStateAPI = (gameId, matchState) =>
  gameApi.put(`/games/${gameId}/football/match-state`, matchState).then((r) => r.data);

export const makeSubstitutionAPI = (gameId, substitutionData) =>
  gameApi.post(`/games/${gameId}/football/substitution`, substitutionData).then((r) => r.data);

export const updateFootballLineupAPI = (gameId, lineupData) =>
  gameApi.put(`/games/${gameId}/football/lineup`, lineupData).then((r) => r.data);

// ==================== Cricket-specific ====================
export const updateCricketPlayingXIAPI = (gameId, playingXIData) =>
  gameApi.put(`/games/${gameId}/cricket/playing-xi`, playingXIData).then((r) => r.data);

export const updateBattingOrderAPI = (gameId, battingOrderData) =>
  gameApi.put(`/games/${gameId}/cricket/batting-order`, battingOrderData).then((r) => r.data);

export const updateCurrentBowlerAPI = (gameId, bowlerData) =>
  gameApi.put(`/games/${gameId}/cricket/current-bowler`, bowlerData).then((r) => r.data);

export const updateTossAPI = (gameId, tossData) =>
  gameApi.put(`/games/${gameId}/cricket/toss`, tossData).then((r) => r.data);

export const updateCricketMatchStateAPI = (gameId, matchStateData) =>
  gameApi.put(`/games/${gameId}/cricket/match-state`, matchStateData).then((r) => r.data);

// ==================== Volleyball-specific ====================
export const updateVolleyballMatchStateAPI = (gameId, matchState) =>
  gameApi.put(`/games/${gameId}/volleyball/match-state`, matchState).then((r) => r.data);

export const updateBasketballLineupAPI = (gameId, lineupData) =>
  gameApi.put(`/games/${gameId}/basketball/lineup`, lineupData).then((r) => r.data);

export const updateBaseballLineupAPI = (gameId, lineupData) =>
  gameApi.put(`/games/${gameId}/baseball/lineup`, lineupData).then((r) => r.data);

export const updateHockeyLineupAPI = (gameId, lineupData) =>
  gameApi.put(`/games/${gameId}/hockey/lineup`, lineupData).then((r) => r.data);

export const updateVolleyballLineupAPI = (gameId, lineupData) =>
  gameApi.put(`/games/${gameId}/volleyball/lineup`, lineupData).then((r) => r.data);

export const updateServingTeamAPI = (gameId, servingTeamData) =>
  gameApi.put(`/games/${gameId}/volleyball/serving-team`, servingTeamData).then((r) => r.data);

// ==================== Rugby-specific ====================
export const updateRugbyMatchStateAPI = (gameId, matchState) =>
  gameApi.put(`/games/${gameId}/rugby/match-state`, matchState).then((r) => r.data);

export const updateRugbyLineupAPI = (gameId, lineupData) =>
  gameApi.put(`/games/${gameId}/rugby/lineup`, lineupData).then((r) => r.data);

// ==================== Chess-specific ====================
export const updateChessMatchStateAPI = (gameId, matchState) =>
  gameApi.put(`/games/${gameId}/chess/match-state`, matchState).then((r) => r.data);

// ==================== Chess Puzzles ====================
export const createChessPuzzleAPI = (puzzleData) =>
  gameApi.post("/chess/puzzles", puzzleData).then((r) => r.data);

export const getChessPuzzlesByTeamAPI = (teamId, params = {}) =>
  gameApi.get(`/chess/puzzles/team/${teamId}`, { params }).then((r) => r.data);

export const getChessPuzzleByIdAPI = (puzzleId) =>
  gameApi.get(`/chess/puzzles/${puzzleId}`).then((r) => r.data);

export const assignChessPuzzleAPI = (puzzleId, players, dueDate) =>
  gameApi.post(`/chess/puzzles/${puzzleId}/assign`, { players, dueDate }).then((r) => r.data);

export const submitChessPuzzleAttemptAPI = (puzzleId, data) =>
  gameApi.post(`/chess/puzzles/${puzzleId}/attempt`, data).then((r) => r.data);

export const getAssignedChessPuzzlesAPI = (playerId, params = {}) =>
  gameApi.get(`/chess/puzzles/assigned/${playerId}`, { params }).then((r) => r.data);

export const deleteChessPuzzleAPI = (puzzleId) =>
  gameApi.delete(`/chess/puzzles/${puzzleId}`).then((r) => r.data);

export const getChessPuzzleStatsAPI = (teamId) =>
  gameApi.get(`/chess/puzzles/stats/${teamId}`).then((r) => r.data);

// ==================== Shared Game Functions ====================
export const findSharedGameAPI = (teamId, opponentTeamId, sport) =>
  gameApi.get(`/games/teams/${teamId}/${opponentTeamId}/${sport}`).then((r) => r.data);

export const createSharedGameAPI = (gameData) =>
  gameApi.post("/games", gameData).then((r) => r.data);

// ==================== Statistics and Records ====================
export const getRecentGamesAPI = (teamId, limit = 10) =>
  gameApi.get(`/recent-games/team/${teamId}?limit=${limit}`).then((r) => r.data);

export const getTeamMatchHistoryAPI = (teamId, opponentTeamId, sport) =>
  gameApi.get(`/match-history/${teamId}/${opponentTeamId}/${sport}`).then((r) => r.data);

export const getGameStatisticsAPI = (teamId, sport = null, season = null) => {
  let queryParams = {};
  if (sport) queryParams.sport = sport;
  if (season) queryParams.season = season;
  const queryString = new URLSearchParams(queryParams).toString();
  const query = queryString ? `?${queryString}` : "";
  return gameApi.get(`/game-statistics/team/${teamId}${query}`).then((r) => r.data);
};

export const getTeamRecordAPI = (teamId, sport = null) => {
  const query = sport ? `?sport=${sport}` : "";
  return gameApi.get(`/team-record/${teamId}${query}`).then((r) => r.data);
};

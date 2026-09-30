import { useState, useCallback } from "react";
import {
  createGameAPI,
  getGamesByTeamAPI,
  getGameByIdAPI,
  startGameAPI,
  endGameAPI,
  deleteGameAPI,
  addGameEventAPI,
  getGameEventsAPI,
  removeLastEventAPI,
  updateGameProgressAPI,
  getRecentGamesAPI,
  getTeamRecordAPI,
  getGameStatisticsAPI,
} from "@/services/GameApi";

export default function useGames(teamId = null) {
  const [games, setGames] = useState([]);
  const [currentGame, setCurrentGame] = useState(null);
  const [gameEvents, setGameEvents] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [teamRecord, setTeamRecord] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGames = useCallback(
    async (queryParams = {}) => {
      if (!teamId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getGamesByTeamAPI(teamId, queryParams);
        setGames(data.games || data);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [teamId]
  );

  const fetchGameById = useCallback(async (gameId) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getGameByIdAPI(gameId);
      setCurrentGame(data.game || data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createGame = useCallback(async (gameData) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await createGameAPI(gameData);
      setGames((prev) => [data.game || data, ...prev]);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startGame = useCallback(async (gameId) => {
    try {
      const data = await startGameAPI(gameId);
      setCurrentGame(data.game || data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const endGame = useCallback(async (gameId, result) => {
    try {
      const data = await endGameAPI(gameId, result);
      setCurrentGame(data.game || data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const deleteGame = useCallback(async (gameId) => {
    try {
      await deleteGameAPI(gameId);
      setGames((prev) => prev.filter((g) => (g._id || g.id) !== gameId));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const addEvent = useCallback(async (gameId, eventData) => {
    try {
      const data = await addGameEventAPI(gameId, eventData);
      setGameEvents((prev) => [...prev, data.event || data]);
      if (data.game) setCurrentGame(data.game);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const fetchEvents = useCallback(async (gameId) => {
    try {
      const data = await getGameEventsAPI(gameId);
      setGameEvents(data.events || data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }, []);

  const undoLastEvent = useCallback(async (gameId) => {
    try {
      const data = await removeLastEventAPI(gameId);
      setGameEvents((prev) => prev.slice(0, -1));
      if (data.game) setCurrentGame(data.game);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const updateProgress = useCallback(async (gameId, progressData) => {
    try {
      const data = await updateGameProgressAPI(gameId, progressData);
      if (data.game) setCurrentGame(data.game);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const fetchRecentGames = useCallback(
    async (limit = 10) => {
      if (!teamId) return;
      try {
        const data = await getRecentGamesAPI(teamId, limit);
        setRecentGames(data.games || data);
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      }
    },
    [teamId]
  );

  const fetchTeamRecord = useCallback(
    async (sport = null) => {
      if (!teamId) return;
      try {
        const data = await getTeamRecordAPI(teamId, sport);
        setTeamRecord(data);
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      }
    },
    [teamId]
  );

  const fetchStatistics = useCallback(
    async (sport = null, season = null) => {
      if (!teamId) return;
      try {
        const data = await getGameStatisticsAPI(teamId, sport, season);
        setStatistics(data);
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      }
    },
    [teamId]
  );

  return {
    games,
    currentGame,
    gameEvents,
    recentGames,
    teamRecord,
    statistics,
    isLoading,
    error,
    fetchGames,
    fetchGameById,
    createGame,
    startGame,
    endGame,
    deleteGame,
    addEvent,
    fetchEvents,
    undoLastEvent,
    updateProgress,
    fetchRecentGames,
    fetchTeamRecord,
    fetchStatistics,
    setCurrentGame,
  };
}

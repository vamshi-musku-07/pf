import { useState, useCallback, useEffect, useRef } from "react";
import { getGameByIdAPI } from "@/services/GameApi";
import { getPlayersByTeamAPI } from "@/services/PlayerApi";
import { getUsersByIdsAPI } from "@/services/AuthApi";
import { getTeamByIdAPI } from "@/services/TeamApi";
import { normalizeGameModel, mergeGamePermissions } from "@/lib/gameModel";
import {
  extractPlayersFromApiResponse,
  filterActiveRosterPlayers,
  mergeRosterLists,
  normalizePlayerRecord,
  normalizeTeamId,
  rostersForGame,
} from "@/lib/playerRoster";
import { isGameFinished } from "./gameStatus";

const applyGameState = (prev, incoming) => mergeGamePermissions(prev, incoming);

const normalizeRosterSide = (list) =>
  filterActiveRosterPlayers(list).map(normalizePlayerRecord);

export function useGameData(gameId, incomingGameReconcilerRef = null, { pollMs = 10000, rosterByTeamId = null } = {}) {
  const [currentGame, setCurrentGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamNames, setTeamNames] = useState({ home: "", away: "" });
  const [players, setPlayers] = useState({ home: [], away: [] });
  const [gameOver, setGameOver] = useState(false);

  const isMountedRef = useRef(true);
  const fetchGameRef = useRef(null);
  const currentGameRef = useRef(null);
  const rosterByTeamIdRef = useRef(rosterByTeamId);

  useEffect(() => {
    rosterByTeamIdRef.current = rosterByTeamId;
  }, [rosterByTeamId]);

  const setCurrentGameMerged = useCallback((updater) => {
    setCurrentGame((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return applyGameState(prev, next);
    });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => { currentGameRef.current = currentGame; }, [currentGame]);

  const applyProfilePictures = useCallback((homePlayers, awayPlayers) => {
    const userIds = [...new Set([...homePlayers, ...awayPlayers].map((p) => p?.userId).filter(Boolean))];
    if (userIds.length === 0) return;

    getUsersByIdsAPI(userIds)
      .then((profileMap) => {
        if (!isMountedRef.current || !profileMap) return;
        const addProfile = (list) =>
          list.map((p) =>
            p && profileMap[p.userId]?.profilePicture
              ? { ...p, profilePicture: profileMap[p.userId].profilePicture }
              : p,
          );
        setPlayers({
          home: addProfile(homePlayers),
          away: addProfile(awayPlayers),
        });
      })
      .catch(() => {});
  }, []);

  const loadRostersForGame = useCallback(async (gameBase) => {
    const homeId = normalizeTeamId(gameBase?.teamId);
    const awayId = normalizeTeamId(gameBase?.opponentTeamId);
    const seed = rostersForGame(gameBase, rosterByTeamIdRef.current || {});

    const [hP, aP] = await Promise.allSettled([
      homeId ? getPlayersByTeamAPI(homeId) : Promise.resolve(null),
      awayId ? getPlayersByTeamAPI(awayId) : Promise.resolve(null),
    ]);
    if (!isMountedRef.current) return { home: [], away: [] };

    const fetchedHome = hP.status === "fulfilled"
      ? filterActiveRosterPlayers(extractPlayersFromApiResponse(hP.value))
      : [];
    const fetchedAway = aP.status === "fulfilled"
      ? filterActiveRosterPlayers(extractPlayersFromApiResponse(aP.value))
      : [];

    const homePlayers = normalizeRosterSide(
      mergeRosterLists(seed.home, fetchedHome),
    );
    const awayPlayers = normalizeRosterSide(
      mergeRosterLists(seed.away, fetchedAway),
    );

    if (__DEV__) {
      if (homeId && homePlayers.length === 0) {
        console.warn("[useGameData] No home roster loaded", {
          gameId,
          homeId,
          seedCount: seed.home?.length || 0,
          fetchedCount: fetchedHome.length,
          rosterKeys: Object.keys(rosterByTeamIdRef.current || {}),
        });
      }
      if (awayId && awayPlayers.length === 0) {
        console.warn("[useGameData] No away roster loaded", {
          gameId,
          awayId,
          seedCount: seed.away?.length || 0,
          fetchedCount: fetchedAway.length,
        });
      }
    }

    setPlayers({ home: homePlayers, away: awayPlayers });
    applyProfilePictures(homePlayers, awayPlayers);
    return { home: homePlayers, away: awayPlayers };
  }, [applyProfilePictures, gameId]);

  const fetchGame = useCallback(async () => {
    if (!gameId) return null;
    let game = null;
    try {
      const res = await getGameByIdAPI(gameId);
      if (!isMountedRef.current) return null;
      game = normalizeGameModel(res);
      if (!game?.base) return null;
      if (currentGameRef) {
        currentGameRef.current = applyGameState(currentGameRef.current, game);
      }
      if (incomingGameReconcilerRef?.current) {
        const reconciled = incomingGameReconcilerRef.current(game);
        if (reconciled === false) {
          return game;
        }
        setCurrentGameMerged(reconciled || game);
      } else {
        setCurrentGameMerged(game);
      }
      setGameOver(isGameFinished(game));

      const homeId = normalizeTeamId(game.base?.teamId);
      const awayId = normalizeTeamId(game.base?.opponentTeamId);

      const [hR, aR] = await Promise.allSettled([
        getTeamByIdAPI(homeId),
        awayId ? getTeamByIdAPI(awayId) : Promise.resolve(null),
      ]);
      if (!isMountedRef.current) return game;
      const hN = hR.status === "fulfilled"
        ? hR.value?.data?.teamName || hR.value?.team?.teamName || hR.value?.teamName || "Home"
        : "Home";
      const aN = aR.status === "fulfilled"
        ? aR.value?.data?.teamName || aR.value?.team?.teamName || aR.value?.teamName || "Away"
        : "Away";
      setTeamNames({ home: hN, away: aN });

      await loadRostersForGame(game.base);
    } catch (err) {
      console.error("Failed to load game:", err);
      return null;
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
    return game;
  }, [gameId, incomingGameReconcilerRef, currentGameRef, setCurrentGameMerged, loadRostersForGame]);

  useEffect(() => { fetchGameRef.current = fetchGame; }, [fetchGame]);

  useEffect(() => { fetchGame(); }, [fetchGame]);

  // Re-merge rosters when parent passes updated team tab data (no full game refetch).
  useEffect(() => {
    const base = currentGameRef.current?.base;
    if (!base || !gameId) return;
    loadRostersForGame(base);
  }, [rosterByTeamId, gameId, loadRostersForGame]);

  useEffect(() => {
    if (!gameId || gameOver) return;
    const interval = Math.max(2000, Number(pollMs) || 10000);
    const i = setInterval(fetchGame, interval);
    return () => clearInterval(i);
  }, [gameId, gameOver, fetchGame, pollMs]);

  return {
    currentGame, setCurrentGame: setCurrentGameMerged,
    loading,
    teamNames,
    players,
    gameOver, setGameOver,
    fetchGame,
    isMountedRef,
    fetchGameRef,
    currentGameRef,
  };
}

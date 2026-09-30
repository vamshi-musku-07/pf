import React, { useCallback } from "react";
import { useLiveGame } from "../../features/liveGame/hooks/useLiveGame";
import { useHydrationLockedGame } from "../../features/liveGame/hooks/useHydrationLockedGame";
import { useSyncExternalSnapshot } from "../../features/liveGame/hooks/useSyncExternalSnapshot";
import { LEGACY } from "../../features/liveGame/events/eventTypes";
import CricketScoringPanel from "./CricketScoringPanel";

const playerDisplayName = (player) => {
  if (!player) return "";
  const full = typeof player.fullName === "string" ? player.fullName.trim() : "";
  if (full) return full;
  const joined = [player.firstName, player.lastName].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  return String(player.name || player.playerName || "").trim();
};

const findPlayerName = (players, playerId) => {
  if (!playerId || !players) return "";
  const pid = String(playerId);
  const roster = [
    ...(players.home || []),
    ...(players.away || []),
  ];
  const found = roster.find((p) => {
    const id = p?._id ?? p?.id ?? p?.playerId;
    return id != null && String(id) === pid;
  });
  return playerDisplayName(found);
};

// Cricket panel calls onScore in two shapes:
//   onScore(eventType)
//   onScore(eventType, runs)
// We pass everything through and let the legacy applier read fields as needed.

export default function LiveCricketScoringPanel({ gameId, syncGame, players, teamNames, ...rest }) {
  const { derivedGame, dispatchEvent, syncExternalSnapshot } = useLiveGame(gameId);
  // Setup (batting order, opening bowler) updates `currentGame` via legacy APIs.
  // Always sync that snapshot into Redux — never the derived-only view, which
  // would hide setup progress after hydration.
  const externalSnapshot = syncGame ?? rest.currentGame;
  useSyncExternalSnapshot(externalSnapshot, syncExternalSnapshot, {
    paused: !!rest.isUpdating,
  });
  const { game } = useHydrationLockedGame(derivedGame, externalSnapshot);
  const base = game?.base || {};

  const handleScore = useCallback(
    (eventType, runsOrPlayerId, extras = {}) => {
      const sport = game?.sport || {};
      const base = game?.base || {};

      // Determine playerId the same way the legacy handleCricketScore does:
      // batting events → current striker, bowling extras → current bowler.
      const BATTING_EVENTS = [
        "dot_ball", "single", "double", "triple",
        "boundary_4", "boundary_6", "bye", "leg_bye",
      ];
      const BOWLING_EVENTS = ["wide", "no_ball"];

      // Canonical run values for each event type (used when the caller
      // does not pass a numeric runsOrPlayerId, e.g. onScore("single")).
      const EVENT_RUNS = {
        dot_ball: 0, single: 1, double: 2, triple: 3,
        boundary_4: 4, boundary_6: 6,
      };

      const striker = (sport.currentBatsmen || []).find((b) => b && b.striker);
      const nonStriker = (sport.currentBatsmen || []).find((b) => b && !b.striker);
      const bowler  = sport.currentBowler;
      let derivedPlayerId = null;
      if (BATTING_EVENTS.includes(eventType)) {
        derivedPlayerId = striker?.playerId || null;
      } else if (BOWLING_EVENTS.includes(eventType)) {
        derivedPlayerId = bowler?.playerId || null;
      } else {
        derivedPlayerId = striker?.playerId || null;
      }

      const strikerName = findPlayerName(players, striker?.playerId);
      const nonStrikerName = findPlayerName(players, nonStriker?.playerId);
      const bowlerName = findPlayerName(players, bowler?.playerId);
      const primaryName = BOWLING_EVENTS.includes(eventType) ? bowlerName : strikerName;

      // teamId: batting events → batting team; bowling events → bowling team
      // (cricket.js uses this to decide isBattingTeam, which gates bowler stats)
      const inningsIdx = (sport.currentInnings || 1) - 1;
      const battingTeamId =
        sport.innings?.[inningsIdx]?.battingTeamId ||
        sport.battingTeamId ||
        base.teamId;
      const bowlingTeamId =
        sport.innings?.[inningsIdx]?.bowlingTeamId ||
        sport.bowlingTeamId ||
        base.opponentTeamId;
      const teamId = BOWLING_EVENTS.includes(eventType)
        ? (bowlingTeamId || base.teamId)
        : (battingTeamId || base.teamId);

      const body = {
        eventType,
        timestamp: new Date().toISOString(),
        teamId,
        playerId: derivedPlayerId,
        playerName: primaryName || undefined,
        batsmanName: strikerName || undefined,
        bowlerName: bowlerName || undefined,
        nonStrikerName: nonStrikerName || undefined,
        innings: sport.currentInnings || 1,
        homeTeamName: teamNames?.home || undefined,
        awayTeamName: teamNames?.away || undefined,
        ...(extras || {}),
      };

      // Always populate runs so sport.events stores the value and the
      // scorecard can compute batting stats without guessing from event type.
      if (typeof runsOrPlayerId === "number") {
        body.runs = runsOrPlayerId;
      } else if (typeof runsOrPlayerId === "string") {
        body.playerId = runsOrPlayerId;
        body.playerName = findPlayerName(players, runsOrPlayerId) || body.playerName;
        if (EVENT_RUNS[eventType] !== undefined) body.runs = EVENT_RUNS[eventType];
      } else if (EVENT_RUNS[eventType] !== undefined) {
        body.runs = EVENT_RUNS[eventType];
      }

      dispatchEvent({
        type: LEGACY.CRICKET,
        payload: { body },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatchEvent, game, players, teamNames]
  );

  return (
    <CricketScoringPanel
      {...rest}
      currentGame={game}
      players={players}
      onScore={handleScore}
      isUpdating={false}
    />
  );
}

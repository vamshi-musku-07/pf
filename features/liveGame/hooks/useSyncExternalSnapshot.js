// Pushes a parent-supplied snapshot (typically `useGameData.currentGame`)
// into the live slice's serverState whenever the reference changes.
//
// Why this exists:
//   Setup-flow actions (cricket batting order / opening bowler, volleyball
//   and baseball lineups, toss selection, etc.) still go through legacy
//   single-call APIs that update `useGameData.currentGame` directly. They
//   bypass the batch event log and never bump baseGame.version, so the
//   live socket push doesn't notify us. Without this bridge the hydration
//   lock would hide those mutations forever and the setup buttons would
//   appear stuck (cricket: "Set batting order" stays unchecked; volleyball/
//   baseball: lineup setup screen never advances).
//
// Safety:
//   `mergeExternalSnapshot` is only applied by the reducer when the live
//   queue is completely idle (no pending, no inflight). That means active
//   optimistic scoring can never be overwritten by a stale poll. Setup
//   happens before scoring begins, so the queue is always idle then.

import { useEffect, useRef } from "react";

function buildSnapshotSignature(snapshot) {
  if (!snapshot) return "";
  try {
    return JSON.stringify(snapshot);
  } catch {
    const base = snapshot?.base || {};
    const sport = snapshot?.sport || {};
    return JSON.stringify({
      gameId: base?._id || base?.id || null,
      version: base?.version || snapshot?.version || null,
      status: base?.status || null,
      sport: base?.sport || null,
      eventCount: Array.isArray(sport?.events) ? sport.events.length : 0,
      score: sport?.score || null,
      homeScore: sport?.homeScore || null,
      awayScore: sport?.awayScore || null,
      innings: sport?.currentInnings || null,
      bowler: sport?.currentBowler?.playerId || null,
      batsmen: Array.isArray(sport?.currentBatsmen)
        ? sport.currentBatsmen.map((b) => ({ id: b?.playerId || null, striker: !!b?.striker }))
        : [],
      lineupState: {
        home: sport?.homeLineup || sport?.homePlayingXI || null,
        away: sport?.awayLineup || sport?.awayPlayingXI || null,
      },
    });
  }
}

export function useSyncExternalSnapshot(snapshot, syncFn, { paused = false } = {}) {
  const lastRef = useRef(null);
  const lastSignatureRef = useRef("");

  useEffect(() => {
    if (paused || !snapshot) return;

    const nextSignature = buildSnapshotSignature(snapshot);
    if (lastRef.current === snapshot && lastSignatureRef.current === nextSignature) {
      return;
    }
    if (lastSignatureRef.current === nextSignature) {
      lastRef.current = snapshot;
      return;
    }

    lastRef.current = snapshot;
    lastSignatureRef.current = nextSignature;
    syncFn?.(snapshot);
  }, [snapshot, syncFn, paused]);
}

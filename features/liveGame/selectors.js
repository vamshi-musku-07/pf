import { createSelector } from "@reduxjs/toolkit";
import { applyEvent } from "./reducers";
import { reconcileCricketTotalsFromEvents } from "../../components/game/hooks/cricketState";

const finalizeCricketDerivedGame = (game) => {
  if (!game?.base || game.base.sport !== "Cricket") return game;
  return reconcileCricketTotalsFromEvents(game);
};

const selectByGameId = (state) => state.liveGame?.byGameId || {};

export const selectLiveGame = (state, gameId) =>
  selectByGameId(state)[gameId];

export const selectServerVersion = (state, gameId) =>
  selectByGameId(state)[gameId]?.serverVersion || 0;

export const selectPendingEvents = (state, gameId) =>
  selectByGameId(state)[gameId]?.pendingEvents || [];

export const selectQueueHealth = (state, gameId) => {
  const g = selectByGameId(state)[gameId];
  if (!g) return { pending: 0, inflight: 0, failed: 0 };
  return {
    pending: g.pendingEvents.length,
    inflight: g.inflightIds.length,
    failed: g.failedIds.length,
  };
};

/**
 * THE CRITICAL SELECTOR.
 *
 * UI must derive from this. It computes:
 *   derivedGame = serverState reduced by every still-pending local event.
 *
 * Because pending events stay in the queue until the server acks them
 * (by clientSeq), a stale server response that comes back AFTER newer
 * local taps cannot regress the UI — those taps are still replayed on top.
 *
 * createSelector memoizes, so as long as serverState + pendingEvents
 * references are stable, the derived game is reference-stable too —
 * no re-renders, no flicker.
 */
const makeSelectDerivedGame = () =>
  createSelector(
    [
      (state, gameId) => selectByGameId(state)[gameId]?.serverState,
      (state, gameId) => selectByGameId(state)[gameId]?.pendingEvents,
      (state, gameId) => selectByGameId(state)[gameId]?.serverVersion,
    ],
    (serverState, pendingEvents, serverVersion) => {
      if (!serverState) return null;
      if (!pendingEvents || pendingEvents.length === 0) {
        return finalizeCricketDerivedGame(serverState);
      }

      // CRITICAL: replay MUST start from a clean clone of the authoritative
      // serverState. Replay reducers (badminton/cricket/tennis/volleyball/
      // pickleball/rugby/baseball) already deep-clone internally, but we
      // make the contract explicit and crash-safe here so a stray mutating
      // reducer can never corrupt serverState in the store.
      //
      // NEVER pass `previousDerivedGame` here — replay always restarts
      // from authoritative state on every selector run.
      let s;
      try {
        s = typeof structuredClone === "function"
          ? structuredClone(serverState)
          : JSON.parse(JSON.stringify(serverState));
      } catch {
        s = JSON.parse(JSON.stringify(serverState));
      }

      const dev = typeof __DEV__ !== "undefined" && __DEV__;
      const startScore = dev ? captureScore(s) : null;
      if (dev) {
        // eslint-disable-next-line no-console
        console.debug("[REPLAY START]", {
          serverVersion,
          serverScore: startScore,
          pendingCount: pendingEvents.length,
          pendingSeqs: pendingEvents.map((e) => e.clientSeq),
          pendingTypes: pendingEvents.map((e) => e.type),
        });
      }

      for (const evt of pendingEvents) {
        s = applyEvent(s, evt);
        if (dev) {
          // eslint-disable-next-line no-console
          console.debug("[REPLAY APPLY]", {
            clientSeq: evt.clientSeq,
            type: evt.type,
            scoreAfter: captureScore(s),
          });
        }
      }

      if (dev) {
        // eslint-disable-next-line no-console
        console.debug("[REPLAY FINAL]", {
          serverVersion,
          finalScore: captureScore(s),
          appliedCount: pendingEvents.length,
        });
      }
      return finalizeCricketDerivedGame(s);
    }
  );

// Tries to extract a small score summary for logs. Best-effort across sports.
function captureScore(g) {
  if (!g || !g.sport) return null;
  const sp = g.sport;
  return {
    score: sp.score,
    homeScore: sp.homeScore,
    awayScore: sp.awayScore,
    currentPointScore: sp.currentPointScore,
    currentSet: sp.currentSet,
    currentGame: sp.currentGame,
    setsWon: sp.setsWon,
    runs: sp.runs,
    wickets: sp.wickets,
    overs: sp.overs,
  };
}

// Per-game memoized selector. Call once per component.
export const createDerivedGameSelector = makeSelectDerivedGame;

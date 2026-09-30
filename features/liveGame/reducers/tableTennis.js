// Pure, sport-aware event appliers for table tennis.
// These are PURE: (state, event) -> newState. They never call APIs.
// They mirror (in simplified form) the server-side scorer so the optimistic UI
// matches what the server will compute. The server is authoritative; this is
// a fast preview replayed on top of serverState.

import { TT } from "../events/eventTypes";
import { applyOptimisticTableTennisUndo } from "../../../components/game/hooks/tableTennisState";

const oppositeSide = (side) => (side === "home" ? "away" : "home");

function clone(state) {
  // shallow clone of the slices we mutate; cheap and safe for live scoring
  return {
    ...state,
    sport: state.sport
      ? {
          ...state.sport,
          score: { ...(state.sport.score || { home: 0, away: 0 }) },
          currentPointScore: { ...(state.sport.currentPointScore || { player1: 0, player2: 0 }) },
          timeouts: state.sport.timeouts
            ? {
                player1: { ...(state.sport.timeouts.player1 || {}) },
                player2: { ...(state.sport.timeouts.player2 || {}) },
              }
            : { player1: { remaining: 1, used: 0 }, player2: { remaining: 1, used: 0 } },
          // Clone events array so undo replay works correctly
          events: [...(state.sport?.events || [])],
        }
      : state.sport,
  };
}

function pointsToWin(sport) {
  return sport?.matchConfig?.pointsToWinGame || 11;
}

function getServesPerTurn(sport) {
  return sport?.matchConfig?.servesPerTurn || 2;
}

function advancePoint(sport, side) {
  const pkey = side === "home" ? "player1" : "player2";
  sport.currentPointScore[pkey] = (sport.currentPointScore[pkey] || 0) + 1;

  // Game won?
  const a = sport.currentPointScore.player1;
  const b = sport.currentPointScore.player2;
  const target = pointsToWin(sport);
  const mustWinByTwo = sport.matchConfig?.mustWinByTwo !== false;
  const winnerKey =
    (a >= target && (!mustWinByTwo || a - b >= 2)) ? "home"
    : (b >= target && (!mustWinByTwo || b - a >= 2)) ? "away"
    : null;

  if (winnerKey) {
    sport.score[winnerKey] = (sport.score[winnerKey] || 0) + 1;
    sport.currentGame = (sport.currentGame || 1) + 1;
    sport.currentPointScore = { player1: 0, player2: 0 };
    // Swap serve at game change
    const nextServer = sport.gameStartingServer === "home" ? "away" : "home";
    sport.gameStartingServer = nextServer;
    sport.servingTeam = nextServer;
    sport.servingPlayer = nextServer === "home" ? "player1" : "player2";
    return;
  }

  // Serve rotation every N points (deuce: every 1)
  const totalPts = a + b;
  const servesPerTurn = getServesPerTurn(sport);
  const isDeuce = a >= target - 1 && b >= target - 1;
  const rotate = isDeuce ? totalPts % 1 === 0 : totalPts % servesPerTurn === 0;
  if (rotate) {
    sport.servingTeam = oppositeSide(sport.servingTeam || "home");
    sport.servingPlayer = sport.servingTeam === "home" ? "player1" : "player2";
  }
}

// applyPointFor takes the full evt plus an optional scoringSide override.
// scoringSide is needed for UNFORCED_ERROR / SERVE_ERROR where evt.payload.side
// is the error-maker, not the scorer. When omitted, evt.payload.side is the scorer.
function applyPointFor(state, evt, scoringSide) {
  const side = scoringSide !== undefined ? scoringSide : evt.payload.side;
  const next = clone(state);
  if (!next.sport) return state;
  // Record as 'pointWon' with the scorer's teamSide so undo replay via
  // applyTableTennisEvent correctly re-applies the point.
  if (!next.sport.events) next.sport.events = [];
  next.sport.events.push({
    eventType: 'pointWon',
    teamSide: side,
    optimistic: true,
    pending: true,
    timestamp: new Date().toISOString(),
  });
  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (dev) {
    // eslint-disable-next-line no-console
    console.debug('[TT.POINT] scoring for side', side, 'events.length:', next.sport.events.length, 'score before:', JSON.stringify(next.sport.score));
  }
  advancePoint(next.sport, side);
  return next;
}

function applyTimeout(state, evt) {
  const side = evt.payload.side;
  const next = clone(state);
  const key = side === "home" ? "player1" : "player2";
  const t = next.sport?.timeouts?.[key];
  if (!t || (t.remaining ?? 1) <= 0) return state;
  t.remaining = (t.remaining ?? 1) - 1;
  t.used = (t.used || 0) + 1;
  if (!next.sport.events) next.sport.events = [];
  next.sport.events.push({
    eventType: 'timeout',
    teamSide: side,
    optimistic: true,
    pending: true,
    timestamp: new Date().toISOString(),
  });
  next.sport.activeTimeout = {
    isActive: true,
    calledBy: side,
    startedAt: new Date().toISOString(),
  };
  return next;
}

export const handlers = {
  // POINT and SERVE_ACE: evt.payload.side is the scorer
  [TT.POINT]: (state, evt) => applyPointFor(state, evt),
  [TT.SERVE_ACE]: (state, evt) => applyPointFor(state, evt),
  // UNFORCED_ERROR and SERVE_ERROR: evt.payload.side is the error-maker; scorer is opposite
  [TT.UNFORCED_ERROR]: (state, evt) => applyPointFor(state, evt, oppositeSide(evt.payload.side)),
  [TT.SERVE_ERROR]: (state, evt) => applyPointFor(state, evt, oppositeSide(evt.payload.side)),
  [TT.TIMEOUT]: (state, evt) => applyTimeout(state, evt),
  // UNDO: remove last optimistic event and re-derive score from remaining history
  [TT.UNDO]: (state) => {
    const dev = typeof __DEV__ !== 'undefined' && __DEV__;
    if (dev) {
      // eslint-disable-next-line no-console
      console.debug('[TT.UNDO] applying optimistic undo', {
        scoreBefore: state?.sport?.score,
        eventsLength: state?.sport?.events?.length,
      });
    }
    const { nextGame, removedEvent } = applyOptimisticTableTennisUndo(state);
    if (dev) {
      // eslint-disable-next-line no-console
      console.debug('[TT.UNDO] result', {
        scoreAfter: nextGame?.sport?.score,
        removedEventType: removedEvent?.eventType,
        removedTeamSide: removedEvent?.teamSide,
      });
    }
    return nextGame || state;
  },
};

/**
 * Rugby optimistic state management
 * Mirrors the server-side updateRugbyStats logic for instant UI updates.
 */

const cloneSideBucket = (bucket = {}) => ({
  home: Number(bucket?.home || 0),
  away: Number(bucket?.away || 0),
});

const cloneRugbySport = (sport = {}) => ({
  ...sport,
  homeScore: Number(sport.homeScore || 0),
  awayScore: Number(sport.awayScore || 0),
  homeTries: Number(sport.homeTries || 0),
  awayTries: Number(sport.awayTries || 0),
  homeConversions: Number(sport.homeConversions || 0),
  awayConversions: Number(sport.awayConversions || 0),
  homePenaltyGoals: Number(sport.homePenaltyGoals || 0),
  awayPenaltyGoals: Number(sport.awayPenaltyGoals || 0),
  homeDropGoals: Number(sport.homeDropGoals || 0),
  awayDropGoals: Number(sport.awayDropGoals || 0),
  currentHalf: sport.currentHalf || 1,
  matchStatus: sport.matchStatus || "first_half",
  possessionTeam: sport.possessionTeam || null,
  events: Array.isArray(sport.events) ? [...sport.events] : [],
  cards: Array.isArray(sport.cards) ? sport.cards.map((c) => ({ ...c })) : [],
  substitutions: Array.isArray(sport.substitutions) ? [...sport.substitutions] : [],
  playerStats: Array.isArray(sport.playerStats)
    ? sport.playerStats.map((s) => ({ ...s }))
    : [],
  matchStats: sport.matchStats
    ? Object.keys(sport.matchStats).reduce((acc, key) => {
        acc[key] = cloneSideBucket(sport.matchStats[key]);
        return acc;
      }, {})
    : undefined,
});

/**
 * Apply an optimistic rugby event to the game state.
 * Returns a new game object with the event applied locally.
 */
export const applyOptimisticRugbyUpdate = (prev, eventPayload) => {
  if (!prev?.sport || !prev?.base || !eventPayload) return prev;

  const nextGame = {
    ...prev,
    sport: cloneRugbySport(prev.sport),
  };

  const sport = nextGame.sport;
  const base = nextGame.base;
  const { eventType, teamSide } = eventPayload;
  const isHome = teamSide === "home";
  const side = isHome ? "home" : "away";

  // Push the event into events array
  sport.events = [...sport.events, { ...eventPayload, optimistic: true }];

  switch (eventType) {
    case "try":
    case "maul_try":
      if (isHome) {
        sport.homeScore += 5;
        sport.homeTries += 1;
      } else {
        sport.awayScore += 5;
        sport.awayTries += 1;
      }
      break;

    case "conversion":
      if (isHome) {
        sport.homeScore += 2;
        sport.homeConversions += 1;
      } else {
        sport.awayScore += 2;
        sport.awayConversions += 1;
      }
      break;

    case "conversion_missed":
      // No score change
      break;

    case "penalty_goal":
      if (isHome) {
        sport.homeScore += 3;
        sport.homePenaltyGoals += 1;
      } else {
        sport.awayScore += 3;
        sport.awayPenaltyGoals += 1;
      }
      break;

    case "drop_goal":
      if (isHome) {
        sport.homeScore += 3;
        sport.homeDropGoals += 1;
      } else {
        sport.awayScore += 3;
        sport.awayDropGoals += 1;
      }
      break;

    case "penalty_try":
      if (isHome) {
        sport.homeScore += 7;
        sport.homeTries += 1;
        sport.homeConversions += 1;
      } else {
        sport.awayScore += 7;
        sport.awayTries += 1;
        sport.awayConversions += 1;
      }
      break;

    case "yellow_card":
      if (sport.matchStats) {
        if (!sport.matchStats.yellow_cards) sport.matchStats.yellow_cards = { home: 0, away: 0 };
        sport.matchStats.yellow_cards[side] += 1;
      }
      if (eventPayload.sinBinUntil) {
        sport.cards = [...sport.cards, {
          playerId: eventPayload.playerId,
          teamId: eventPayload.teamId,
          cardType: "yellow",
          sinBinUntil: eventPayload.sinBinUntil,
          timestamp: new Date().toISOString(),
        }];
      }
      break;

    case "red_card":
      if (sport.matchStats) {
        if (!sport.matchStats.red_cards) sport.matchStats.red_cards = { home: 0, away: 0 };
        sport.matchStats.red_cards[side] += 1;
      }
      sport.cards = [...sport.cards, {
        playerId: eventPayload.playerId,
        teamId: eventPayload.teamId,
        cardType: "red",
        timestamp: new Date().toISOString(),
      }];
      break;

    case "penalty_conceded":
      if (sport.matchStats) {
        if (!sport.matchStats.penalties_conceded) sport.matchStats.penalties_conceded = { home: 0, away: 0 };
        sport.matchStats.penalties_conceded[side] += 1;
      }
      break;

    case "scrum":
      // No score change — just event logged
      break;

    case "lineout":
      // No score change — just event logged
      break;

    case "possession_change":
      sport.possessionTeam = isHome ? base.teamId : base.opponentTeamId;
      break;

    case "second_half":
      sport.currentHalf = 2;
      sport.matchStatus = "second_half";
      break;

    case "extra_time":
      sport.currentHalf = 3;
      sport.matchStatus = "extra_time";
      break;

    case "extra_time_2":
      sport.currentHalf = 4;
      sport.matchStatus = "extra_time";
      break;

    default:
      break;
  }

  return nextGame;
};

/**
 * Apply an optimistic undo — removes the last non-undo event and reverses its score effect.
 */
export const applyOptimisticRugbyUndo = (prev) => {
  if (!prev?.sport || !prev?.base) {
    return { nextGame: prev, removedEvent: null };
  }

  const nextGame = {
    ...prev,
    sport: cloneRugbySport(prev.sport),
  };

  const sport = nextGame.sport;
  const events = [...sport.events];

  // Find last non-undo event
  let removedIndex = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i] && events[i].eventType !== "undo") {
      removedIndex = i;
      break;
    }
  }

  if (removedIndex < 0) {
    return { nextGame: prev, removedEvent: null };
  }

  const [removedEvent] = events.splice(removedIndex, 1);
  sport.events = events;

  const isHome = removedEvent.teamSide
    ? removedEvent.teamSide === "home"
    : String(removedEvent.teamId) === String(nextGame.base?.teamId);
  const side = isHome ? "home" : "away";

  switch (removedEvent.eventType) {
    case "try":
    case "maul_try":
      if (isHome) { sport.homeScore -= 5; sport.homeTries -= 1; }
      else { sport.awayScore -= 5; sport.awayTries -= 1; }
      break;
    case "conversion":
      if (isHome) { sport.homeScore -= 2; sport.homeConversions -= 1; }
      else { sport.awayScore -= 2; sport.awayConversions -= 1; }
      break;
    case "penalty_goal":
      if (isHome) { sport.homeScore -= 3; sport.homePenaltyGoals -= 1; }
      else { sport.awayScore -= 3; sport.awayPenaltyGoals -= 1; }
      break;
    case "drop_goal":
      if (isHome) { sport.homeScore -= 3; sport.homeDropGoals -= 1; }
      else { sport.awayScore -= 3; sport.awayDropGoals -= 1; }
      break;
    case "penalty_try":
      if (isHome) { sport.homeScore -= 7; sport.homeTries -= 1; sport.homeConversions -= 1; }
      else { sport.awayScore -= 7; sport.awayTries -= 1; sport.awayConversions -= 1; }
      break;
    case "yellow_card":
      if (sport.matchStats?.yellow_cards) sport.matchStats.yellow_cards[side] = Math.max(0, sport.matchStats.yellow_cards[side] - 1);
      sport.cards = sport.cards.filter(
        (c) => !(c.playerId === removedEvent.playerId && c.cardType === "yellow"),
      );
      break;
    case "red_card":
      if (sport.matchStats?.red_cards) sport.matchStats.red_cards[side] = Math.max(0, sport.matchStats.red_cards[side] - 1);
      sport.cards = sport.cards.filter(
        (c) => !(c.playerId === removedEvent.playerId && c.cardType === "red"),
      );
      break;
    case "penalty_conceded":
      if (sport.matchStats?.penalties_conceded) sport.matchStats.penalties_conceded[side] = Math.max(0, sport.matchStats.penalties_conceded[side] - 1);
      break;
    default:
      break;
  }

  return { nextGame, removedEvent };
};

/**
 * Replay a list of pending actions on top of a server snapshot.
 */
export const replayPendingRugbyActions = (game, actions = []) => {
  return (actions || []).reduce((nextGame, action) => {
    if (!nextGame) return nextGame;
    if (action?.type === "undo") {
      return applyOptimisticRugbyUndo(nextGame).nextGame;
    }
    if (action?.type === "event" && action.payload) {
      return applyOptimisticRugbyUpdate(nextGame, action.payload);
    }
    return nextGame;
  }, game);
};

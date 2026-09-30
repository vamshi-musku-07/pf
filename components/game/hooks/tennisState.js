const cloneGame = (game) => {
  if (!game) return game;
  return JSON.parse(JSON.stringify(game));
};

const POINTS = ["0", "15", "30", "40"];

const createDefaultPlayerStats = (playerId, teamId) => ({
  playerId,
  teamId,
  pointsWon: 0,
  gamesWon: 0,
  setsWon: 0,
  aces: 0,
  doubleFaults: 0,
  winners: 0,
  unforcedErrors: 0,
  breakPointsWon: 0,
  firstServesIn: 0,
  firstServesTotal: 0,
  firstServePercentage: 0,
});

const ensureTennisState = (sport = {}) => {
  if (!sport.score) sport.score = { home: 0, away: 0 };
  if (!Array.isArray(sport.sets)) sport.sets = [];
  if (!sport.currentSetNumber) sport.currentSetNumber = 1;
  if (!sport.currentGameScore) sport.currentGameScore = { home: 0, away: 0 };
  if (!sport.currentPointScore) sport.currentPointScore = { home: "0", away: "0" };
  if (!sport.servingTeam) sport.servingTeam = "home";
  if (!Array.isArray(sport.events)) sport.events = [];
  if (!Array.isArray(sport.playerStats)) sport.playerStats = [];
  if (!sport.matchFormat) sport.matchFormat = "best_of_3";
  if (!sport.matchConfig) sport.matchConfig = {};
  if (!sport.matchStatus) sport.matchStatus = "scheduled";
};

const findOrCreatePlayerStats = (sport, playerId, teamId) => {
  if (!playerId || !teamId) return null;
  let playerStats = sport.playerStats.find(
    (stat) => String(stat?.playerId || "") === String(playerId) && String(stat?.teamId || "") === String(teamId),
  );
  if (!playerStats) {
    playerStats = createDefaultPlayerStats(playerId, teamId);
    sport.playerStats.push(playerStats);
  }
  return playerStats;
};

const getSideFromTeamId = (teamId, base) =>
  String(teamId || "") === String(base?.teamId || "") ? "home" : "away";

const zeroPlayerStats = (stats) => ({
  ...stats,
  pointsWon: 0,
  gamesWon: 0,
  setsWon: 0,
  aces: 0,
  doubleFaults: 0,
  winners: 0,
  unforcedErrors: 0,
  breakPointsWon: 0,
  firstServesIn: 0,
  firstServesTotal: 0,
  firstServePercentage: 0,
});

const advancePoint = (sport, scoringSide, playerStats) => {
  const pts = sport.currentPointScore;
  const opponentSide = scoringSide === "home" ? "away" : "home";
  const myPoints = pts[scoringSide];
  const opponentPoints = pts[opponentSide];

  const winGame = (gameSide) => {
    const previousGames = sport.currentGameScore || { home: 0, away: 0 };
    sport.currentGameScore = {
      ...previousGames,
      [gameSide]: (previousGames[gameSide] || 0) + 1,
    };
    const games = sport.currentGameScore;

    const wasBreak = sport.servingTeam !== gameSide;
    if (wasBreak && playerStats) {
      playerStats.breakPointsWon = (playerStats.breakPointsWon || 0) + 1;
    }
    if (playerStats) {
      playerStats.gamesWon = (playerStats.gamesWon || 0) + 1;
    }

    sport.currentPointScore = { home: "0", away: "0" };
    if (!sport.tiebreaker) {
      sport.servingTeam = sport.servingTeam === "home" ? "away" : "home";
    }

    const wasTiebreaker = sport.tiebreaker;
    if (sport.tiebreaker) sport.tiebreaker = false;

    const homeGames = Number(games.home || 0);
    const awayGames = Number(games.away || 0);
    const leader = Math.max(homeGames, awayGames);
    const trailer = Math.min(homeGames, awayGames);

    let setWon = false;
    if (wasTiebreaker && leader >= 7) {
      setWon = true;
    } else if (leader >= 6 && leader - trailer >= 2) {
      setWon = true;
    } else if (homeGames === 6 && awayGames === 6 && !wasTiebreaker) {
      sport.tiebreaker = true;
      sport.currentPointScore = { home: "0", away: "0" };
      return;
    }

    if (setWon) {
      const setWinner = homeGames > awayGames ? "home" : "away";
      sport.sets.push({
        setNumber: sport.currentSetNumber,
        homeGames,
        awayGames,
        winner: setWinner,
        isTiebreaker: (homeGames === 7 && awayGames === 6) || (homeGames === 6 && awayGames === 7),
      });

      sport.score[setWinner] = (sport.score[setWinner] || 0) + 1;
      if (playerStats && setWinner === scoringSide) {
        playerStats.setsWon = (playerStats.setsWon || 0) + 1;
      }

      const bestOf = sport.matchFormat === "best_of_5" ? 3 : 2;
      if (sport.score.home >= bestOf || sport.score.away >= bestOf) {
        sport.matchStatus = "final";
        sport.result = {
          winner: sport.score.home >= bestOf ? "home" : "away",
          homeSetsWon: sport.score.home,
          awaySetsWon: sport.score.away,
        };
      } else {
        sport.currentSetNumber += 1;
        sport.currentGameScore = { home: 0, away: 0 };
      }
    }
  };

  if (sport.tiebreaker) {
    sport.currentPointScore = {
      ...pts,
      [scoringSide]: String((parseInt(pts[scoringSide], 10) || 0) + 1),
    };

    const myTiebreakPoints = parseInt(sport.currentPointScore[scoringSide], 10) || 0;
    const opponentTiebreakPoints = parseInt(sport.currentPointScore[opponentSide], 10) || 0;
    const totalTiebreakPoints = myTiebreakPoints + opponentTiebreakPoints;

    if (totalTiebreakPoints === 1 || (totalTiebreakPoints > 1 && (totalTiebreakPoints - 1) % 2 === 0)) {
      sport.servingTeam = sport.servingTeam === "home" ? "away" : "home";
    }

    if (myTiebreakPoints >= 7 && myTiebreakPoints - opponentTiebreakPoints >= 2) {
      winGame(scoringSide);
    }
    return;
  }

  if (myPoints === "AD") {
    winGame(scoringSide);
  } else if (opponentPoints === "AD") {
    sport.currentPointScore = { ...pts, [opponentSide]: "40" };
  } else if (myPoints === "40" && opponentPoints === "40") {
    sport.currentPointScore = { ...pts, [scoringSide]: "AD" };
  } else if (myPoints === "40") {
    winGame(scoringSide);
  } else {
    const pointIndex = POINTS.indexOf(myPoints);
    sport.currentPointScore = {
      ...pts,
      [scoringSide]: POINTS[Math.min(pointIndex + 1, 3)],
    };
  }
};

const applyTennisEvent = (sport, eventPayload, base) => {
  const side = eventPayload?.teamSide || getSideFromTeamId(eventPayload?.teamId, base);
  const opponent = side === "home" ? "away" : "home";
  const playerStats = findOrCreatePlayerStats(sport, eventPayload?.playerId, eventPayload?.teamId);

  switch (eventPayload?.eventType) {
    case "pointWon":
      advancePoint(sport, side, playerStats);
      if (playerStats) playerStats.pointsWon = (playerStats.pointsWon || 0) + 1;
      break;

    case "ace":
      advancePoint(sport, side, playerStats);
      if (playerStats) {
        playerStats.pointsWon = (playerStats.pointsWon || 0) + 1;
        playerStats.aces = (playerStats.aces || 0) + 1;
      }
      break;

    case "winner":
      advancePoint(sport, side, playerStats);
      if (playerStats) {
        playerStats.pointsWon = (playerStats.pointsWon || 0) + 1;
        playerStats.winners = (playerStats.winners || 0) + 1;
      }
      break;

    case "double_fault":
      advancePoint(sport, opponent, playerStats);
      if (playerStats) {
        playerStats.doubleFaults = (playerStats.doubleFaults || 0) + 1;
      }
      break;

    case "unforced_error":
      advancePoint(sport, opponent, playerStats);
      if (playerStats) {
        playerStats.unforcedErrors = (playerStats.unforcedErrors || 0) + 1;
      }
      break;

    case "first_serve_fault":
      if (playerStats) {
        playerStats.firstServesTotal = (playerStats.firstServesTotal || 0) + 1;
      }
      break;

    case "first_serve_in":
      if (playerStats) {
        playerStats.firstServesIn = (playerStats.firstServesIn || 0) + 1;
        playerStats.firstServesTotal = (playerStats.firstServesTotal || 0) + 1;
        if (playerStats.firstServesTotal > 0) {
          playerStats.firstServePercentage = Number(
            ((playerStats.firstServesIn / playerStats.firstServesTotal) * 100).toFixed(1),
          );
        }
      }
      break;

    case "timeout":
    case "let":
      break;

    default:
      return false;
  }

  if (sport.matchStatus === "scheduled" && eventPayload?.eventType !== "timeout") {
    sport.matchStatus = "in_progress";
  }

  return true;
};

const appendOptimisticEvent = (sport, eventPayload) => {
  const games = sport.currentGameScore || {};
  sport.events = [
    ...(sport.events || []),
    {
      ...eventPayload,
      setNumber:
        eventPayload?.setNumber != null
          ? Number(eventPayload.setNumber)
          : Math.max(1, Number(sport.currentSetNumber || 1)),
      gameNumber:
        eventPayload?.gameNumber != null
          ? Number(eventPayload.gameNumber)
          : Number(games.home || 0) + Number(games.away || 0) + 1,
      servingTeamBefore: eventPayload?.servingTeamBefore || sport.servingTeam || "home",
      optimistic: true,
      pending: eventPayload?.pending !== false,
    },
  ];
};

const resetSportForReplay = (sport) => {
  const nextSport = {
    ...sport,
    score: { home: 0, away: 0 },
    sets: [],
    currentSetNumber: 1,
    currentGameScore: { home: 0, away: 0 },
    currentPointScore: { home: "0", away: "0" },
    servingTeam: "home",
    tiebreaker: false,
    matchStatus: "scheduled",
    result: null,
    events: [],
    playerStats: Array.isArray(sport.playerStats) ? sport.playerStats.map(zeroPlayerStats) : [],
  };

  return nextSport;
};

export const applyOptimisticTennisUpdate = (prev, eventPayload) => {
  if (!prev?.sport || !prev?.base || !eventPayload) return prev;

  const nextGame = cloneGame(prev);
  ensureTennisState(nextGame.sport);

  appendOptimisticEvent(nextGame.sport, eventPayload);
  const applied = applyTennisEvent(nextGame.sport, eventPayload, nextGame.base);
  return applied ? nextGame : prev;
};

export const applyOptimisticTennisUndo = (prev) => {
  if (!prev?.sport || !prev?.base) {
    return { nextGame: prev, removedEvent: null };
  }

  const nextGame = cloneGame(prev);
  ensureTennisState(nextGame.sport);

  const history = [...(nextGame.sport.events || [])];
  let removedIndex = -1;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const event = history[index];
    if (event && event.eventType !== "undo") {
      removedIndex = index;
      break;
    }
  }

  if (removedIndex < 0) {
    return { nextGame: prev, removedEvent: null };
  }

  const [removedEvent] = history.splice(removedIndex, 1);
  const replaySport = resetSportForReplay(nextGame.sport);
  nextGame.sport = replaySport;

  for (const event of history) {
    replaySport.events.push(event);
    applyTennisEvent(replaySport, event, nextGame.base);
  }

  return { nextGame, removedEvent };
};

export const replayPendingTennisActions = (game, actions = []) => {
  return (actions || []).reduce((nextGame, action) => {
    if (!nextGame) return nextGame;

    if (action?.type === "undo") {
      return applyOptimisticTennisUndo(nextGame).nextGame;
    }

    if (action?.type === "event" && action.payload) {
      return applyOptimisticTennisUpdate(nextGame, action.payload);
    }

    return nextGame;
  }, game);
};
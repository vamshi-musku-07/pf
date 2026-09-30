/**
 * Pure badminton scorecard / stats math.
 * Prefer events[] + games[] over playerStats (undo-safe; faults credit opponent).
 */

import { getBadmintonScoringSide } from "../hooks/badmintonState";

const SKIP_EVENTS = new Set(["undo", "interval", "change_of_ends", "let"]);

function resolveEventSide(event, base) {
  if (event?.teamSide === "home" || event?.teamSide === "away") return event.teamSide;
  if (base?.teamId && String(event?.teamId) === String(base.teamId)) return "home";
  if (base?.opponentTeamId && String(event?.teamId) === String(base.opponentTeamId)) return "away";
  return null;
}

function ordinalLabel(n) {
  if (n === 1) return "1ST";
  if (n === 2) return "2ND";
  if (n === 3) return "3RD";
  return `${n}TH`;
}

function shortOrdinal(n) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function emptySideStats() {
  return {
    pointsWon: 0,
    maxPointsInARow: 0,
    matchPoints: 0,
    comebackToWin: 0,
    biggestLead: 0,
    smashes: 0,
    aces: 0,
    drops: 0,
    clears: 0,
    netShots: 0,
    errors: 0,
    serviceFaults: 0,
  };
}

function isGamePoint(score, side) {
  const mine = side === "home" ? score.home : score.away;
  const theirs = side === "home" ? score.away : score.home;
  if (mine >= 29) return mine > theirs;
  return mine >= 20 && mine - theirs >= 1;
}

function isMatchPoint(score, side, gamesWonBefore) {
  if (!isGamePoint(score, side)) return false;
  const myGames = side === "home" ? gamesWonBefore.home : gamesWonBefore.away;
  return myGames >= 1;
}

/**
 * Replay scoring events into per-game point progressions.
 */
export function buildBadmintonPointProgressions(sport = {}, base = {}) {
  const events = Array.isArray(sport?.events) ? sport.events : [];
  const byGame = new Map();
  const gamesWon = { home: 0, away: 0 };

  const ensureGame = (gameNumber) => {
    if (!byGame.has(gameNumber)) {
      byGame.set(gameNumber, {
        gameNumber,
        snapshots: [{ home: 0, away: 0 }],
        winner: null,
        complete: false,
        live: false,
      });
    }
    return byGame.get(gameNumber);
  };

  (Array.isArray(sport?.games) ? sport.games : []).forEach((g, index) => {
    if (!g) return;
    const gameNumber = Math.max(1, Number(g.gameNumber) || index + 1);
    const entry = ensureGame(gameNumber);
    entry.winner = g.winner === "home" || g.winner === "away" ? g.winner : null;
    entry.complete = Boolean(g.isCompleted || g.winner);
    entry.finalHome = Number(g.homeScore || 0);
    entry.finalAway = Number(g.awayScore || 0);
  });

  for (const event of events) {
    if (!event || !event.eventType || SKIP_EVENTS.has(event.eventType)) continue;
    const actorSide = resolveEventSide(event, base);
    if (!actorSide) continue;
    const award = getBadmintonScoringSide(event.eventType, actorSide);
    if (!award) continue;

    const gameNumber = Math.max(1, Number(event.gameNumber) || sport?.currentGameNumber || 1);
    const entry = ensureGame(gameNumber);
    const prev = entry.snapshots[entry.snapshots.length - 1] || { home: 0, away: 0 };
    const next = {
      home: prev.home + (award === "home" ? 1 : 0),
      away: prev.away + (award === "away" ? 1 : 0),
      eventType: event.eventType,
      award,
    };
    entry.snapshots.push(next);
  }

  const currentGameNumber = Math.max(1, Number(sport?.currentGameNumber) || 1);
  const liveScore = sport?.score || { home: 0, away: 0 };
  const liveEntry = ensureGame(currentGameNumber);
  if (sport?.matchStatus !== "final") {
    liveEntry.live = true;
    liveEntry.complete = false;
    const last = liveEntry.snapshots[liveEntry.snapshots.length - 1] || { home: 0, away: 0 };
    if (
      liveEntry.snapshots.length <= 1 &&
      (Number(liveScore.home || 0) > 0 || Number(liveScore.away || 0) > 0)
    ) {
      liveEntry.snapshots.push({
        home: Number(liveScore.home || 0),
        away: Number(liveScore.away || 0),
        synthetic: true,
      });
    } else if (
      Number(liveScore.home || 0) !== last.home ||
      Number(liveScore.away || 0) !== last.away
    ) {
      // keep event trail; final display uses live score below
    }
  }

  const games = [...byGame.values()].sort((a, b) => a.gameNumber - b.gameNumber);
  for (const g of games) {
    const last = g.snapshots[g.snapshots.length - 1] || { home: 0, away: 0 };
    g.homeScore = g.complete && g.finalHome != null ? g.finalHome : last.home;
    g.awayScore = g.complete && g.finalAway != null ? g.finalAway : last.away;

    if (!g.winner) {
      if (
        g.homeScore > g.awayScore &&
        ((g.homeScore >= 21 && g.homeScore - g.awayScore >= 2) || g.homeScore >= 30)
      ) {
        g.winner = "home";
        g.complete = true;
      } else if (
        g.awayScore > g.homeScore &&
        ((g.awayScore >= 21 && g.awayScore - g.homeScore >= 2) || g.awayScore >= 30)
      ) {
        g.winner = "away";
        g.complete = true;
      }
    }

    g.gamesWonBefore = { home: gamesWon.home, away: gamesWon.away };
    if (g.winner === "home") gamesWon.home += 1;
    if (g.winner === "away") gamesWon.away += 1;
    g.label = shortOrdinal(g.gameNumber);
    g.headerLabel = ordinalLabel(g.gameNumber);
  }

  const matchStarted =
    games.some((g) => g.snapshots.length > 1 || g.homeScore > 0 || g.awayScore > 0) ||
    Number(liveScore.home || 0) > 0 ||
    Number(liveScore.away || 0) > 0 ||
    events.some((e) => e && e.eventType && !SKIP_EVENTS.has(e.eventType));

  return { games, currentGameNumber, matchStarted };
}

export function buildBadmintonGameTable(sport = {}, teamNames = {}, userSide = "home", base = {}) {
  const { games, currentGameNumber, matchStarted } = buildBadmintonPointProgressions(sport, base);
  const userIsHome = userSide !== "away";

  let homeGamesWon = Number(sport?.result?.homeGamesWon || 0);
  let awayGamesWon = Number(sport?.result?.awayGamesWon || 0);

  const fromWinners = games.reduce(
    (acc, g) => {
      if (g.winner === "home") acc.home += 1;
      if (g.winner === "away") acc.away += 1;
      return acc;
    },
    { home: 0, away: 0 },
  );
  if (fromWinners.home + fromWinners.away > 0) {
    homeGamesWon = fromWinners.home;
    awayGamesWon = fromWinners.away;
  }

  const gameColumns = games.map((g) => ({
    gameNumber: g.gameNumber,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    winner: g.winner,
    complete: g.complete,
    live: g.live && !g.complete,
    label: shortOrdinal(g.gameNumber),
    headerLabel: ordinalLabel(g.gameNumber),
  }));

  while (gameColumns.length < 3 && matchStarted) {
    const n = gameColumns.length + 1;
    gameColumns.push({
      gameNumber: n,
      homeScore: null,
      awayScore: null,
      winner: null,
      complete: false,
      live: false,
      empty: true,
      label: shortOrdinal(n),
      headerLabel: ordinalLabel(n),
    });
  }

  const homeRow = {
    side: "home",
    name: teamNames?.home || "Home",
    games: gameColumns.map((c) => ({
      gameNumber: c.gameNumber,
      score: c.empty ? "" : c.homeScore,
      won: c.winner === "home",
      live: c.live,
      empty: c.empty,
    })),
  };
  const awayRow = {
    side: "away",
    name: teamNames?.away || "Away",
    games: gameColumns.map((c) => ({
      gameNumber: c.gameNumber,
      score: c.empty ? "" : c.awayScore,
      won: c.winner === "away",
      live: c.live,
      empty: c.empty,
    })),
  };

  const rows = userIsHome ? [homeRow, awayRow] : [awayRow, homeRow];

  return {
    rows,
    gameColumns,
    homeGamesWon,
    awayGamesWon,
    currentGameNumber,
    matchStarted,
    userIsHome,
    gamesDetail: games,
  };
}

/**
 * SofaScore-style match stats for ALL or a specific game.
 * @param {"all"|number} gameFilter
 */
export function buildBadmintonMatchStats(sport = {}, base = {}, gameFilter = "all") {
  const home = emptySideStats();
  const away = emptySideStats();
  const bySide = { home, away };
  const { games } = buildBadmintonPointProgressions(sport, base);
  const filterGame = gameFilter === "all" ? null : Number(gameFilter);

  const relevant = filterGame == null
    ? games
    : games.filter((g) => g.gameNumber === filterGame);

  for (const g of relevant) {
    let runSide = null;
    let runLen = 0;
    let leadHome = 0;
    let leadAway = 0;

    for (let i = 1; i < g.snapshots.length; i += 1) {
      const snap = g.snapshots[i];
      const prev = g.snapshots[i - 1];
      const award = snap.award
        || (snap.home > prev.home ? "home" : snap.away > prev.away ? "away" : null);
      if (!award) continue;

      bySide[award].pointsWon += 1;

      if (runSide === award) runLen += 1;
      else {
        runSide = award;
        runLen = 1;
      }
      bySide[award].maxPointsInARow = Math.max(bySide[award].maxPointsInARow, runLen);

      const hLead = snap.home - snap.away;
      const aLead = snap.away - snap.home;
      if (hLead > leadHome) leadHome = hLead;
      if (aLead > leadAway) leadAway = aLead;

      const wasTrailing =
        award === "home" ? prev.home < prev.away : prev.away < prev.home;
      if (wasTrailing) bySide[award].comebackToWin += 1;

      if (isMatchPoint(prev, award, g.gamesWonBefore || { home: 0, away: 0 })) {
        bySide[award].matchPoints += 1;
      }
    }

    home.biggestLead = Math.max(home.biggestLead, leadHome);
    away.biggestLead = Math.max(away.biggestLead, leadAway);
  }

  const events = Array.isArray(sport?.events) ? sport.events : [];
  for (const event of events) {
    if (!event || !event.eventType || SKIP_EVENTS.has(event.eventType)) continue;
    const gameNo = Number(event.gameNumber || 0);
    if (filterGame != null && gameNo !== filterGame) continue;
    const side = resolveEventSide(event, base);
    if (!side) continue;
    const stats = bySide[side];
    const type = event.eventType;
    if (type === "smash") stats.smashes += 1;
    if (type === "ace" || type === "flick_serve") stats.aces += 1;
    if (type === "drop") stats.drops += 1;
    if (type === "clear") stats.clears += 1;
    if (type === "net_shot") stats.netShots += 1;
    if (type === "fault") stats.errors += 1;
    if (type === "service_fault") stats.serviceFaults += 1;
  }

  const setOptions = [
    { id: "all", label: "ALL" },
    ...games.map((g) => ({
      id: String(g.gameNumber),
      label: ordinalLabel(g.gameNumber),
    })),
  ];

  return {
    home,
    away,
    setOptions,
    gameFilter: filterGame == null ? "all" : String(filterGame),
  };
}

export function buildBadmintonStatSections(left, right) {
  const row = (label, key) => ({
    label,
    key,
    left: left[key] ?? 0,
    right: right[key] ?? 0,
  });

  return [
    {
      title: "Overview",
      rows: [
        row("Points won", "pointsWon"),
        row("Max points in a row", "maxPointsInARow"),
        row("Match points", "matchPoints"),
        row("Comeback to win", "comebackToWin"),
        row("Biggest lead", "biggestLead"),
      ],
    },
    {
      title: "Shots",
      rows: [
        row("Smashes", "smashes"),
        row("Aces", "aces"),
        row("Drops", "drops"),
        row("Clears", "clears"),
        row("Net shots", "netShots"),
      ],
    },
    {
      title: "Errors",
      rows: [
        row("Faults", "errors"),
        row("Service faults", "serviceFaults"),
      ],
    },
  ];
}

export function buildBadmintonScorecard(
  sport = {},
  teamNames = {},
  base = {},
  gameFilter = "all",
  userSide = "home",
) {
  const userIsHome = userSide !== "away";
  const table = buildBadmintonGameTable(sport, teamNames, userSide, base);
  const stats = buildBadmintonMatchStats(sport, base, gameFilter);
  const leftStats = userIsHome ? stats.home : stats.away;
  const rightStats = userIsHome ? stats.away : stats.home;
  const leftName = userIsHome ? (teamNames?.home || "Home") : (teamNames?.away || "Away");
  const rightName = userIsHome ? (teamNames?.away || "Away") : (teamNames?.home || "Home");
  const sections = buildBadmintonStatSections(leftStats, rightStats);

  const detailGames = [...table.gamesDetail]
    .filter((g) => g.snapshots.length > 1 || g.complete || g.live)
    .sort((a, b) => b.gameNumber - a.gameNumber)
    .map((g) => {
      const snapshots = g.snapshots.slice(1);
      return {
        gameNumber: g.gameNumber,
        title: `${shortOrdinal(g.gameNumber)} set`,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        winner: g.winner,
        live: g.live && !g.complete,
        leftFinal: userIsHome ? g.homeScore : g.awayScore,
        rightFinal: userIsHome ? g.awayScore : g.homeScore,
        leftWon: userIsHome ? g.winner === "home" : g.winner === "away",
        columns: snapshots.map((s) => ({
          left: userIsHome ? s.home : s.away,
          right: userIsHome ? s.away : s.home,
          leftWonPoint: userIsHome ? s.award === "home" : s.award === "away",
          rightWonPoint: userIsHome ? s.award === "away" : s.award === "home",
        })),
      };
    });

  return {
    ...table,
    stats,
    sections,
    leftName,
    rightName,
    leftStats,
    rightStats,
    detailGames,
  };
}

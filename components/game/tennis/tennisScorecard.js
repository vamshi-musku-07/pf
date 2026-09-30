/**
 * Pure tennis scorecard math — sets grid + SofaScore-style match stats.
 * Prefer events[] + sets[] over playerStats (undo-safe, DF credits opponent).
 */

const SCORING_FOR_SIDE = new Set(["pointWon", "ace", "winner"]);
const SCORING_AGAINST_SIDE = new Set(["double_fault", "unforced_error"]);

export function formatTennisDiff(diff) {
  const n = Number(diff) || 0;
  if (n > 0) return `+${n}`;
  return String(n);
}

function emptySideStats() {
  return {
    aces: 0,
    winners: 0,
    doubleFaults: 0,
    unforcedErrors: 0,
    pointsWon: 0,
    gamesWon: 0,
    setsWon: 0,
    tiebreaksWon: 0,
    breakGamesWon: 0,
  };
}

function resolveEventSide(event, base) {
  if (event?.teamSide === "home" || event?.teamSide === "away") return event.teamSide;
  if (base?.teamId && String(event?.teamId) === String(base.teamId)) return "home";
  if (base?.opponentTeamId && String(event?.teamId) === String(base.opponentTeamId)) return "away";
  return null;
}

function pointAwardSide(event, side) {
  if (!side) return null;
  const type = event?.eventType;
  if (SCORING_FOR_SIDE.has(type)) return side;
  if (SCORING_AGAINST_SIDE.has(type)) return side === "home" ? "away" : "home";
  return null;
}

/**
 * Normalize completed + live sets for the scoreboard table.
 * P = games won, Diff = games for − against, PTS = sets won.
 */
export function getTennisRelevantSets(sport = {}) {
  const raw = Array.isArray(sport?.sets) ? sport.sets : [];
  const currentSetNumber = Math.max(1, Number(sport?.currentSetNumber) || 1);
  const setsWon = sport?.score || { home: 0, away: 0 };
  const liveGames = sport?.currentGameScore || { home: 0, away: 0 };
  const matchStarted =
    Boolean(sport?.matchStatus && sport.matchStatus !== "scheduled") ||
    raw.length > 0 ||
    Number(liveGames.home || 0) > 0 ||
    Number(liveGames.away || 0) > 0 ||
    Number(setsWon.home || 0) > 0 ||
    Number(setsWon.away || 0) > 0 ||
    (Array.isArray(sport?.events) && sport.events.some((e) => e && e.eventType && e.eventType !== "undo"));

  const byNumber = new Map();
  raw.forEach((s, index) => {
    if (!s) return;
    const setNumber = Math.max(1, Number(s.setNumber) || index + 1);
    byNumber.set(setNumber, {
      setNumber,
      homeGames: Number(s.homeGames || 0),
      awayGames: Number(s.awayGames || 0),
      winner: s.winner === "home" || s.winner === "away" ? s.winner : null,
      isTiebreaker: Boolean(s.isTiebreaker),
      complete: true,
      live: false,
    });
  });

  // Always include the live/current set so Scorecard isn't empty at 0–0.
  if (sport?.matchStatus !== "final") {
    const existing = byNumber.get(currentSetNumber);
    if (!existing || !existing.complete) {
      byNumber.set(currentSetNumber, {
        setNumber: currentSetNumber,
        homeGames: Number(liveGames.home || 0),
        awayGames: Number(liveGames.away || 0),
        winner: null,
        isTiebreaker: Boolean(sport?.tiebreaker),
        complete: false,
        live: true,
      });
    }
  } else if (!byNumber.has(currentSetNumber) && matchStarted) {
    // final but ensure last set remains visible from raw sets only
  }

  const sets = [...byNumber.values()].sort((a, b) => a.setNumber - b.setNumber);
  // Treat as started whenever we have something to show (including 0–0 live set).
  const hasRows = sets.length > 0;
  return { sets, currentSetNumber, matchStarted: matchStarted || hasRows };
}

export function buildTennisSetTable(sport = {}, teamNames = {}, userSide = "home") {
  const { sets, currentSetNumber, matchStarted } = getTennisRelevantSets(sport);
  const userIsHome = userSide !== "away";

  let homeGames = 0;
  let awayGames = 0;
  let homeSetsWon = 0;
  let awaySetsWon = 0;

  const setColumns = sets.map((s) => {
    homeGames += s.homeGames;
    awayGames += s.awayGames;
    if (s.winner === "home") homeSetsWon += 1;
    if (s.winner === "away") awaySetsWon += 1;
    return {
      setNumber: s.setNumber,
      homeGames: s.homeGames,
      awayGames: s.awayGames,
      winner: s.winner,
      complete: s.complete,
      live: s.live,
      isTiebreaker: s.isTiebreaker,
      label: `S${s.setNumber}`,
    };
  });

  if (homeSetsWon === 0 && awaySetsWon === 0) {
    homeSetsWon = Number(sport?.score?.home || 0);
    awaySetsWon = Number(sport?.score?.away || 0);
  }

  const homeDiff = homeGames - awayGames;
  const awayDiff = awayGames - homeGames;

  const homeRow = {
    side: "home",
    name: teamNames?.home || "Home",
    P: homeGames,
    Diff: homeDiff,
    PTS: homeSetsWon,
    sets: setColumns.map((c) => ({
      setNumber: c.setNumber,
      score: c.homeGames,
      won: c.winner === "home",
      live: c.live,
      complete: c.complete,
    })),
  };
  const awayRow = {
    side: "away",
    name: teamNames?.away || "Away",
    P: awayGames,
    Diff: awayDiff,
    PTS: awaySetsWon,
    sets: setColumns.map((c) => ({
      setNumber: c.setNumber,
      score: c.awayGames,
      won: c.winner === "away",
      live: c.live,
      complete: c.complete,
    })),
  };

  // Always match scoreboard order: your team left, opponent right (never sort by leader).
  const rows = userIsHome ? [homeRow, awayRow] : [awayRow, homeRow];

  return {
    rows,
    setColumns,
    homeSetsWon,
    awaySetsWon,
    homeGames,
    awayGames,
    currentSetNumber,
    matchStarted,
    matchScoreLabel: userIsHome
      ? `${homeSetsWon} – ${awaySetsWon}`
      : `${awaySetsWon} – ${homeSetsWon}`,
    userIsHome,
  };
}

/**
 * Aggregate SofaScore-style stats for ALL or a specific set.
 * @param {object} sport
 * @param {object} base - { teamId, opponentTeamId }
 * @param {"all"|number} setFilter
 */
export function buildTennisMatchStats(sport = {}, base = {}, setFilter = "all") {
  const home = emptySideStats();
  const away = emptySideStats();
  const bySide = { home, away };

  const events = Array.isArray(sport?.events) ? sport.events : [];
  const filterSet = setFilter === "all" ? null : Number(setFilter);

  for (const event of events) {
    if (!event || !event.eventType || event.eventType === "undo" || event.eventType === "let" || event.eventType === "timeout") {
      continue;
    }
    const setNo = Number(event.setNumber || 0);
    if (filterSet != null && setNo !== filterSet) continue;

    const side = resolveEventSide(event, base);
    if (!side) continue;
    const stats = bySide[side];
    const type = event.eventType;

    if (type === "ace") stats.aces += 1;
    if (type === "winner") stats.winners += 1;
    if (type === "double_fault") stats.doubleFaults += 1;
    if (type === "unforced_error") stats.unforcedErrors += 1;

    const award = pointAwardSide(event, side);
    if (award) bySide[award].pointsWon += 1;
  }

  // Games / sets from set table (filter-aware)
  const { sets } = getTennisRelevantSets(sport);
  const relevantSets = filterSet == null
    ? sets
    : sets.filter((s) => s.setNumber === filterSet);

  for (const s of relevantSets) {
    home.gamesWon += s.homeGames;
    away.gamesWon += s.awayGames;
    if (s.winner === "home") {
      home.setsWon += 1;
      if (s.isTiebreaker) home.tiebreaksWon += 1;
    }
    if (s.winner === "away") {
      away.setsWon += 1;
      if (s.isTiebreaker) away.tiebreaksWon += 1;
    }
  }

  // Break games from playerStats only when filtering ALL (not set-scoped reliably)
  if (filterSet == null && Array.isArray(sport?.playerStats)) {
    for (const ps of sport.playerStats) {
      const side = resolveEventSide({ teamId: ps.teamId, teamSide: ps.teamSide }, base);
      if (!side) continue;
      bySide[side].breakGamesWon += Number(ps.breakPointsWon || 0);
    }
  }

  const setOptions = [
    { id: "all", label: "ALL" },
    ...sets.map((s) => ({
      id: String(s.setNumber),
      label: s.setNumber === 1 ? "1ST" : s.setNumber === 2 ? "2ND" : s.setNumber === 3 ? "3RD" : `${s.setNumber}TH`,
    })),
  ];

  return {
    home,
    away,
    setOptions,
    setFilter: filterSet == null ? "all" : String(filterSet),
  };
}

/** Sections for SofaScore-style comparison cards. left/right follow viewer order. */
export function buildTennisStatSections(left, right) {
  const row = (label, key) => ({
    label,
    key,
    left: left[key] ?? 0,
    right: right[key] ?? 0,
  });

  return [
    {
      title: "Service",
      rows: [
        row("Aces", "aces"),
        row("Double faults", "doubleFaults"),
        row("Winners", "winners"),
      ],
    },
    {
      title: "Points",
      rows: [
        row("Total", "pointsWon"),
      ],
    },
    {
      title: "Games",
      rows: [
        row("Total won", "gamesWon"),
        row("Break games won", "breakGamesWon"),
      ],
    },
    {
      title: "Miscellaneous",
      rows: [
        row("Sets won", "setsWon"),
        row("Tiebreaks", "tiebreaksWon"),
        row("Unforced errors", "unforcedErrors"),
      ],
    },
  ];
}

export function buildTennisScorecard(sport = {}, teamNames = {}, base = {}, setFilter = "all", userSide = "home") {
  const userIsHome = userSide !== "away";
  const table = buildTennisSetTable(sport, teamNames, userSide);
  const stats = buildTennisMatchStats(sport, base, setFilter);
  const leftStats = userIsHome ? stats.home : stats.away;
  const rightStats = userIsHome ? stats.away : stats.home;
  const leftName = userIsHome ? (teamNames?.home || "Home") : (teamNames?.away || "Away");
  const rightName = userIsHome ? (teamNames?.away || "Away") : (teamNames?.home || "Home");
  const sections = buildTennisStatSections(leftStats, rightStats);
  return {
    ...table,
    stats,
    sections,
    leftName,
    rightName,
    leftStats,
    rightStats,
  };
}

/**
 * Pure volleyball scorecard math — derived from sport.sets only
 * (never trust result.setsWon alone; undo can desync it).
 */

export function getVolleyballMinPoints(
  setNumber,
  totalSets = 5,
  { setPoints = 25, decidingSetPoints = 15 } = {},
) {
  const setNo = Math.max(1, Number(setNumber) || 1);
  const total = Math.max(1, Number(totalSets) || 5);
  const regular = Math.max(1, Number(setPoints) || 25);
  const deciding = Math.max(1, Number(decidingSetPoints) || 15);
  return setNo >= total ? deciding : regular;
}

export function isVolleyballSetComplete(
  set,
  totalSets = 5,
  opts = {},
) {
  if (!set) return false;
  if (set.winner === "home" || set.winner === "away") return true;

  const setNumber = Math.max(1, Number(set.setNumber) || 1);
  const home = Number(set.homeScore || 0);
  const away = Number(set.awayScore || 0);
  const minPts = getVolleyballMinPoints(setNumber, totalSets, opts);
  const winBy = opts.winByTwo === false ? 1 : 2;
  return (home >= minPts || away >= minPts) && Math.abs(home - away) >= winBy;
}

export function resolveVolleyballSetWinner(set, totalSets = 5) {
  if (!set) return null;
  if (set.winner === "home" || set.winner === "away") return set.winner;
  if (!isVolleyballSetComplete(set, totalSets)) return null;
  const home = Number(set.homeScore || 0);
  const away = Number(set.awayScore || 0);
  if (home === away) return null;
  return home > away ? "home" : "away";
}

/**
 * Normalize and select sets that belong to the match so far.
 * Includes completed sets and the live current set (even 0–0).
 */
export function getVolleyballRelevantSets(sport = {}) {
  const raw = Array.isArray(sport?.sets) ? sport.sets : [];
  const totalSets = Math.max(1, Number(sport?.totalSets) || 5);
  const currentSet = Math.max(1, Math.min(totalSets, Number(sport?.currentSet) || 1));
  const matchStarted =
    Boolean(sport?.matchStatus && sport.matchStatus !== "scheduled") ||
    raw.some((s) => Number(s?.homeScore || 0) > 0 || Number(s?.awayScore || 0) > 0 || s?.winner) ||
    Number(sport?.rallyCount || 0) > 0 ||
    (Array.isArray(sport?.events) && sport.events.length > 0);

  const byNumber = new Map();
  raw.forEach((s, index) => {
    if (!s) return;
    const setNumber = Math.max(1, Number(s.setNumber) || index + 1);
    byNumber.set(setNumber, {
      setNumber,
      homeScore: Number(s.homeScore || 0),
      awayScore: Number(s.awayScore || 0),
      winner: s.winner === "home" || s.winner === "away" ? s.winner : null,
      duration: s.duration,
    });
  });

  // Ensure current set exists when match is underway
  if (matchStarted && !byNumber.has(currentSet)) {
    byNumber.set(currentSet, {
      setNumber: currentSet,
      homeScore: Number(sport?.homeScore || 0),
      awayScore: Number(sport?.awayScore || 0),
      winner: null,
    });
  }

  const sets = [...byNumber.values()]
    .sort((a, b) => a.setNumber - b.setNumber)
    .filter((s) => {
      if (s.setNumber > currentSet && !s.winner && s.homeScore === 0 && s.awayScore === 0) {
        return false;
      }
      if (s.winner || s.homeScore > 0 || s.awayScore > 0) return true;
      return matchStarted && s.setNumber === currentSet;
    })
    .map((s) => {
      const winner = resolveVolleyballSetWinner(s, totalSets);
      return {
        ...s,
        winner,
        complete: Boolean(winner),
        live: !winner && s.setNumber === currentSet,
      };
    });

  return { sets, currentSet, totalSets, matchStarted };
}

/**
 * SofaScore-style match table rows:
 *  P   = rally points scored (across all relevant sets)
 *  Diff = points for − points against
 *  PTS = sets won
 */
export function buildVolleyballScorecard(sport = {}, teamNames = {}) {
  const { sets, currentSet, totalSets, matchStarted } = getVolleyballRelevantSets(sport);

  let homePoints = 0;
  let awayPoints = 0;
  let homeSetsWon = 0;
  let awaySetsWon = 0;
  let setsPlayed = 0;

  const setColumns = sets.map((s) => {
    homePoints += s.homeScore;
    awayPoints += s.awayScore;
    if (s.complete || s.homeScore > 0 || s.awayScore > 0) {
      setsPlayed += 1;
    }
    if (s.winner === "home") homeSetsWon += 1;
    if (s.winner === "away") awaySetsWon += 1;
    return {
      setNumber: s.setNumber,
      homeScore: s.homeScore,
      awayScore: s.awayScore,
      winner: s.winner,
      complete: s.complete,
      live: s.live,
      label: `S${s.setNumber}`,
    };
  });

  // Prefer derived set wins from sets[] (undo-safe). Stored result.setsWon is ignored.
  const homeDiff = homePoints - awayPoints;
  const awayDiff = awayPoints - homePoints;

  const homeRow = {
    side: "home",
    name: teamNames?.home || "Home",
    P: homePoints,
    Diff: homeDiff,
    PTS: homeSetsWon,
    setsPlayed,
    sets: setColumns.map((c) => ({
      setNumber: c.setNumber,
      score: c.homeScore,
      won: c.winner === "home",
      live: c.live,
      complete: c.complete,
    })),
  };

  const awayRow = {
    side: "away",
    name: teamNames?.away || "Away",
    P: awayPoints,
    Diff: awayDiff,
    PTS: awaySetsWon,
    setsPlayed,
    sets: setColumns.map((c) => ({
      setNumber: c.setNumber,
      score: c.awayScore,
      won: c.winner === "away",
      live: c.live,
      complete: c.complete,
    })),
  };

  // SofaScore order: higher PTS first, then better Diff, then more points scored
  const rows = [homeRow, awayRow].sort((a, b) => {
    if (b.PTS !== a.PTS) return b.PTS - a.PTS;
    if (b.Diff !== a.Diff) return b.Diff - a.Diff;
    return b.P - a.P;
  });

  const setsToWin = Math.ceil(totalSets / 2);
  const matchWinner =
    homeSetsWon >= setsToWin ? "home" : awaySetsWon >= setsToWin ? "away" : null;

  return {
    rows,
    setColumns,
    homeSetsWon,
    awaySetsWon,
    homePoints,
    awayPoints,
    currentSet,
    totalSets,
    setsToWin,
    matchStarted,
    matchWinner,
    matchScoreLabel: `${homeSetsWon} – ${awaySetsWon}`,
  };
}

export function formatVolleyballDiff(diff) {
  const n = Number(diff) || 0;
  if (n > 0) return `+${n}`;
  return String(n);
}

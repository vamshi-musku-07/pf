const emptySide = () => ({ home: 0, away: 0 });

const add = (bucket, side, n = 0) => {
  if (!side || !bucket) return;
  bucket[side] = Number(bucket[side] || 0) + Number(n || 0);
};

const sideForTeam = (teamId, homeTeamId, awayTeamId) => {
  const tid = String(teamId || "");
  if (!tid) return null;
  if (tid === String(homeTeamId)) return "home";
  if (awayTeamId && tid === String(awayTeamId)) return "away";
  // Fallback: anything not home is away
  if (homeTeamId && tid !== String(homeTeamId)) return "away";
  return null;
};

const oversFromBalls = (balls) => {
  const n = Number(balls) || 0;
  return Math.floor(n / 6) + (n % 6) / 10;
};

const runRate = (runs, ballsOrOvers, { isOvers = false } = {}) => {
  const r = Number(runs) || 0;
  if (isOvers) {
    const o = Number(ballsOrOvers) || 0;
    if (o <= 0) return 0;
    return Math.round((r / o) * 100) / 100;
  }
  const balls = Number(ballsOrOvers) || 0;
  if (balls <= 0) return 0;
  return Math.round((r / (balls / 6)) * 100) / 100;
};

const inningsOvers = (inn) => {
  if (inn?.overs_completed != null && Number(inn.overs_completed) > 0) {
    return Number(inn.overs_completed);
  }
  if (inn?.balls_completed != null) return oversFromBalls(inn.balls_completed);
  return 0;
};

/**
 * Aggregate cricket team comparison stats.
 * @param {"all"|1|2} period — ALL or innings number
 */
export const buildCricketMatchComparisonStats = ({
  sport,
  homeTeamId,
  awayTeamId,
  period = "all",
} = {}) => {
  const innings = Array.isArray(sport?.innings) ? sport.innings : [];
  const playerStats = Array.isArray(sport?.playerStats) ? sport.playerStats : [];

  const filteredInnings =
    period === "all"
      ? innings
      : innings.filter((inn) => Number(inn?.inningsNumber) === Number(period));

  const runs = emptySide();
  const wicketsLost = emptySide();
  const oversFaced = emptySide();
  const extras = emptySide();
  const fours = emptySide();
  const sixes = emptySide();
  const wicketsTaken = emptySide();
  const dotBalls = emptySide();
  const ballsBowled = emptySide();

  for (const inn of filteredInnings) {
    const batSide = sideForTeam(inn?.battingTeamId, homeTeamId, awayTeamId);
    const bowlSide = sideForTeam(inn?.bowlingTeamId, homeTeamId, awayTeamId)
      || (batSide === "home" ? "away" : batSide === "away" ? "home" : null);

    if (batSide) {
      add(runs, batSide, inn?.total_runs ?? inn?.runs ?? 0);
      add(wicketsLost, batSide, inn?.wickets ?? 0);
      add(oversFaced, batSide, inningsOvers(inn));
      add(extras, batSide, inn?.extras ?? 0);
    }
    if (bowlSide) {
      add(wicketsTaken, bowlSide, inn?.wickets ?? 0);
    }
  }

  // Boundary / bowling extras from playerStats (match totals — only for ALL or attribute by team)
  for (const ps of playerStats) {
    if (!ps) continue;
    const side = sideForTeam(ps.teamId, homeTeamId, awayTeamId);
    if (!side) continue;
    // Player batting totals are match-level; when filtering by innings we still show
    // team innings runs/wickets above, and skip player aggregates for half-innings
    // unless period is all.
    if (period !== "all") continue;
    add(fours, side, ps.fours);
    add(sixes, side, ps.sixes);
    add(dotBalls, side, ps.dot_balls);
    add(ballsBowled, side, ps.balls_bowled);
  }

  // For a specific innings, derive boundaries from events if present
  if (period !== "all") {
    const events = sport?.events || [];
    for (const ev of events) {
      if (Number(ev?.innings) !== Number(period)) continue;
      const batSide = sideForTeam(ev?.battingTeamId || ev?.teamId, homeTeamId, awayTeamId);
      // Prefer batting team on scoring events
      const inn = filteredInnings[0];
      const side = sideForTeam(inn?.battingTeamId, homeTeamId, awayTeamId) || batSide;
      if (!side) continue;
      if (ev.eventType === "boundary_4") add(fours, side, 1);
      else if (ev.eventType === "boundary_6") add(sixes, side, 1);
      else if (ev.eventType === "dot_ball" || ev.eventType === "dot") {
        const bowl = sideForTeam(inn?.bowlingTeamId, homeTeamId, awayTeamId);
        if (bowl) add(dotBalls, bowl, 1);
      }
    }
  }

  const rr = {
    home: runRate(runs.home, oversFaced.home, { isOvers: true }),
    away: runRate(runs.away, oversFaced.away, { isOvers: true }),
  };

  const boundaries = {
    home: fours.home + sixes.home,
    away: fours.away + sixes.away,
  };

  const rows = [
    { key: "runs", label: "Runs", home: runs.home, away: runs.away },
    { key: "wickets_lost", label: "Wickets lost", home: wicketsLost.home, away: wicketsLost.away },
    { key: "wickets_taken", label: "Wickets taken", home: wicketsTaken.home, away: wicketsTaken.away },
    {
      key: "run_rate",
      label: "Run rate",
      home: rr.home,
      away: rr.away,
      format: "decimal",
    },
    { key: "fours", label: "Fours", home: fours.home, away: fours.away },
    { key: "sixes", label: "Sixes", home: sixes.home, away: sixes.away },
    { key: "boundaries", label: "Boundaries", home: boundaries.home, away: boundaries.away },
    { key: "extras", label: "Extras", home: extras.home, away: extras.away },
    { key: "dot_balls", label: "Dot balls", home: dotBalls.home, away: dotBalls.away },
  ].filter((row) => {
    if (["dot_balls", "fours", "sixes", "boundaries"].includes(row.key)) {
      return row.home + row.away > 0;
    }
    return true;
  });

  // Cricket has no ball possession — use run share as the hero split bar
  const totalRuns = runs.home + runs.away;
  const possession =
    totalRuns > 0
      ? {
          home: Math.round((runs.home / totalRuns) * 100),
          away: Math.max(0, 100 - Math.round((runs.home / totalRuns) * 100)),
        }
      : { home: 50, away: 50 };

  return {
    possession,
    possessionLabel: "Run share",
    rows,
  };
};

export const buildCricketStatPeriods = (sport) => {
  const innings = Array.isArray(sport?.innings) ? sport.innings : [];
  const count = Math.max(
    Number(sport?.currentInnings) || 1,
    innings.length || 1,
    1,
  );
  const periods = [{ key: "all", label: "ALL" }];
  for (let i = 1; i <= Math.min(count, 2); i += 1) {
    periods.push({ key: String(i), label: i === 1 ? "INN 1" : "INN 2" });
  }
  return periods;
};

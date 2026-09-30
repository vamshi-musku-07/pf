// Pure helpers for Generate Next Stage UI (no React).

const getLeaguePhaseProgress = (fixtures = []) => {
  const league = (fixtures || []).filter((f) => f.stage === "league");
  const total = league.length;
  const completed = league.filter(
    (f) => f.status === "completed" || f.status === "bye",
  ).length;
  const remaining = league.filter(
    (f) => f.status !== "completed" && f.status !== "bye",
  ).length;
  return {
    completed,
    total,
    remaining,
    complete: total > 0 && remaining === 0,
  };
};

const formatDivisionHeader = (name, sport) => {
  const raw = String(name || "").trim();
  if (String(sport || "").toLowerCase() !== "football") return raw || "Division";
  if (/^group\b/i.test(raw)) return raw;
  const m = raw.match(/division\s*(\d+)/i);
  if (m) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < letters.length) return `Group ${letters[idx]}`;
  }
  return raw || "Group";
};

const formatQualifierLines = (qualifiers = [], options = {}) => {
  const perDiv = Number(options.qualifiersPerDivision) || 0;
  const sport = options.sport;
  return (qualifiers || [])
    .map((q) => {
      const teams = (q.teams || []).filter(Boolean);
      const header = formatDivisionHeader(q.divisionName || "Division", sport);
      if (!teams.length) return `${header}: —`;
      const lines = teams.map((t, idx) => {
        const rank = t.rank ?? idx + 1;
        const pts = Number(t.points);
        const ptsLabel = Number.isFinite(pts) ? ` · ${pts} pts` : "";
        const rankLabel =
          rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;
        const winnerTag = rank === 1 ? " (winner)" : "";
        return `${rankLabel} ${t.teamName || "Team"}${ptsLabel}${winnerTag}`;
      });
      if (perDiv === 1 && teams.length === 1) {
        return `${header}: ${lines[0]}`;
      }
      return `${header}: ${lines.join(", ")}`;
    })
    .join("\n");
};

const formatSeedLine = (seedOrder = []) =>
  (seedOrder || []).map((s) => s.teamName || "Team").join(" · ");

const formatBracketSummaryLine = (bracketSummary) => {
  if (!bracketSummary) return "";
  const { qualifierCount, rounds = [], byeCount } = bracketSummary;
  const stagePath = rounds.join(" → ");
  if (byeCount > 0) {
    return `Bracket: ${qualifierCount} teams → ${stagePath} (${byeCount} bye${byeCount === 1 ? "" : "s"})`;
  }
  return `Bracket: ${qualifierCount} teams → ${stagePath}`;
};

const buildNextStageConfirmMessage = (preview) => {
  if (!preview) return "Generate the knockout stage from current standings?";
  const lines = [];
  if (preview.qualifiers?.length) {
    lines.push("Qualifiers:");
    lines.push(
      formatQualifierLines(preview.qualifiers, {
        qualifiersPerDivision: preview.qualifiersPerDivision,
        sport: preview.sport,
      }),
    );
  }
  if (preview.seedOrder?.length) {
    lines.push("");
    lines.push(`Seeds: ${formatSeedLine(preview.seedOrder)}`);
  }
  const bracketLine = formatBracketSummaryLine(preview.bracketSummary);
  if (bracketLine) {
    lines.push("");
    lines.push(bracketLine);
  }
  lines.push("");
  lines.push("This cannot be undone. Continue?");
  return lines.join("\n");
};

module.exports = {
  getLeaguePhaseProgress,
  formatQualifierLines,
  formatSeedLine,
  formatBracketSummaryLine,
  buildNextStageConfirmMessage,
};

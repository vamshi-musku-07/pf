import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { teamAbbrev } from "@/lib/homeUpcomingGames";
import { logoRequireMap } from "@/app/team/tabs/helpers";

export const TABS = ["Standings", "Matches", "Teams", "Leaderboard", "Stats", "Bracket", "Manage"];

export const PUBLIC_TABS = ["Standings", "Matches", "Teams", "Leaderboard", "Stats", "Bracket"];

export const MATCH_FILTERS = ["Live", "Upcoming", "Past"];

export const DIVISION_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export {
  QUALIFIERS_PER_DIVISION_OPTIONS,
  SINGLE_DIVISION_PLAYOFF_OPTIONS,
  suggestDivisionCount,
  describeDivisionLayout,
  divisionCountTip,
  divisionPlayoffTip,
  buildHybridPlayoffConfig,
  describeKnockoutAutoStage,
  divisionUnitLabel,
  isFootballSport,
} from "./createConfig";

export {
  GROUP_LETTERS,
  formatDivisionDisplayName,
  divisionCopy,
  getDivisionName,
  FORMAT_LABEL,
  formatLabelForSport,
} from "./divisionNaming";

export const formatShortDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
};

export const formatDateRange = (start, end) => {
  const s = formatShortDate(start);
  const e = formatShortDate(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `From ${s}`;
  if (e) return `Until ${e}`;
  return null;
};

export const formOf = (letter) => {
  const map = {
    W: { bg: "#22C55E", t: "W" },
    L: { bg: "#EF4444", t: "L" },
    T: { bg: "#F59E0B", t: "T" },
    D: { bg: "#F59E0B", t: "D" },
    NR: { bg: "#9CA3AF", t: "N" },
  };
  return map[letter] || map.NR;
};

export const fmtNrr = (n) => {
  const v = Number(n || 0);
  return `${v > 0 ? "+" : ""}${v.toFixed(3)}`;
};

export const ballsToOversLabel = (balls) => {
  const b = Number(balls);
  if (!Number.isFinite(b) || b <= 0) return "";
  const full = Math.floor(b / 6);
  const rem = b % 6;
  return rem ? `${full}.${rem}` : String(full);
};

export function resolveTournamentTeamLogo(logoKey) {
  if (!logoKey || typeof logoKey !== "string") return null;
  if (logoRequireMap[logoKey]) return logoRequireMap[logoKey];
  const withSlash = logoKey.startsWith("/") ? logoKey : `/${logoKey}`;
  if (logoRequireMap[withSlash]) return logoRequireMap[withSlash];
  if (!logoKey.includes("/") && logoRequireMap[`/team-logos/${logoKey}`]) {
    return logoRequireMap[`/team-logos/${logoKey}`];
  }
  if (/^https?:\/\//i.test(logoKey)) return { uri: logoKey };
  return null;
}

export function TournamentTeamLogo({ teamLogo, teamName, size = 22 }) {
  const source = resolveTournamentTeamLogo(teamLogo);
  const abbrev = teamAbbrev(teamName, "?");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#E2E8F0",
      }}
    >
      {source ? (
        <ExpoImage
          source={source}
          style={{ width: size - 4, height: size - 4 }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      ) : (
        <Text style={{ fontSize: Math.max(8, size * 0.36), fontWeight: "800", color: "#64748B" }}>{abbrev}</Text>
      )}
    </View>
  );
}

export function sortDivisions(divisions = []) {
  return [...(divisions || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function pickDefaultDivisionId(tournament, hintTeamId) {
  const divs = sortDivisions(tournament?.divisions);
  if (!divs.length) return "main";
  if (hintTeamId) {
    const team = (tournament?.teams || []).find((t) => String(t.teamId) === String(hintTeamId));
    if (team?.divisionId && divs.some((d) => String(d.id) === String(team.divisionId))) {
      return String(team.divisionId);
    }
  }
  return String(divs[0].id);
}

export function standingsForDivision(data, divisionId) {
  const byDiv = data?.standingsByDivision;
  if (byDiv && divisionId && byDiv[divisionId]) return byDiv[divisionId];
  if (byDiv && byDiv.main) return byDiv.main;
  return data?.standings || [];
}

export function filterLeagueFixturesByDivision(fixtures = [], divisionId) {
  if (!divisionId) return fixtures.filter((f) => f.stage === "league");
  return fixtures.filter(
    (f) => f.stage === "league" && String(f.divisionId || "main") === String(divisionId),
  );
}

export const formatFixtureDateTime = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${date} · ${time}`;
  } catch {
    return null;
  }
};

export const isFixtureLive = (fixture) => {
  const liveStatuses = new Set(["live", "halftime"]);
  return liveStatuses.has(fixture?.gameStatus) || liveStatuses.has(fixture?.status);
};

export const isFixturePast = (fixture) =>
  fixture?.status === "completed" || fixture?.status === "bye";

export const isFixtureUpcoming = (fixture) =>
  !isFixtureLive(fixture) && !isFixturePast(fixture);

export const classifyFixture = (fixture) => {
  if (isFixtureLive(fixture)) return "live";
  if (isFixturePast(fixture)) return "past";
  return "upcoming";
};

export const filterFixturesByMatchStatus = (fixtures = [], filter = "Upcoming") => {
  const key = String(filter || "Upcoming").toLowerCase();
  return (fixtures || []).filter((fixture) => {
    const bucket = classifyFixture(fixture);
    if (key === "live") return bucket === "live";
    if (key === "past") return bucket === "past";
    return bucket === "upcoming";
  });
};

export const countFixturesByMatchFilter = (fixtures = []) => {
  const counts = { Live: 0, Upcoming: 0, Past: 0 };
  for (const fixture of fixtures || []) {
    const bucket = classifyFixture(fixture);
    if (bucket === "live") counts.Live += 1;
    else if (bucket === "past") counts.Past += 1;
    else counts.Upcoming += 1;
  }
  return counts;
};

/** Live count: division list (+ optional knockout live scope); upcoming/past from division list. */
export const countFixturesByMatchFilterScoped = (
  divisionFixtures = [],
  liveScopeFixtures = divisionFixtures,
) => ({
  Live: countFixturesByMatchFilter(liveScopeFixtures).Live,
  Upcoming: countFixturesByMatchFilter(divisionFixtures).Upcoming,
  Past: countFixturesByMatchFilter(divisionFixtures).Past,
});

/**
 * Live filter scope for Matches tab.
 * - League/hybrid: selected division fixtures + non-league (knockout/playoff) fixtures
 *   so a Div 1 live game does not appear under Div 2.
 * - Knockout-only: all fixtures.
 */
export const buildMatchLiveScopeFixtures = (
  divisionFixtures = [],
  allFixtures = [],
  format = "league",
) => {
  if (format === "knockout") return allFixtures?.length ? allFixtures : divisionFixtures;
  const divisionList = divisionFixtures || [];
  const seen = new Set(divisionList.map((f) => String(f?._id || f?.id || "")));
  const knockoutExtras = (allFixtures || []).filter((f) => {
    if (!f || f.stage === "league") return false;
    const id = String(f._id || f.id || "");
    return id ? !seen.has(id) : true;
  });
  return [...divisionList, ...knockoutExtras];
};

export const pickDefaultMatchFilter = (fixtures = []) => {
  const counts = countFixturesByMatchFilter(fixtures);
  if (counts.Live > 0) return "Live";
  if (counts.Upcoming > 0) return "Upcoming";
  return "Past";
};

export const sortFixturesForMatchFilter = (fixtures = [], filter = "Upcoming") => {
  const list = [...(fixtures || [])];
  const key = String(filter || "Upcoming").toLowerCase();

  const byScheduled = (a, b) => {
    const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return (a.matchNumber || 0) - (b.matchNumber || 0);
  };

  if (key === "past") {
    return list.sort((a, b) => (b.matchNumber || 0) - (a.matchNumber || 0));
  }
  if (key === "live") {
    return list.sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
  }
  return list.sort(byScheduled);
};

export const TEAM_MATCH_HISTORY_PAGE = 5;

export const getTeamLeagueFixtures = (fixtures = [], teamId) => {
  const tid = String(teamId);
  return (fixtures || [])
    .filter((f) => f.stage === "league")
    .filter((f) => String(f.homeTeamId) === tid || String(f.awayTeamId) === tid)
    .filter((f) => f.status === "completed" || f.status === "bye");
};

export const describeTeamMatchResult = (fixture, teamId) => {
  const tid = String(teamId);
  const isHome = String(fixture.homeTeamId) === tid;
  const opponentName = isHome
    ? fixture.awayTeamName || fixture.awaySource || "Opponent"
    : fixture.homeTeamName || fixture.homeSource || "Opponent";

  if (fixture.status === "bye") {
    return {
      fixture,
      opponentName,
      outcome: "BYE",
      summary: "Bye",
      margin: "",
      gameId: null,
      scheduledLabel: formatFixtureDateTime(fixture.scheduledAt),
    };
  }

  const res = fixture.result;
  if (!res) {
    return {
      fixture,
      opponentName,
      outcome: "?",
      summary: `vs ${opponentName}`,
      margin: "",
      gameId: fixture.gameId,
      scheduledLabel: formatFixtureDateTime(fixture.scheduledAt),
    };
  }

  if (res.isNoResult) {
    return {
      fixture,
      opponentName,
      outcome: "NR",
      summary: `vs ${opponentName}`,
      margin: res.margin || "No result",
      gameId: fixture.gameId,
      scheduledLabel: formatFixtureDateTime(fixture.scheduledAt),
    };
  }

  if (res.isTie || !res.winnerTeamId) {
    return {
      fixture,
      opponentName,
      outcome: "T",
      summary: `vs ${opponentName}`,
      margin: res.margin || "Tie",
      gameId: fixture.gameId,
      scheduledLabel: formatFixtureDateTime(fixture.scheduledAt),
    };
  }

  const won = String(res.winnerTeamId) === tid;
  const side = isHome ? res.home : res.away;
  const oppSide = isHome ? res.away : res.home;
  const hasWickets = side?.wickets != null || oppSide?.wickets != null;
  const scoreLine =
    side?.runs != null && oppSide?.runs != null
      ? hasWickets
        ? `${side.runs}/${side.wickets ?? 0} beat ${oppSide.runs}/${oppSide.wickets ?? 0}`
        : `${side.runs}-${oppSide.runs}`
      : null;

  return {
    fixture,
    opponentName,
    outcome: won ? "W" : "L",
    summary: won ? `Beat ${opponentName}` : `Lost to ${opponentName}`,
    margin: res.margin || scoreLine || (won ? "Won" : "Lost"),
    gameId: fixture.gameId,
    scheduledLabel: formatFixtureDateTime(fixture.scheduledAt),
  };
};

export const buildTeamMatchHistory = (fixtures = [], teamId) =>
  getTeamLeagueFixtures(fixtures, teamId)
    .map((fixture) => describeTeamMatchResult(fixture, teamId))
    .sort((a, b) => (b.fixture?.matchNumber || 0) - (a.fixture?.matchNumber || 0));

export const NRR_HELP_POINTS = [
  "Net Run Rate (NRR) = (Runs scored ÷ Balls faced) − (Runs conceded ÷ Balls bowled), per over.",
  "Only completed league innings count. No-result matches give points but do not change NRR.",
  "If a team is all out, their innings is counted as the full quota (e.g. 20 overs in T20).",
  "Ties are ranked by NRR after points, then wins, then team name.",
];

export const mergeTeamsWithStandings = (teams = [], standings = []) => {
  const byId = Object.fromEntries((standings || []).map((row) => [String(row.teamId), row]));
  return (teams || []).map((team) => ({
    ...team,
    stats: byId[String(team.teamId)] || null,
  }));
};

export const sortTeamsForDisplay = (teams = [], standings = []) => {
  const rank = new Map((standings || []).map((row, idx) => [String(row.teamId), idx]));
  return [...teams].sort((a, b) => {
    const ra = rank.get(String(a.teamId));
    const rb = rank.get(String(b.teamId));
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return (a.teamName || "").localeCompare(b.teamName || "");
  });
};

export function EmptyState({ icon, title, subtitle, isDark = false, T }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 20 }}>
      <Ionicons name={icon} size={54} color={isDark ? T?.iconMuted || "#A1A1AA" : "#CBD5E1"} />
      <Text
        style={{
          fontSize: 16,
          fontWeight: "800",
          color: isDark ? T?.text || "#F5F5F7" : "#0B1324",
          marginTop: 14,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: isDark ? T?.textDim || "#A1A1AA" : "#6B7280",
          textAlign: "center",
          marginTop: 6,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

export function SectionCard({ title, action, actions, children, isDark = false, T }) {
  const actionList = actions || (action ? [action] : []);
  const linkColor = isDark ? "#93C5FD" : "#2563EB";
  return (
    <View
      style={{
        backgroundColor: isDark ? T?.surface || "#16161A" : "#fff",
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: isDark ? T?.border || "#2A2A2E" : "#EEF2F6",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: "800",
            color: isDark ? T?.text || "#F5F5F7" : "#0B1324",
          }}
        >
          {title}
        </Text>
        {actionList.length > 0 && (
          <View style={{ flexDirection: "row", gap: 12 }}>
            {actionList.map((a) => (
              <TouchableOpacity key={a.label} onPress={a.onPress}>
                <Text style={{ color: linkColor, fontWeight: "700", fontSize: 13 }}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, busy, isDark = false, T }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: "#0B1324",
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
        ...(isDark && { borderWidth: 1, borderColor: T?.border || "#2A2A2E" }),
      }}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: "#fff", fontWeight: "800" }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function StatusPill({ status }) {
  const map = {
    pending: { bg: "#F1F5F9", t: "#64748B", l: "Upcoming" },
    scheduled: { bg: "#EFF6FF", t: "#2563EB", l: "Scheduled" },
    live: { bg: "#FEF2F2", t: "#DC2626", l: "Live" },
    completed: { bg: "#F0FDF4", t: "#16A34A", l: "Completed" },
    bye: { bg: "#F5F3FF", t: "#7C3AED", l: "Bye" },
  };
  const s = map[status] || map.pending;
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={{ color: s.t, fontSize: 10, fontWeight: "700" }}>{s.l}</Text>
    </View>
  );
}

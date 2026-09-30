import { View, Text } from "react-native";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import {
  buildVolleyballScorecard,
  formatVolleyballDiff,
} from "./volleyball/volleyballScorecard";

const COL = {
  team: { flex: 1.4, minWidth: 88 },
  set: { width: 36 },
  num: { width: 44 },
};

function Cell({ children, style, align = "center" }) {
  return (
    <View style={[{ justifyContent: "center", alignItems: align === "left" ? "flex-start" : "center" }, style]}>
      {children}
    </View>
  );
}

/**
 * SofaScore-style volleyball scorecard:
 * set-by-set grid + P (points) / Diff / PTS (sets won).
 */
export function VolleyballScorecardMobile({
  currentGame,
  teamNames = { home: "Home", away: "Away" },
}) {
  const UI = useGameScoringTheme();
  const sport = currentGame?.sport || {};
  const card = buildVolleyballScorecard(sport, teamNames);

  const headerMuted = {
    color: UI.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  };
  const cellText = {
    color: UI.text,
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  };
  const softCard = UI.isDark ? "rgba(255,255,255,0.04)" : UI.cardElevated;
  const softBorder = UI.isDark ? "rgba(255,255,255,0.08)" : UI.border;
  const winGreen = UI.isDark ? "#4ade80" : "#15803D";
  const liveAmber = UI.isDark ? "#facc15" : "#B45309";

  if (!card.matchStarted && card.setColumns.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: "center", gap: 8 }}>
        <Text style={{ color: UI.muted, fontSize: 14, fontWeight: "700" }}>No sets yet</Text>
        <Text style={{ color: UI.textMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 24 }}>
          Start scoring rallies and the set-by-set scorecard will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {/* Set grid + P / Diff / PTS table */}
      <View
        style={{
          backgroundColor: UI.card,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: softBorder,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderBottomWidth: 1,
            borderBottomColor: softBorder,
            backgroundColor: softCard,
          }}
        >
          <Cell style={COL.team} align="left">
            <Text style={headerMuted}>Team</Text>
          </Cell>
          {card.setColumns.map((col) => (
            <Cell key={col.setNumber} style={COL.set}>
              <Text style={{ ...headerMuted, color: col.live ? liveAmber : UI.muted }}>
                {col.label}
              </Text>
            </Cell>
          ))}
          <Cell style={COL.num}>
            <Text style={headerMuted}>P</Text>
          </Cell>
          <Cell style={COL.num}>
            <Text style={headerMuted}>Diff</Text>
          </Cell>
          <Cell style={COL.num}>
            <Text style={headerMuted}>PTS</Text>
          </Cell>
        </View>

        {/* Team rows — ordered like SofaScore (leader first) */}
        {card.rows.map((row, idx) => {
          const isLeader = idx === 0 && (row.PTS > 0 || row.P > 0);
          return (
            <View
              key={row.side}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderBottomWidth: idx === card.rows.length - 1 ? 0 : 1,
                borderBottomColor: softBorder,
                backgroundColor: isLeader
                  ? (UI.isDark ? "rgba(74,222,128,0.06)" : "#F0FDF4")
                  : "transparent",
              }}
            >
              <Cell style={COL.team} align="left">
                <Text style={{ color: UI.text, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
                  {row.name}
                </Text>
              </Cell>
              {row.sets.map((s) => {
                const highlight = s.won || s.live;
                return (
                  <Cell key={`${row.side}-${s.setNumber}`} style={COL.set}>
                    <Text
                      style={{
                        ...cellText,
                        fontSize: 15,
                        color: s.won ? winGreen : s.live ? liveAmber : UI.text,
                        fontWeight: highlight ? "900" : "700",
                      }}
                    >
                      {s.score}
                    </Text>
                  </Cell>
                );
              })}
              <Cell style={COL.num}>
                <Text style={cellText}>{row.P}</Text>
              </Cell>
              <Cell style={COL.num}>
                <Text
                  style={{
                    ...cellText,
                    color: row.Diff > 0 ? winGreen : row.Diff < 0 ? (UI.isDark ? "#f87171" : "#DC2626") : UI.text,
                  }}
                >
                  {formatVolleyballDiff(row.Diff)}
                </Text>
              </Cell>
              <Cell style={COL.num}>
                <Text style={{ ...cellText, fontSize: 16, color: winGreen }}>{row.PTS}</Text>
              </Cell>
            </View>
          );
        })}
      </View>

      {/* Per-set breakdown */}
      {card.setColumns.length > 0 ? (
        <View
          style={{
            backgroundColor: UI.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: softBorder,
            padding: 14,
            gap: 10,
          }}
        >
          <Text style={headerMuted}>Set breakdown</Text>
          {card.setColumns.map((col) => {
            const homeWon = col.winner === "home";
            const awayWon = col.winner === "away";
            return (
              <View
                key={`break-${col.setNumber}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: softCard,
                  borderWidth: 1,
                  borderColor: col.live ? liveAmber : softBorder,
                }}
              >
                <Text style={{ color: UI.muted, fontSize: 11, fontWeight: "800", width: 52 }}>
                  Set {col.setNumber}
                  {col.live ? " · LIVE" : col.complete ? "" : ""}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" }}>
                  <Text
                    style={{
                      color: homeWon ? winGreen : UI.text,
                      fontSize: 16,
                      fontWeight: "900",
                      fontVariant: ["tabular-nums"],
                      minWidth: 28,
                      textAlign: "right",
                    }}
                  >
                    {col.homeScore}
                  </Text>
                  <Text style={{ color: UI.muted, fontWeight: "700" }}>–</Text>
                  <Text
                    style={{
                      color: awayWon ? winGreen : UI.text,
                      fontSize: 16,
                      fontWeight: "900",
                      fontVariant: ["tabular-nums"],
                      minWidth: 28,
                      textAlign: "left",
                    }}
                  >
                    {col.awayScore}
                  </Text>
                </View>
                <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", width: 64, textAlign: "right" }}>
                  {col.complete
                    ? (homeWon ? teamNames.home : teamNames.away)
                    : col.live
                      ? "In play"
                      : "—"}
                  {col.complete ? " won" : ""}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Legend */}
      <View
        style={{
          backgroundColor: softCard,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: softBorder,
          padding: 12,
          gap: 6,
        }}
      >
        <Text style={headerMuted}>Legend</Text>
        <Text style={{ color: UI.text, fontSize: 12, lineHeight: 18 }}>
          <Text style={{ fontWeight: "800" }}>P</Text> — Points scored (all sets){"\n"}
          <Text style={{ fontWeight: "800" }}>Diff</Text> — Point difference (scored − conceded){"\n"}
          <Text style={{ fontWeight: "800" }}>PTS</Text> — Sets won
        </Text>
      </View>
    </View>
  );
}

export default VolleyballScorecardMobile;

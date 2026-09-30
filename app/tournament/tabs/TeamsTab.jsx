import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import {
  EmptyState,
  TournamentTeamLogo,
  fmtNrr,
  mergeTeamsWithStandings,
  sortTeamsForDisplay,
  getDivisionName,
  divisionCopy,
} from "@/features/tournament/helpers";
import TeamMatchHistory from "./TeamMatchHistory";

function StatChip({ label, value, highlight, isDark, T }) {
  return (
    <View style={{ alignItems: "center", minWidth: 36 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: isDark ? T.textMuted : "#94A3B8" }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: highlight ? "800" : "600",
          color: highlight
            ? isDark
              ? T.text
              : "#0B1324"
            : isDark
              ? T.textDim
              : "#374151",
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const fmtGd = (n) => {
  const v = Number(n) || 0;
  if (v > 0) return `+${v}`;
  return String(v);
};

export default function TeamsTab({
  teams = [],
  standings = [],
  divisions = [],
  fixtures = [],
  format,
  sport,
  hasMultipleDivisions = false,
  onOpenTeam,
  onOpenFixture,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const sportName = String(sport || "").toLowerCase();
  const isFootball = sportName === "football";
  const isVolleyball = sportName === "volleyball";
  const isBaseball = sportName === "baseball";
  const isBasketball = sportName === "basketball";
  const groupWording = isFootball || isVolleyball || isBaseball || isBasketball;

  const fmtPct = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return ".000";
    const text = n.toFixed(3);
    return text.startsWith("0") ? text.slice(1) : text;
  };


  const entries = useMemo(() => {
    const merged = mergeTeamsWithStandings(teams, standings);
    return sortTeamsForDisplay(merged, standings);
  }, [teams, standings]);

  if (!entries.length) {
    return (
      <EmptyState
        icon="people-outline"
        title="No teams enrolled"
        subtitle="Teams appear here once they join the tournament."
        isDark={isDark}
        T={T}
      />
    );
  }

  const showStats = format !== "knockout";
  const cardBg = isDark ? T.surface : "#fff";
  const cardBorder = isDark ? T.border : "#E2E8F0";
  const titleColor = isDark ? T.text : "#0B1324";
  const rowBorder = isDark ? T.borderSubtle : "#F1F5F9";
  const expandBarBg = isDark ? T.surfaceAlt : "#FAFBFC";
  const historyBg = isDark ? T.bgAlt : "#F8FAFC";

  return (
    <View>
      <Text style={{ fontSize: 13, color: isDark ? T.textDim : "#6B7280", marginBottom: 12 }}>
        {entries.length} team{entries.length === 1 ? "" : "s"}
        {hasMultipleDivisions
          ? ` in this ${divisionCopy(sport).singularLower}`
          : " in the tournament"}
      </Text>

      {entries.map((entry) => {
        const tid = String(entry.teamId);
        const expanded = expandedTeamId === tid;
        const stats = entry.stats;
        const rank = standings.findIndex((r) => String(r.teamId) === tid) + 1;

        return (
          <View
            key={tid}
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: cardBorder,
              marginBottom: 10,
              overflow: "hidden",
            }}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onOpenTeam?.(tid)}
              style={{ padding: 14 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {showStats && rank > 0 ? (
                  <Text
                    style={{
                      width: 24,
                      fontWeight: "800",
                      color: isDark ? T.textMuted : "#94A3B8",
                      fontSize: 13,
                    }}
                  >
                    {rank}
                  </Text>
                ) : (
                  <View style={{ width: 24 }} />
                )}
                <TournamentTeamLogo teamLogo={entry.teamLogo} teamName={entry.teamName} size={40} />
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text
                    style={{ fontSize: 15, fontWeight: "800", color: titleColor }}
                    numberOfLines={1}
                  >
                    {entry.teamName}
                  </Text>
                  {hasMultipleDivisions ? (
                    <Text
                      style={{
                        fontSize: 11,
                        color: isDark ? T.textMuted : "#9CA3AF",
                        marginTop: 2,
                      }}
                    >
                      {getDivisionName(divisions, entry.divisionId, sport)}
                    </Text>
                  ) : null}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={isDark ? T.iconMuted : "#CBD5E1"}
                />
              </View>

              {showStats && stats ? (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: rowBorder,
                  }}
                >
                  {isFootball ? (
                    <>
                      <StatChip label="P" value={stats.played ?? 0} isDark={isDark} T={T} />
                      <StatChip label="W" value={stats.won ?? 0} isDark={isDark} T={T} />
                      <StatChip label="D" value={stats.tied ?? stats.drawn ?? 0} isDark={isDark} T={T} />
                      <StatChip label="L" value={stats.lost ?? 0} isDark={isDark} T={T} />
                      <StatChip label="GD" value={fmtGd(stats.gd)} isDark={isDark} T={T} />
                      <StatChip label="Pts" value={stats.points ?? 0} highlight isDark={isDark} T={T} />
                    </>
                  ) : isVolleyball ? (
                    <>
                      <StatChip label="P" value={stats.played ?? 0} isDark={isDark} T={T} />
                      <StatChip label="W" value={stats.won ?? 0} isDark={isDark} T={T} />
                      <StatChip label="L" value={stats.lost ?? 0} isDark={isDark} T={T} />
                      <StatChip label="SW" value={stats.setsWon ?? 0} isDark={isDark} T={T} />
                      <StatChip
                        label="PD"
                        value={fmtGd(stats.setDiff ?? (stats.setsWon || 0) - (stats.setsLost || 0))}
                        isDark={isDark}
                        T={T}
                      />
                      <StatChip label="Pts" value={stats.points ?? 0} highlight isDark={isDark} T={T} />
                    </>
                  ) : isBaseball ? (
                    <>
                      <StatChip label="P" value={stats.played ?? 0} isDark={isDark} T={T} />
                      <StatChip label="W" value={stats.won ?? 0} isDark={isDark} T={T} />
                      <StatChip label="L" value={stats.lost ?? 0} isDark={isDark} T={T} />
                      <StatChip
                        label="RD"
                        value={fmtGd(stats.runDifferential ?? (stats.runsScored || 0) - (stats.runsAllowed || 0))}
                        isDark={isDark}
                        T={T}
                      />
                      <StatChip
                        label="PCT"
                        value={fmtPct(stats.winPercentage)}
                        highlight
                        isDark={isDark}
                        T={T}
                      />
                    </>
                  ) : isBasketball ? (
                    <>
                      <StatChip label="P" value={stats.played ?? 0} isDark={isDark} T={T} />
                      <StatChip label="W" value={stats.won ?? 0} isDark={isDark} T={T} />
                      <StatChip label="L" value={stats.lost ?? 0} isDark={isDark} T={T} />
                      <StatChip
                        label="PD"
                        value={fmtGd(stats.pointDiff ?? (stats.pointsFor || 0) - (stats.pointsAgainst || 0))}
                        isDark={isDark}
                        T={T}
                      />
                      <StatChip label="Pts" value={stats.points ?? 0} isDark={isDark} T={T} />
                      <StatChip label="PCT" value={fmtPct(stats.winPercentage)} highlight isDark={isDark} T={T} />
                    </>
                  ) : (
                    <>
                      <StatChip label="P" value={stats.played ?? 0} isDark={isDark} T={T} />
                      <StatChip label="W" value={stats.won ?? 0} isDark={isDark} T={T} />
                      <StatChip label="L" value={stats.lost ?? 0} isDark={isDark} T={T} />
                      <StatChip label="Pts" value={stats.points ?? 0} highlight isDark={isDark} T={T} />
                      <StatChip label="NRR" value={fmtNrr(stats.nrr)} isDark={isDark} T={T} />
                    </>
                  )}
                </View>
              ) : showStats ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? T.textMuted : "#9CA3AF",
                    marginTop: 10,
                  }}
                >
                  No league results yet
                </Text>
              ) : null}
            </TouchableOpacity>

            {showStats ? (
              <TouchableOpacity
                onPress={() => setExpandedTeamId((prev) => (prev === tid ? null : tid))}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: rowBorder,
                  backgroundColor: expandBarBg,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isDark ? T.textDim : "#475569",
                  }}
                >
                  {expanded ? "Hide match history" : "Match history"}
                </Text>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={isDark ? T.iconMuted : "#94A3B8"}
                />
              </TouchableOpacity>
            ) : null}

            {expanded ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 12, backgroundColor: historyBg }}>
                <TeamMatchHistory
                  teamId={tid}
                  teamName={entry.teamName}
                  fixtures={fixtures}
                  onOpenFixture={onOpenFixture}
                  isDark={isDark}
                  T={T}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

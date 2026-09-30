import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TournamentTeamLogo } from "@/features/tournament/helpers";
import {
  formatRecord,
  formatPct,
  formatStreak,
  streakTone,
  formatStandingsUpdatedAt,
  BASKETBALL_TIE_BREAK_RULES,
  BASKETBALL_LEGEND,
} from "@/features/tournament/standingsConfig";
import TeamMatchHistory from "./TeamMatchHistory";

const COL_W = { record: 62, points: 46, pct: 52, streak: 44 };

export default function BasketballStandingsTable({
  standings = [],
  logoByTeamId = {},
  tournament,
  fixtures = [],
  focusTeamId,
  expandedTeamId,
  onToggleRow,
  onOpenFixture,
  playoffCut = 0,
  title,
  updatedAt,
  isDark,
  T,
}) {
  const [legendOpen, setLegendOpen] = useState(true);

  const cardBg = isDark ? T.surface : "#fff";
  const cardBorder = isDark ? T.border : "#EEF2F6";
  const titleColor = isDark ? T.text : "#0B1324";
  const mutedLabel = isDark ? T.textMuted : "#94A3B8";
  const statColor = isDark ? T.textDim : "#4B5563";
  const rowBorder = isDark ? T.borderSubtle : "#F1F5F9";
  const historyBg = isDark ? T.bgAlt : "#F8FAFC";
  const qualifyBg = isDark ? "rgba(34,197,94,0.12)" : "#F0FDF4";
  const selectedBg = isDark ? "rgba(99,102,241,0.16)" : "#EEF2FF";
  const qualifyAccent = isDark ? "#22C55E" : "#16A34A";
  const winColor = isDark ? "#4ADE80" : "#15803D";
  const lossColor = isDark ? "#F87171" : "#B91C1C";
  const updatedLabel = formatStandingsUpdatedAt(updatedAt);

  const renderStreak = (row) => {
    const value = formatStreak(row);
    const tone = streakTone(value);
    return (
      <Text
        style={{
          width: COL_W.streak,
          textAlign: "center",
          fontSize: 13,
          fontWeight: "700",
          color: tone === "positive" ? winColor : tone === "negative" ? lossColor : statColor,
        }}
      >
        {value}
      </Text>
    );
  };

  return (
    <View>
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: cardBorder,
          paddingBottom: 12,
          overflow: "hidden",
        }}
      >
        {title ? (
          <Text
            style={{
              fontSize: 15,
              fontWeight: "800",
              color: titleColor,
              paddingHorizontal: 14,
              paddingTop: 14,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 8,
          }}
        >
          <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: mutedLabel }}>
            {playoffCut > 0 ? "Playoffs" : "Team"}
          </Text>
          <Text style={{ width: COL_W.record, textAlign: "center", fontSize: 11, fontWeight: "700", color: mutedLabel }}>
            W-L
          </Text>
          <Text style={{ width: COL_W.points, textAlign: "center", fontSize: 11, fontWeight: "700", color: mutedLabel }}>
            PTS
          </Text>
          <Text style={{ width: COL_W.pct, textAlign: "center", fontSize: 11, fontWeight: "700", color: mutedLabel }}>
            PCT
          </Text>
          <Text style={{ width: COL_W.streak, textAlign: "center", fontSize: 11, fontWeight: "700", color: mutedLabel }}>
            STR
          </Text>
        </View>

        {standings.map((row, idx) => {
          const tid = String(row.teamId);
          const qualifies = playoffCut > 0 && idx < playoffCut;
          const selected = tid === String(focusTeamId);
          const expanded = tid === expandedTeamId;
          const bg = selected || expanded ? selectedBg : qualifies ? qualifyBg : "transparent";

          return (
            <View key={tid}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onToggleRow?.(tid)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingRight: 14,
                  paddingLeft: 10,
                  backgroundColor: bg,
                  borderLeftWidth: 4,
                  borderLeftColor: qualifies ? qualifyAccent : "transparent",
                  borderBottomWidth: expanded ? 0 : 1,
                  borderBottomColor: rowBorder,
                }}
              >
                <Text style={{ width: 22, fontSize: 12, fontWeight: "700", color: mutedLabel }}>
                  {idx + 1}
                </Text>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingRight: 6 }}>
                  <TournamentTeamLogo
                    teamLogo={row.teamLogo || logoByTeamId[tid]}
                    teamName={row.teamName}
                    size={24}
                  />
                  <Text
                    style={{ flex: 1, fontSize: 13, fontWeight: "700", color: titleColor }}
                    numberOfLines={1}
                  >
                    {row.teamName}
                  </Text>
                </View>
                <Text
                  style={{
                    width: COL_W.record,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: "600",
                    color: statColor,
                  }}
                >
                  {formatRecord(row)}
                </Text>
                <Text
                  style={{
                    width: COL_W.points,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: "800",
                    color: titleColor,
                  }}
                >
                  {row.points ?? 0}
                </Text>
                <Text
                  style={{
                    width: COL_W.pct,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: "700",
                    color: statColor,
                  }}
                >
                  {formatPct(row.winPercentage)}
                </Text>
                {renderStreak(row)}
              </TouchableOpacity>

              {expanded ? (
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingBottom: 12,
                    backgroundColor: historyBg,
                    borderBottomWidth: 1,
                    borderBottomColor: cardBorder,
                  }}
                >
                  <TeamMatchHistory
                    teamId={tid}
                    teamName={row.teamName}
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

        {updatedLabel ? (
          <Text
            style={{
              fontSize: 11,
              color: mutedLabel,
              textAlign: "right",
              paddingHorizontal: 14,
              paddingTop: 12,
            }}
          >
            Last updated: {updatedLabel}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          marginTop: 12,
          backgroundColor: cardBg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: cardBorder,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => setLegendOpen((prev) => !prev)}
          activeOpacity={0.7}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Text style={{ fontSize: 14, fontWeight: "800", color: titleColor }}>Rules and legend</Text>
          <Ionicons
            name={legendOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color={isDark ? T.iconMuted : "#94A3B8"}
          />
        </TouchableOpacity>

        {legendOpen ? (
          <View style={{ marginTop: 12 }}>
            {playoffCut > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <View
                  style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: qualifyAccent }}
                />
                <Text style={{ fontSize: 12, fontWeight: "600", color: statColor }}>Playoffs</Text>
              </View>
            ) : null}

            <Text style={{ fontSize: 12, color: statColor, marginBottom: 6, lineHeight: 18 }}>
              If teams are tied the following rules break the tie:
            </Text>
            {BASKETBALL_TIE_BREAK_RULES.map((rule, idx) => (
              <Text key={rule} style={{ fontSize: 12, color: statColor, lineHeight: 19 }}>
                {idx + 1}. {rule}
              </Text>
            ))}

            <View style={{ marginTop: 12, gap: 6 }}>
              {BASKETBALL_LEGEND.map((item) => (
                <View key={item.key} style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ width: 52, fontSize: 12, fontWeight: "800", color: mutedLabel }}>
                    {item.key}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 12, color: statColor }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  TEAM_MATCH_HISTORY_PAGE,
  buildTeamMatchHistory,
  formOf,
} from "@/features/tournament/helpers";

export default function TeamMatchHistory({
  teamId,
  teamName,
  fixtures = [],
  onOpenFixture,
  isDark = false,
  T,
}) {
  const history = buildTeamMatchHistory(fixtures, teamId);
  const [visibleCount, setVisibleCount] = useState(TEAM_MATCH_HISTORY_PAGE);
  const linkColor = isDark ? "#93C5FD" : "#2563EB";
  const titleColor = isDark ? T?.text || "#F5F5F7" : "#0B1324";
  const muted = isDark ? T?.textMuted || "#71717A" : "#9CA3AF";
  const dim = isDark ? T?.textDim || "#A1A1AA" : "#64748B";
  const rowBorder = isDark ? T?.borderSubtle || "#27272A" : "#EEF2F6";
  const sectionLabel = isDark ? T?.textMuted || "#71717A" : "#94A3B8";

  useEffect(() => {
    setVisibleCount(TEAM_MATCH_HISTORY_PAGE);
  }, [teamId, fixtures]);

  if (!history.length) {
    return (
      <View style={{ paddingVertical: 10, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 12, color: muted }}>No completed league matches yet.</Text>
      </View>
    );
  }

  const shown = history.slice(0, visibleCount);
  const hasMore = history.length > visibleCount;

  return (
    <View style={{ paddingTop: 4, paddingBottom: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: sectionLabel, marginBottom: 8, letterSpacing: 0.4 }}>
        {teamName?.toUpperCase() || "TEAM"} — MATCHES
      </Text>
      {shown.map((entry) => {
        const badge = formOf(entry.outcome === "BYE" ? "NR" : entry.outcome);
        const canOpen = !!entry.gameId && onOpenFixture;
        const RowWrap = canOpen ? TouchableOpacity : View;
        return (
          <RowWrap
            key={entry.fixture._id || `${entry.fixture.matchNumber}-${entry.opponentName}`}
            onPress={canOpen ? () => onOpenFixture(entry.fixture) : undefined}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: rowBorder,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: badge.bg,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{badge.t}</Text>
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: titleColor }} numberOfLines={1}>
                {entry.summary}
              </Text>
              {entry.margin ? (
                <Text style={{ fontSize: 11, color: dim, marginTop: 2 }} numberOfLines={1}>
                  {entry.margin}
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {entry.scheduledLabel ? (
                <Text style={{ fontSize: 10, color: muted, fontWeight: "600" }}>{entry.scheduledLabel}</Text>
              ) : (
                <Text style={{ fontSize: 10, color: muted, fontWeight: "600" }}>
                  M{entry.fixture.matchNumber || "—"}
                </Text>
              )}
              {canOpen ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 }}>
                  <Text style={{ fontSize: 10, color: linkColor, fontWeight: "700" }}>Scorecard</Text>
                  <Ionicons name="chevron-forward" size={12} color={linkColor} />
                </View>
              ) : null}
            </View>
          </RowWrap>
        );
      })}
      {hasMore ? (
        <TouchableOpacity
          onPress={() => setVisibleCount((n) => n + TEAM_MATCH_HISTORY_PAGE)}
          style={{ paddingVertical: 12, alignItems: "center" }}
        >
          <Text style={{ color: linkColor, fontWeight: "700", fontSize: 13 }}>
            Load more ({history.length - visibleCount} remaining)
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

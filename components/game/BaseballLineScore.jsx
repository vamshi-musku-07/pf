import React, { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import {
  toNum,
  sumInnings as sumArr,
  resolveInningColumns,
  buildLineScoreFromFixture,
  buildLineScoreFromGame,
} from "@/lib/baseballLineScore";

export { buildLineScoreFromFixture, buildLineScoreFromGame };

/**
 * Compact SofaScore-style baseball line score: inning columns + R/H/E.
 * Accepts either a live BaseballGame-shaped object or a fixture.result payload.
 */
export default function BaseballLineScore({
  homeName = "Home",
  awayName = "Away",
  homeByInning = [],
  awayByInning = [],
  homeRuns,
  awayRuns,
  homeHits,
  awayHits,
  homeErrors,
  awayErrors,
  currentInning,
  scheduledInnings,
  isTop = true,
  statusLabel,
  compact = false,
  isDark = false,
  T,
}) {
  // Show the organizer's configured length, growing only if the game runs into extras.
  const innings = useMemo(
    () =>
      resolveInningColumns({
        homeByInning,
        awayByInning,
        currentInning,
        scheduledInnings,
      }),
    [homeByInning, awayByInning, currentInning, scheduledInnings],
  );

  const homeR = homeRuns != null ? toNum(homeRuns) : sumArr(homeByInning);
  const awayR = awayRuns != null ? toNum(awayRuns) : sumArr(awayByInning);
  const homeH = toNum(homeHits);
  const awayH = toNum(awayHits);
  const homeE = toNum(homeErrors);
  const awayE = toNum(awayErrors);

  const cellW = compact ? 22 : 26;
  const labelW = compact ? 54 : 72;
  const headerColor = isDark ? T?.textMuted || "#A1A1AA" : "#94A3B8";
  const textColor = isDark ? T?.text || "#F5F5F7" : "#0B1324";
  const muted = isDark ? T?.textDim || "#A1A1AA" : "#64748B";
  const border = isDark ? T?.border || "#2A2A2E" : "#E2E8F0";
  const liveBg = isDark ? "rgba(186,240,114,0.18)" : "#ECFCCB";

  const renderTeamRow = (name, byInning, r, h, e, isHome) => {
    const liveHalf = currentInning
      ? isHome
        ? !isTop && Number(currentInning) > 0
        : isTop && Number(currentInning) > 0
      : false;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: compact ? 3 : 4 }}>
        <Text
          style={{
            width: labelW,
            fontSize: compact ? 11 : 12,
            fontWeight: "800",
            color: textColor,
            paddingRight: 4,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        {Array.from({ length: innings }).map((_, idx) => {
          const inningNo = idx + 1;
          const val = byInning?.[idx];
          const isLiveCol = liveHalf && Number(currentInning) === inningNo;
          return (
            <View
              key={`${name}-${inningNo}`}
              style={{
                width: cellW,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isLiveCol ? liveBg : "transparent",
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: compact ? 11 : 12, fontWeight: "700", color: textColor }}>
                {val == null || val === "" ? "·" : String(val)}
              </Text>
            </View>
          );
        })}
        <Text style={{ width: cellW, textAlign: "center", fontSize: compact ? 11 : 12, fontWeight: "900", color: textColor }}>
          {r}
        </Text>
        <Text style={{ width: cellW, textAlign: "center", fontSize: compact ? 11 : 12, fontWeight: "700", color: muted }}>
          {h}
        </Text>
        <Text style={{ width: cellW, textAlign: "center", fontSize: compact ? 11 : 12, fontWeight: "700", color: muted }}>
          {e}
        </Text>
      </View>
    );
  };

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: border,
        borderRadius: 12,
        paddingVertical: compact ? 6 : 8,
        paddingHorizontal: compact ? 8 : 10,
        backgroundColor: isDark ? T?.surfaceAlt || "#1E1E24" : "#F8FAFC",
      }}
    >
      {statusLabel ? (
        <Text style={{ fontSize: 10, fontWeight: "800", color: muted, marginBottom: 4, letterSpacing: 0.4 }}>
          {String(statusLabel).toUpperCase()}
        </Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <Text style={{ width: labelW, fontSize: 10, fontWeight: "700", color: headerColor }} />
            {Array.from({ length: innings }).map((_, idx) => (
              <Text
                key={`h-${idx}`}
                style={{ width: cellW, textAlign: "center", fontSize: 10, fontWeight: "700", color: headerColor }}
              >
                {idx + 1}
              </Text>
            ))}
            <Text style={{ width: cellW, textAlign: "center", fontSize: 10, fontWeight: "800", color: headerColor }}>R</Text>
            <Text style={{ width: cellW, textAlign: "center", fontSize: 10, fontWeight: "700", color: headerColor }}>H</Text>
            <Text style={{ width: cellW, textAlign: "center", fontSize: 10, fontWeight: "700", color: headerColor }}>E</Text>
          </View>
          {renderTeamRow(awayName, awayByInning, awayR, awayH, awayE, false)}
          {renderTeamRow(homeName, homeByInning, homeR, homeH, homeE, true)}
        </View>
      </ScrollView>
    </View>
  );
}


import React from "react";
import { View, Text, ScrollView } from "react-native";

const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const buildBasketballLineScoreFromFixture = (fixture = {}) => {
  const home = fixture?.result?.home || {};
  const away = fixture?.result?.away || {};
  return {
    homeName: fixture?.homeTeamName || "Home",
    awayName: fixture?.awayTeamName || "Away",
    homeByQuarter: Array.isArray(home.byQuarter) ? home.byQuarter.map(toNum) : [],
    awayByQuarter: Array.isArray(away.byQuarter) ? away.byQuarter.map(toNum) : [],
    homePoints: toNum(home.points),
    awayPoints: toNum(away.points),
  };
};

export default function BasketballLineScore({
  homeName = "Home",
  awayName = "Away",
  homeByQuarter = [],
  awayByQuarter = [],
  homePoints = 0,
  awayPoints = 0,
  compact = false,
  isDark = false,
  T,
}) {
  const baseQuarters = 4;
  const maxLen = Math.max(homeByQuarter.length, awayByQuarter.length, baseQuarters);
  const colW = compact ? 22 : 26;
  const labelW = compact ? 54 : 72;
  const headerColor = isDark ? T?.textMuted || "#A1A1AA" : "#94A3B8";
  const textColor = isDark ? T?.text || "#F5F5F7" : "#0B1324";
  const muted = isDark ? T?.textDim || "#A1A1AA" : "#64748B";
  const border = isDark ? T?.border || "#2A2A2E" : "#E2E8F0";

  const quarterLabel = (index) => (index < 4 ? `Q${index + 1}` : `OT${index - 3}`);

  const renderRow = (name, values, total) => (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: compact ? 3 : 4 }}>
      <Text style={{ width: labelW, fontSize: compact ? 11 : 12, fontWeight: "800", color: textColor }} numberOfLines={1}>
        {name}
      </Text>
      {Array.from({ length: maxLen }).map((_, idx) => (
        <Text key={`${name}-${idx}`} style={{ width: colW, textAlign: "center", fontSize: compact ? 11 : 12, color: textColor, fontWeight: "700" }}>
          {values?.[idx] == null ? "·" : String(values[idx])}
        </Text>
      ))}
      <Text style={{ width: colW + 4, textAlign: "center", fontSize: compact ? 11 : 12, color: muted, fontWeight: "900" }}>
        {total}
      </Text>
    </View>
  );

  return (
    <View style={{ borderWidth: 1, borderColor: border, borderRadius: 12, paddingVertical: compact ? 6 : 8, paddingHorizontal: compact ? 8 : 10, backgroundColor: isDark ? T?.surfaceAlt || "#1E1E24" : "#F8FAFC" }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <Text style={{ width: labelW }} />
            {Array.from({ length: maxLen }).map((_, idx) => (
              <Text key={`h-${idx}`} style={{ width: colW, textAlign: "center", fontSize: 10, fontWeight: "700", color: headerColor }}>
                {quarterLabel(idx)}
              </Text>
            ))}
            <Text style={{ width: colW + 4, textAlign: "center", fontSize: 10, fontWeight: "800", color: headerColor }}>F</Text>
          </View>
          {renderRow(awayName, awayByQuarter, awayPoints)}
          {renderRow(homeName, homeByQuarter, homePoints)}
        </View>
      </ScrollView>
    </View>
  );
}


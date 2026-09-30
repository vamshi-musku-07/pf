import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import {
  aggregateBasketballTeamStats,
  buildQuarterFilters,
  buildShootingRows,
  buildComparisonRows,
  hasAnyBasketballStats,
} from "@/lib/basketballMatchStats";

function PercentRing({ percent = 0, color, trackColor, size = 46, stroke = 4 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const offset = circumference * (1 - clamped / 100);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontSize: 12, fontWeight: "800", color }}>{clamped}%</Text>
    </View>
  );
}

export default function BasketballMatchStats({
  events = [],
  homeTeamId,
  teamNames = { home: "Home", away: "Away" },
  userSide = "home",
  currentQuarter = 1,
}) {
  const T = useGameScoringTheme();
  const [activeFilter, setActiveFilter] = useState("all");

  const leftSide = userSide === "away" ? "away" : "home";
  const rightSide = leftSide === "home" ? "away" : "home";
  const leftName = teamNames?.[leftSide] || (leftSide === "home" ? "Home" : "Away");
  const rightName = teamNames?.[rightSide] || (rightSide === "home" ? "Home" : "Away");

  const leftColor = T.isDark ? "#4ADE80" : "#16A34A";
  const rightColor = T.isDark ? "#818CF8" : "#4F46E5";
  const trackColor = T.isDark ? "rgba(255,255,255,0.10)" : "#E5E7EB";
  const cardBg = T.card;
  const cardBorder = T.border;

  const filters = useMemo(
    () => buildQuarterFilters(events, currentQuarter),
    [events, currentQuarter],
  );

  const stats = useMemo(() => {
    const filter = filters.find((f) => f.key === activeFilter) || filters[0];
    return aggregateBasketballTeamStats(events, {
      homeTeamId,
      quarter: filter?.quarter ?? null,
    });
  }, [events, homeTeamId, activeFilter, filters]);

  const shootingRows = useMemo(() => buildShootingRows(stats), [stats]);
  const comparisonRows = useMemo(() => buildComparisonRows(stats), [stats]);
  const hasStats = hasAnyBasketballStats(stats);

  const renderComparisonBar = (left, right) => {
    const total = left + right;
    const leftPct = total > 0 ? (left / total) * 100 : 50;
    return (
      <View
        style={{
          flexDirection: "row",
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
          backgroundColor: trackColor,
          marginTop: 6,
        }}
      >
        <View style={{ width: `${leftPct}%`, backgroundColor: total > 0 ? leftColor : "transparent" }} />
        <View style={{ flex: 1, backgroundColor: total > 0 ? rightColor : "transparent" }} />
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        style={{ marginBottom: 14, flexGrow: 0 }}
      >
        {filters.map((filter) => {
          const active = filter.key === activeFilter;
          return (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? T.accent : cardBg,
                borderWidth: 1,
                borderColor: active ? T.accent : cardBorder,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 0.6,
                  color: active ? T.onAccent : T.textDim,
                }}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          paddingHorizontal: 2,
        }}
      >
        <Text style={{ color: leftColor, fontWeight: "900", fontSize: 13, maxWidth: "42%" }} numberOfLines={1}>
          {leftName}
        </Text>
        <Text style={{ color: T.textMuted, fontWeight: "700", fontSize: 11 }}>VS</Text>
        <Text
          style={{ color: rightColor, fontWeight: "900", fontSize: 13, maxWidth: "42%", textAlign: "right" }}
          numberOfLines={1}
        >
          {rightName}
        </Text>
      </View>

      {!hasStats ? (
        <View
          style={{
            alignItems: "center",
            paddingVertical: 44,
            borderRadius: 16,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          <Ionicons name="stats-chart-outline" size={40} color={T.iconMuted} />
          <Text style={{ color: T.textDim, marginTop: 8, fontSize: 13 }}>
            No stats yet — start scoring
          </Text>
        </View>
      ) : (
        <>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: cardBorder,
              paddingVertical: 6,
              paddingHorizontal: 12,
              marginBottom: 14,
            }}
          >
            {shootingRows.map((row, idx) => {
              const left = row[leftSide];
              const right = row[rightSide];
              return (
                <View
                  key={row.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: T.borderSubtle,
                  }}
                >
                  <Text style={{ width: 46, fontSize: 12, fontWeight: "700", color: T.textDim }}>
                    {left.made}/{left.attempted}
                  </Text>
                  <PercentRing percent={left.percent} color={leftColor} trackColor={trackColor} />
                  <Text
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: "700",
                      color: T.text,
                    }}
                  >
                    {row.label}
                  </Text>
                  <PercentRing percent={right.percent} color={rightColor} trackColor={trackColor} />
                  <Text
                    style={{
                      width: 46,
                      textAlign: "right",
                      fontSize: 12,
                      fontWeight: "700",
                      color: T.textDim,
                    }}
                  >
                    {right.made}/{right.attempted}
                  </Text>
                </View>
              );
            })}
          </View>

          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: cardBorder,
              padding: 14,
              gap: 14,
            }}
          >
            {comparisonRows.map((row) => {
              const left = leftSide === "home" ? row.home : row.away;
              const right = rightSide === "home" ? row.home : row.away;
              return (
                <View key={row.key}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    {row.emphasis ? (
                      <View
                        style={{
                          minWidth: 34,
                          alignItems: "center",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: leftColor,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "900", color: T.isDark ? "#052E16" : "#FFFFFF" }}>
                          {left}
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ minWidth: 34, fontSize: 13, fontWeight: "700", color: T.textDim }}>
                        {left}
                      </Text>
                    )}
                    <Text style={{ fontSize: 12, fontWeight: "700", color: T.text }}>{row.label}</Text>
                    {row.emphasis ? (
                      <View
                        style={{
                          minWidth: 34,
                          alignItems: "center",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: rightColor,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "900", color: T.isDark ? "#1E1B4B" : "#FFFFFF" }}>
                          {right}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={{
                          minWidth: 34,
                          textAlign: "right",
                          fontSize: 13,
                          fontWeight: "700",
                          color: T.textDim,
                        }}
                      >
                        {right}
                      </Text>
                    )}
                  </View>
                  {renderComparisonBar(left, right)}
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

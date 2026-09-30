import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { buildFootballMatchComparisonStats, FOOTBALL_STAT_PERIODS } from "./hooks/footballMatchComparisonStats";
import { buildCricketMatchComparisonStats, buildCricketStatPeriods } from "./hooks/cricketMatchComparisonStats";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

const HOME_COLOR = "#9AEA62";
const AWAY_COLOR = "#A78BFA";

function PeriodToggle({ periods, value, onChange }) {
  const T = useGameScoringTheme();
  if (!periods?.length) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignSelf: "center",
        backgroundColor: T.segmentBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 999,
        padding: 3,
        marginBottom: 18,
      }}
    >
      {periods.map((p) => {
        const active = String(value) === String(p.key);
        return (
          <TouchableOpacity
            key={p.key}
            onPress={() => onChange(p.key)}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? T.segmentActive : "transparent",
              minWidth: 64,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: active ? T.segmentActiveText : T.textDim,
                fontWeight: "800",
                fontSize: 12,
                letterSpacing: 0.6,
              }}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function formatValue(value, format) {
  const n = Number(value) || 0;
  if (format === "percent") return `${Math.round(n)}%`;
  if (format === "decimal") {
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }
  return String(Math.round(n) === n ? n : Math.round(n * 10) / 10);
}

/** Center-out comparison bar for home vs away values. */
function CenterOutBar({ home, away, homeColor = HOME_COLOR, awayColor = AWAY_COLOR }) {
  const T = useGameScoringTheme();
  const h = Math.max(0, Number(home) || 0);
  const a = Math.max(0, Number(away) || 0);
  const max = Math.max(h, a, 1);
  const homeFill = `${(h / max) * 100}%`;
  const awayFill = `${(a / max) * 100}%`;

  return (
    <View
      style={{
        height: 6,
        borderRadius: 999,
        backgroundColor: T.border,
        overflow: "hidden",
        flexDirection: "row",
        marginTop: 8,
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", backgroundColor: T.border }}>
        <View
          style={{
            width: homeFill,
            backgroundColor: homeColor,
            borderTopLeftRadius: 999,
            borderBottomLeftRadius: 999,
          }}
        />
      </View>
      <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-start", backgroundColor: T.border }}>
        <View
          style={{
            width: awayFill,
            backgroundColor: awayColor,
            borderTopRightRadius: 999,
            borderBottomRightRadius: 999,
          }}
        />
      </View>
    </View>
  );
}

function PossessionBar({
  home,
  away,
  homeColor = HOME_COLOR,
  awayColor = AWAY_COLOR,
  label = "Ball possession",
}) {
  const T = useGameScoringTheme();
  const h = Math.max(0, Math.min(100, Number(home) || 0));
  const aRaw = Math.max(0, Math.min(100, Number(away) || 0));
  const a = h + aRaw === 0 ? 50 : aRaw;
  const homePct = h + a === 0 ? 50 : h;
  const awayPct = 100 - homePct;

  return (
    <View
      style={{
        marginBottom: 12,
        padding: 14,
        borderRadius: 14,
        backgroundColor: T.card,
        borderWidth: 1,
        borderColor: T.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: homeColor,
            minWidth: 44,
            alignItems: "center",
          }}
        >
          <Text style={{ color: T.isDark ? "#0B1324" : "#FFFFFF", fontWeight: "900", fontSize: 12 }}>{Math.round(homePct)}%</Text>
        </View>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            color: T.textDim,
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: awayColor,
            minWidth: 44,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 12 }}>{Math.round(awayPct)}%</Text>
        </View>
      </View>
      <View
        style={{
          height: 10,
          borderRadius: 999,
          overflow: "hidden",
          flexDirection: "row",
          backgroundColor: T.border,
        }}
      >
        <View style={{ width: `${homePct}%`, backgroundColor: homeColor }} />
        <View style={{ width: `${awayPct}%`, backgroundColor: awayColor }} />
      </View>
    </View>
  );
}

function StatRow({ label, home, away, format, homeColor = HOME_COLOR, awayColor = AWAY_COLOR }) {
  const T = useGameScoringTheme();
  return (
    <View
      style={{
        marginBottom: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: T.card,
        borderWidth: 1,
        borderColor: T.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: T.text, fontWeight: "900", fontSize: 15, minWidth: 36 }}>
          {formatValue(home, format)}
        </Text>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            color: T.textDim,
            fontSize: 13,
            fontWeight: "500",
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={{
            color: T.text,
            fontWeight: "800",
            fontSize: 14,
            minWidth: 36,
            textAlign: "right",
          }}
        >
          {formatValue(away, format)}
        </Text>
      </View>
      <CenterOutBar home={home} away={away} homeColor={homeColor} awayColor={awayColor} />
    </View>
  );
}

/**
 * Match stats comparison.
 * Home = left column, away = right (same order as the scoreboard).
 */
export default function MatchComparisonStats({
  periods = [],
  selectedPeriod,
  onPeriodChange,
  possession,
  possessionLabel = "Ball possession",
  rows = [],
  homeColor,
  awayColor,
  emptyMessage = "Stats will appear as the match progresses",
}) {
  const T = useGameScoringTheme();
  const resolvedHomeColor = homeColor || (T.isDark ? HOME_COLOR : "#111827");
  const resolvedAwayColor = awayColor || (T.isDark ? AWAY_COLOR : "#7C3AED");
  const hasRows = rows.some((r) => Number(r.home) + Number(r.away) > 0);
  const showPossession = !!possession && (hasRows || Number(possession.home) !== 50 || Number(possession.away) !== 50);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {periods.length > 1 ? (
        <PeriodToggle periods={periods} value={selectedPeriod} onChange={onPeriodChange} />
      ) : null}

      {!hasRows && !showPossession ? (
        <View
          style={{
            alignItems: "center",
            paddingVertical: 48,
            paddingHorizontal: 20,
            backgroundColor: T.card,
            borderWidth: 1,
            borderColor: T.border,
            borderRadius: 16,
          }}
        >
          <Text style={{ color: T.textDim, fontSize: 13, textAlign: "center", fontWeight: "600" }}>
            {emptyMessage}
          </Text>
        </View>
      ) : (
        <>
          {showPossession ? (
            <PossessionBar
              home={possession.home}
              away={possession.away}
              label={possessionLabel}
              homeColor={resolvedHomeColor}
              awayColor={resolvedAwayColor}
            />
          ) : null}
          {rows.map((row) => (
            <StatRow
              key={row.key}
              label={row.label}
              home={row.home}
              away={row.away}
              format={row.format}
              homeColor={resolvedHomeColor}
              awayColor={resolvedAwayColor}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

export function FootballMatchComparisonStatsPanel({ sport, homeTeamId }) {
  const [selectedPeriod, setSelectedPeriod] = useState("all");

  const built = useMemo(() => {
    const period = selectedPeriod === "all" ? "all" : Number(selectedPeriod);
    return buildFootballMatchComparisonStats({ sport, homeTeamId, period });
  }, [sport, homeTeamId, selectedPeriod]);

  return (
    <MatchComparisonStats
      periods={FOOTBALL_STAT_PERIODS}
      selectedPeriod={selectedPeriod}
      onPeriodChange={setSelectedPeriod}
      possession={built.possession}
      possessionLabel="Ball possession"
      rows={built.rows}
      emptyMessage="Football stats unlock as events are scored"
    />
  );
}

export function CricketMatchComparisonStatsPanel({ sport, homeTeamId, awayTeamId }) {
  const periods = useMemo(() => buildCricketStatPeriods(sport), [sport]);
  const [selectedPeriod, setSelectedPeriod] = useState("all");

  const built = useMemo(() => {
    const period = selectedPeriod === "all" ? "all" : Number(selectedPeriod);
    return buildCricketMatchComparisonStats({ sport, homeTeamId, awayTeamId, period });
  }, [sport, homeTeamId, awayTeamId, selectedPeriod]);

  return (
    <MatchComparisonStats
      periods={periods}
      selectedPeriod={selectedPeriod}
      onPeriodChange={setSelectedPeriod}
      possession={built.possession}
      possessionLabel={built.possessionLabel || "Run share"}
      rows={built.rows}
      emptyMessage="Cricket stats unlock as the innings progresses"
    />
  );
}

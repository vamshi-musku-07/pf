import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import PremiumMatchCard from "./PremiumMatchCard";
import {
  EmptyState,
  MATCH_FILTERS,
  countFixturesByMatchFilterScoped,
  filterFixturesByMatchStatus,
  sortFixturesForMatchFilter,
} from "@/features/tournament/helpers";

function MatchFilterBar({ filters, active, counts, onSelect, isDark, T }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
      {filters.map((filter) => {
        const selected = active === filter;
        const count = counts[filter] ?? 0;
        return (
          <TouchableOpacity
            key={filter}
            onPress={() => onSelect(filter)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: selected ? "#0B1324" : isDark ? T.surface : "#fff",
              borderWidth: 1,
              borderColor: selected ? "#0B1324" : isDark ? T.border : "#E2E8F0",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: selected ? "#BAF072" : isDark ? T.textDim : "#475569",
              }}
            >
              {filter}
              {count > 0 ? ` (${count})` : ""}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const EMPTY_COPY = {
  Live: {
    icon: "radio-outline",
    title: "No live matches",
    subtitle: "League and knockout matches appear here once scoring starts.",
  },
  Upcoming: {
    icon: "calendar-outline",
    title: "No upcoming matches",
    subtitle: "Scheduled and pending fixtures will show here.",
  },
  Past: {
    icon: "checkmark-done-outline",
    title: "No completed matches",
    subtitle: "Finished results will appear here after matches are played.",
  },
};

export default function MatchesTab({
  fixtures,
  liveScopeFixtures,
  format,
  isAdmin,
  onStart,
  onOpen,
  onEnterResult,
  onWatchLive,
  onSchedule,
  busy,
  totalOvers,
  sport,
  scheduledInnings,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const baseList = format === "knockout" ? fixtures : fixtures.filter((f) => f.stage === "league");
  const scopeList = liveScopeFixtures ?? baseList;
  const counts = useMemo(
    () => countFixturesByMatchFilterScoped(baseList, scopeList),
    [baseList, scopeList],
  );
  const [filter, setFilter] = useState(() => {
    const scopedCounts = countFixturesByMatchFilterScoped(baseList, scopeList);
    if (scopedCounts.Live > 0) return "Live";
    if (scopedCounts.Upcoming > 0) return "Upcoming";
    return "Past";
  });
  const prevLiveCountRef = useRef(0);

  useEffect(() => {
    const liveCount = counts.Live;
    if (liveCount > 0 && prevLiveCountRef.current === 0) {
      setFilter("Live");
    }
    prevLiveCountRef.current = liveCount;
  }, [counts.Live]);

  if (!baseList.length && !scopeList.length) {
    return (
      <EmptyState
        icon="calendar-outline"
        title="No matches yet"
        subtitle={isAdmin ? "Go to Manage → Generate fixtures once teams are enrolled." : "Matches haven't been generated yet."}
        isDark={isDark}
        T={T}
      />
    );
  }

  const sourceList = filter === "Live" ? scopeList : baseList;
  const filtered = sortFixturesForMatchFilter(
    filterFixturesByMatchStatus(sourceList, filter),
    filter,
  );

  const empty = EMPTY_COPY[filter] || EMPTY_COPY.Upcoming;

  const cardVariant =
    filter === "Live" ? "live" : filter === "Past" ? "past" : "upcoming";

  return (
    <View>
      <MatchFilterBar
        filters={MATCH_FILTERS}
        active={filter}
        counts={counts}
        onSelect={setFilter}
        isDark={isDark}
        T={T}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          subtitle={empty.subtitle}
          isDark={isDark}
          T={T}
        />
      ) : (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {filtered.map((fixture) => (
            <View key={fixture._id} style={{ width: "48.5%", marginBottom: 10 }}>
              <PremiumMatchCard
                fixture={fixture}
                variant={cardVariant}
                compact
                totalOvers={totalOvers}
                sport={sport}
                scheduledInnings={scheduledInnings}
                isAdmin={isAdmin}
                busy={busy}
                onWatchLive={onWatchLive}
                onOpen={onOpen}
                onStart={onStart}
                onSchedule={onSchedule}
                onEnterResult={onEnterResult}
                pastOpensScorecard
                isDark={isDark}
                T={T}
                showAdminActions={isAdmin}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

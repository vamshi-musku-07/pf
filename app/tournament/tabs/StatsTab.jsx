import React, { useMemo, useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import {
  STATS_SORT_OPTIONS,
  FOOTBALL_STATS_SORT_OPTIONS,
  BASEBALL_STATS_SORT_OPTIONS,
  BASKETBALL_STATS_SORT_OPTIONS,
  sortPlayersForStats,
  filterPlayersByTeam,
  resolvePlayerDisplayName,
  resolvePlayerProfileImage,
  resolveTeamFilterLabel,
  formatBattingSummary,
  formatBowlingSummary,
  formatFieldingSummary,
  formatFootballSummary,
  formatBaseballSummary,
  formatBasketballSummary,
  statsSortLabel,
} from "@/features/tournament/leaderboardConfig";
import { EmptyState } from "@/features/tournament/helpers";
import PlayerNameAvatar from "./PlayerNameAvatar";
import TeamFilterPicker from "./TeamFilterPicker";

function SortChip({ label, active, onPress, isDark, T }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: active ? "#0B1324" : isDark ? T.surfaceAlt : "#F1F5F9",
        marginRight: 8,
        marginBottom: 8,
        borderWidth: isDark ? 1 : 0,
        borderColor: active ? "#0B1324" : isDark ? T.border : "transparent",
      }}
    >
      <Text
        style={{
          color: active ? "#BAF072" : isDark ? T.textDim : "#64748B",
          fontWeight: "800",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StatRow({ player, nameMap, profileMap, sortKey, expanded, onToggle, isDark, T, isFootball, isBaseball, isBasketball }) {
  const name = resolvePlayerDisplayName(player.playerId, nameMap, "", player);
  const profileImage = resolvePlayerProfileImage(player.playerId, profileMap, player);
  const titleColor = isDark ? T.text : "#0B1324";
  const muted = isDark ? T.textMuted : "#94A3B8";
  const labelColor = isDark ? T.textDim : "#64748B";
  const bodyColor = isDark ? T.textDim : "#334155";
  const sortValue = (() => {
    if (isFootball) {
      if (sortKey === "assists") return String(player.assists || 0);
      if (sortKey === "clean_sheets") return String(player.clean_sheets || 0);
      if (sortKey === "mvpPoints") return String(player.mvpPoints || 0);
      return String(player.goals || 0);
    }
    if (isBaseball) {
      if (sortKey === "hits") return String(player.hits || 0);
      if (sortKey === "homeRuns") return String(player.homeRuns || 0);
      if (sortKey === "rbi") return String(player.rbi || 0);
      if (sortKey === "strikeouts") return String(player.strikeouts || 0);
      if (sortKey === "mvpPoints") return String(player.mvpPoints || 0);
      if (sortKey === "battingAverage") {
        if (player.battingAverage == null) return "—";
        const text = Number(player.battingAverage).toFixed(3);
        return text.startsWith("0") ? text.slice(1) : text;
      }
      return String(player.runs || 0);
    }
    if (isBasketball) {
      if (sortKey === "rebounds") return String(player.rebounds || 0);
      if (sortKey === "assists") return String(player.assists || 0);
      if (sortKey === "steals") return String(player.steals || 0);
      if (sortKey === "blocks") return String(player.blocks || 0);
      if (sortKey === "threePointsMade") return String(player.threePointsMade || 0);
      if (sortKey === "fgPercent") return `${Number(player.fgPercent || 0).toFixed(1)}%`;
      if (sortKey === "mvpPoints") return String(player.mvpPoints || 0);
      return String(player.points || 0);
    }
    if (sortKey === "batting_average") {
      return player.batting_average != null ? String(player.batting_average) : "—";
    }
    if (sortKey === "economy") {
      return player.economy ? String(player.economy) : "—";
    }
    if (sortKey === "strike_rate") return player.strike_rate ? String(player.strike_rate) : "—";
    if (sortKey === "wickets") return String(player.wickets || 0);
    if (sortKey === "mvpPoints") return String(player.mvpPoints || 0);
    return String(player.runs || 0);
  })();

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.85}
      style={{
        backgroundColor: isDark ? T.surface : "#fff",
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: isDark ? T.border : "#EEF2F6",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <PlayerNameAvatar name={name} profileImage={profileImage} size={36} isDark={isDark} T={T} />
        <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
          <Text style={{ color: titleColor, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ color: muted, fontSize: 12, fontWeight: "600", marginTop: 2 }} numberOfLines={1}>
            {player.teamName || "—"} · {player.matches || 0} mat
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
          <Text style={{ color: titleColor, fontWeight: "900", fontSize: 18 }}>{sortValue}</Text>
          <Text style={{ color: muted, fontSize: 10, fontWeight: "700", marginTop: 2 }}>
            {statsSortLabel(sortKey)}
          </Text>
        </View>
      </View>

      {expanded ? (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: isDark ? T.borderSubtle : "#F1F5F9",
            gap: 8,
          }}
        >
          {isFootball ? (
            <View>
              <Text style={{ color: labelColor, fontSize: 10, fontWeight: "800", marginBottom: 3 }}>
                FOOTBALL
              </Text>
              <Text style={{ color: bodyColor, fontSize: 13, fontWeight: "600" }}>
                {formatFootballSummary(player)}
              </Text>
              <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                {player.matches || 0} matches
                {player.saves ? ` · ${player.saves} saves` : ""}
                {player.yellow_cards || player.red_cards
                  ? ` · ${player.yellow_cards || 0}Y ${player.red_cards || 0}R`
                  : ""}
              </Text>
            </View>
          ) : isBaseball ? (
            <View>
              <Text style={{ color: labelColor, fontSize: 10, fontWeight: "800", marginBottom: 3 }}>
                BATTING
              </Text>
              <Text style={{ color: bodyColor, fontSize: 13, fontWeight: "600" }}>
                {formatBaseballSummary(player)}
              </Text>
              <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                {player.matches || 0} matches
                {player.walks ? ` · ${player.walks} BB` : ""}
                {player.strikeouts ? ` · ${player.strikeouts} K` : ""}
              </Text>
            </View>
          ) : isBasketball ? (
            <View>
              <Text style={{ color: labelColor, fontSize: 10, fontWeight: "800", marginBottom: 3 }}>
                BASKETBALL
              </Text>
              <Text style={{ color: bodyColor, fontSize: 13, fontWeight: "600" }}>
                {formatBasketballSummary(player)}
              </Text>
              <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                {player.matches || 0} matches
                {player.fieldGoalsAttempted ? ` · ${player.fieldGoalsMade || 0}/${player.fieldGoalsAttempted} FG` : ""}
              </Text>
            </View>
          ) : (
            <>
              <View>
                <Text style={{ color: labelColor, fontSize: 10, fontWeight: "800", marginBottom: 3 }}>
                  BATTING
                </Text>
                <Text style={{ color: bodyColor, fontSize: 13, fontWeight: "600" }}>
                  {formatBattingSummary(player)}
                </Text>
                {player.fours || player.sixes ? (
                  <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                    {player.fours || 0}×4 · {player.sixes || 0}×6
                    {player.highest_score ? ` · HS ${player.highest_score}` : ""}
                  </Text>
                ) : null}
              </View>
              <View>
                <Text style={{ color: labelColor, fontSize: 10, fontWeight: "800", marginBottom: 3 }}>
                  BOWLING
                </Text>
                <Text style={{ color: bodyColor, fontSize: 13, fontWeight: "600" }}>
                  {formatBowlingSummary(player)}
                </Text>
              </View>
              <View>
                <Text style={{ color: labelColor, fontSize: 10, fontWeight: "800", marginBottom: 3 }}>
                  FIELDING
                </Text>
                <Text style={{ color: bodyColor, fontSize: 13, fontWeight: "600" }}>
                  {formatFieldingSummary(player)}
                </Text>
              </View>
            </>
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={{ color: labelColor, fontSize: 12, fontWeight: "600" }}>MVP points</Text>
            <Text style={{ color: titleColor, fontSize: 13, fontWeight: "800" }}>
              {player.mvpPoints || 0}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={{ color: muted, fontSize: 11, marginTop: 8 }}>
          {isFootball
            ? formatFootballSummary(player)
            : isBaseball
              ? formatBaseballSummary(player)
            : isBasketball
              ? formatBasketballSummary(player)
            : `${formatBattingSummary(player)} · ${formatBowlingSummary(player)}`}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function StatsTab({ leaderboard, nameMap, profileMap = {}, loading, teams = [], sport }) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const isFootball = String(sport || leaderboard?.sport || "").toLowerCase() === "football";
  const isBaseball = String(sport || leaderboard?.sport || "").toLowerCase() === "baseball";
  const isBasketball = String(sport || leaderboard?.sport || "").toLowerCase() === "basketball";
  const sortOptions = isFootball
    ? FOOTBALL_STATS_SORT_OPTIONS
    : isBaseball
      ? BASEBALL_STATS_SORT_OPTIONS
      : isBasketball
        ? BASKETBALL_STATS_SORT_OPTIONS
      : STATS_SORT_OPTIONS;
  const [sortKey, setSortKey] = useState(isFootball ? "goals" : isBasketball ? "points" : "runs");
  const [expandedId, setExpandedId] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  const teamScopeKey = useMemo(
    () => (teams || []).map((t) => String(t.teamId)).sort().join(","),
    [teams],
  );

  useEffect(() => {
    setSelectedTeamId(null);
    setExpandedId(null);
  }, [teamScopeKey]);

  useEffect(() => {
    setSortKey(isFootball ? "goals" : isBasketball ? "points" : "runs");
  }, [isFootball, isBaseball, isBasketball]);

  const filteredPlayers = useMemo(
    () => filterPlayersByTeam(leaderboard?.players, selectedTeamId),
    [leaderboard?.players, selectedTeamId],
  );

  const players = useMemo(
    () => sortPlayersForStats(filteredPlayers, sortKey),
    [filteredPlayers, sortKey],
  );

  const teamLabel = resolveTeamFilterLabel(teams, selectedTeamId);

  if (loading && !leaderboard) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 48 }}>
        <Text style={{ color: isDark ? T.textDim : "#64748B", fontWeight: "600" }}>
          Loading player stats…
        </Text>
      </View>
    );
  }

  if (!players.length) {
    const hasAnyPlayers = (leaderboard?.players || []).length > 0;
    return (
      <View>
        <TeamFilterPicker
          teams={teams}
          selectedTeamId={selectedTeamId}
          onSelect={setSelectedTeamId}
        />
        <EmptyState
          icon="people-outline"
          title={selectedTeamId && hasAnyPlayers ? `No stats for ${teamLabel}` : "No player stats yet"}
          subtitle={
            selectedTeamId && hasAnyPlayers
              ? "Try another team or switch back to All teams."
              : isFootball
                ? "Full tournament stats appear once matches are completed with live football scoring."
                : isBaseball
                  ? "Full tournament stats appear once matches are completed with live baseball scoring."
                : isBasketball
                  ? "Full tournament stats appear once matches are completed with live basketball scoring."
                : "Full tournament stats appear once matches are completed with recorded innings."
          }
          isDark={isDark}
          T={T}
        />
      </View>
    );
  }

  return (
    <View>
      <TeamFilterPicker
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelect={setSelectedTeamId}
      />
      <Text
        style={{
          color: isDark ? T.textDim : "#64748B",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        {players.length} player{players.length === 1 ? "" : "s"}
        {selectedTeamId ? ` · ${teamLabel}` : ""} · tap a row for details
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
        {sortOptions.map((opt) => (
          <SortChip
            key={opt.key}
            label={opt.label}
            active={sortKey === opt.key}
            onPress={() => {
              setSortKey(opt.key);
              setExpandedId(null);
            }}
            isDark={isDark}
            T={T}
          />
        ))}
      </View>
      {players.map((player) => {
        const rowKey = `${player.playerId}::${player.teamId}`;
        return (
          <StatRow
            key={rowKey}
            player={player}
            nameMap={nameMap}
            profileMap={profileMap}
            sortKey={sortKey}
            expanded={expandedId === rowKey}
            onToggle={() => setExpandedId((prev) => (prev === rowKey ? null : rowKey))}
            isDark={isDark}
            T={T}
            isFootball={isFootball}
            isBaseball={isBaseball}
            isBasketball={isBasketball}
          />
        );
      })}
    </View>
  );
}

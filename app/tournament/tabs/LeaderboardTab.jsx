import React, { useMemo, useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import {
  LEADERBOARD_CATEGORIES,
  FOOTBALL_LEADERBOARD_CATEGORIES,
  BASEBALL_LEADERBOARD_CATEGORIES,
  BASKETBALL_LEADERBOARD_CATEGORIES,
  RANK_COLORS,
  buildLeaderboardSections,
  filterLeaderboardByTeam,
  hasLeaderboardData,
  resolveTeamFilterLabel,
} from "@/features/tournament/leaderboardConfig";
import { EmptyState } from "@/features/tournament/helpers";
import PlayerNameAvatar from "./PlayerNameAvatar";
import TeamFilterPicker from "./TeamFilterPicker";

function CategoryChip({ label, active, onPress, isDark, T }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? "#0B1324" : isDark ? T.surfaceAlt : "#F1F5F9",
        marginRight: 8,
        borderWidth: isDark ? 1 : 0,
        borderColor: active ? "#0B1324" : isDark ? T.border : "transparent",
      }}
    >
      <Text
        style={{
          color: active ? "#BAF072" : isDark ? T.textDim : "#64748B",
          fontWeight: "800",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function LeaderRow({ index, name, profileImage, teamName, primary, secondary, isDark, T }) {
  const rankColor = RANK_COLORS[index] || (isDark ? T.iconMuted : "#D1D5DB");
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? T.borderSubtle : "#F1F5F9",
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
          backgroundColor: `${rankColor}22`,
        }}
      >
        <Text style={{ color: rankColor, fontSize: 12, fontWeight: "900" }}>{index + 1}</Text>
      </View>
      <PlayerNameAvatar name={name} profileImage={profileImage} size={30} isDark={isDark} T={T} />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
        <Text
          style={{
            color: isDark ? T.text : "#0B1324",
            fontWeight: "700",
            fontSize: 14,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        {teamName ? (
          <Text
            style={{
              color: isDark ? T.textMuted : "#94A3B8",
              fontSize: 11,
              fontWeight: "600",
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {teamName}
          </Text>
        ) : null}
      </View>
      {secondary ? (
        <Text
          style={{
            color: isDark ? T.textMuted : "#94A3B8",
            fontSize: 11,
            fontWeight: "600",
            marginRight: 10,
          }}
        >
          {secondary}
        </Text>
      ) : null}
      <Text
        style={{
          color: isDark ? T.text : "#0B1324",
          fontWeight: "900",
          fontSize: 14,
        }}
      >
        {primary}
      </Text>
    </View>
  );
}

function LeaderboardSection({ icon, iconColor, title, rows, isDark, T }) {
  if (!rows?.length) return null;
  return (
    <View
      style={{
        backgroundColor: isDark ? T.surface : "#fff",
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: isDark ? T.border : "#EEF2F6",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Ionicons name={icon} size={16} color={iconColor} />
        <Text
          style={{
            color: isDark ? T.text : "#0B1324",
            fontWeight: "800",
            fontSize: 15,
          }}
        >
          {title}
        </Text>
      </View>
      {rows.map((row, idx) => (
        <LeaderRow
          key={`${row.playerId}-${idx}`}
          index={idx}
          name={row.name}
          profileImage={row.profileImage}
          teamName={row.teamName}
          primary={row.primary}
          secondary={row.secondary}
          isDark={isDark}
          T={T}
        />
      ))}
    </View>
  );
}

export default function LeaderboardTab({ leaderboard, nameMap, profileMap = {}, loading, teams = [], sport }) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const isFootball = String(sport || leaderboard?.sport || "").toLowerCase() === "football";
  const isBaseball = String(sport || leaderboard?.sport || "").toLowerCase() === "baseball";
  const isBasketball = String(sport || leaderboard?.sport || "").toLowerCase() === "basketball";
  const categories = isFootball
    ? FOOTBALL_LEADERBOARD_CATEGORIES
    : isBaseball
      ? BASEBALL_LEADERBOARD_CATEGORIES
      : isBasketball
        ? BASKETBALL_LEADERBOARD_CATEGORIES
      : LEADERBOARD_CATEGORIES;
  const [category, setCategory] = useState(categories[0]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  const teamScopeKey = useMemo(
    () => (teams || []).map((t) => String(t.teamId)).sort().join(","),
    [teams],
  );

  useEffect(() => {
    setSelectedTeamId(null);
  }, [teamScopeKey]);

  useEffect(() => {
    setCategory(categories[0]);
  }, [isFootball, isBaseball, isBasketball]);

  const filteredBoards = useMemo(
    () => filterLeaderboardByTeam(leaderboard?.leaderboards, selectedTeamId),
    [leaderboard?.leaderboards, selectedTeamId],
  );

  const sections = useMemo(
    () => buildLeaderboardSections(category, filteredBoards, nameMap, profileMap, sport || leaderboard?.sport),
    [category, filteredBoards, nameMap, profileMap, sport, leaderboard?.sport],
  );

  const teamLabel = resolveTeamFilterLabel(teams, selectedTeamId);

  if (loading && !leaderboard) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 48 }}>
        <Text style={{ color: isDark ? T.textDim : "#64748B", fontWeight: "600" }}>
          Loading leaderboards…
        </Text>
      </View>
    );
  }

  if (!hasLeaderboardData(leaderboard?.leaderboards)) {
    return (
      <EmptyState
        icon="stats-chart-outline"
        title="No leaderboard yet"
        subtitle={
          isFootball
            ? "Player leaderboards appear once matches are completed with live football scoring."
            : isBaseball
              ? "Player leaderboards appear once matches are completed with live baseball scoring."
            : isBasketball
              ? "Player leaderboards appear once matches are completed with live basketball scoring."
            : "Player leaderboards appear once matches are completed with ball-by-ball scoring."
        }
        isDark={isDark}
        T={T}
      />
    );
  }

  return (
    <View>
      <TeamFilterPicker
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelect={setSelectedTeamId}
      />

      <View style={{ flexDirection: "row", marginBottom: 14, flexWrap: "wrap" }}>
        {categories.map((cat) => (
          <CategoryChip
            key={cat}
            label={cat}
            active={category === cat}
            onPress={() => setCategory(cat)}
            isDark={isDark}
            T={T}
          />
        ))}
      </View>

      {sections.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title={
            selectedTeamId
              ? `No ${category.toLowerCase()} stats for ${teamLabel}`
              : `No ${category.toLowerCase()} stats yet`
          }
          subtitle={
            selectedTeamId
              ? "Try another team or switch back to All teams."
              : "Stats for this category will show up after more innings are recorded."
          }
          isDark={isDark}
          T={T}
        />
      ) : (
        sections.map((section) => (
          <LeaderboardSection
            key={section.key}
            icon={section.icon}
            iconColor={section.iconColor}
            title={section.title}
            rows={section.rows}
            isDark={isDark}
            T={T}
          />
        ))
      )}
    </View>
  );
}

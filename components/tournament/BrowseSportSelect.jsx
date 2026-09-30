import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BrowseSportIcon,
  BROWSE_SPORT_ORDER,
  browseSportLabel,
} from "@/components/tournament/BrowseSportIcons";
import { colors } from "@/constants/theme";
import { normalizeSportKey } from "@/lib/sportMatch";

/**
 * Sofascore-style "Select Sport" list for tournament Browse.
 * Shows tournament counts and live/total when live > 0.
 */
export default function BrowseSportSelect({
  sportsPayload,
  loading,
  selectedSport,
  onSelect,
  onClose,
  onReorder,
  isDark = true,
}) {
  const accent = colors.appGreen;
  const bg = isDark ? "#121214" : "#F4F5F7";
  const rowBg = isDark ? "#121214" : "#F4F5F7";
  const selectedBg = isDark ? "#1C1828" : "#EEF8E6";
  const text = isDark ? "#FFFFFF" : "#0B1324";
  const muted = isDark ? "#A1A1AA" : "#6B7280";
  const pillBg = isDark ? "#2A2A2E" : "#E5E7EB";
  const iconColor = isDark ? "#FFFFFF" : "#0B1324";
  const accentBar = accent;

  const rows = useMemo(() => {
    const apiSports = sportsPayload?.sports || [];
    const byKey = new Map(
      apiSports.map((s) => [normalizeSportKey(s.sport), s]),
    );
    const trending = sportsPayload?.trending || {
      sport: "Trending",
      tournamentCount: apiSports.reduce((n, s) => n + (s.tournamentCount || 0), 0),
      liveCount: apiSports.reduce((n, s) => n + (s.liveCount || 0), 0),
    };

    const ordered = [];
    for (const name of BROWSE_SPORT_ORDER) {
      if (name === "Trending") {
        ordered.push({ ...trending, sport: "Trending", id: "Trending" });
        continue;
      }
      const hit = byKey.get(normalizeSportKey(name));
      ordered.push({
        sport: name,
        id: name,
        tournamentCount: hit?.tournamentCount || 0,
        liveCount: hit?.liveCount || 0,
      });
      if (hit) byKey.delete(normalizeSportKey(name));
    }
    // Any extra sports from API (except Chess)
    for (const [key, s] of byKey) {
      if (key === "chess") continue;
      ordered.push({
        sport: s.sport,
        id: s.sport,
        tournamentCount: s.tournamentCount || 0,
        liveCount: s.liveCount || 0,
      });
    }
    return ordered;
  }, [sportsPayload]);

  const renderRow = ({ item }) => {
    const selected =
      selectedSport &&
      (selectedSport === item.id ||
        normalizeSportKey(selectedSport) === normalizeSportKey(item.sport));
    const live = Number(item.liveCount || 0);
    const total = Number(item.tournamentCount || 0);

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => onSelect?.(item)}
        style={[
          styles.row,
          { backgroundColor: selected ? selectedBg : rowBg },
        ]}
      >
        {selected ? <View style={[styles.accentBar, { backgroundColor: accentBar }]} /> : null}
        <View style={styles.iconSlot}>
          <BrowseSportIcon name={item.sport} size={26} color={iconColor} />
        </View>
        <View style={styles.labelCol}>
          <Text style={[styles.label, { color: text }]}>{browseSportLabel(item.sport)}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: pillBg }]}>
          {live > 0 ? (
            <Text style={styles.pillText}>
              <Text style={styles.liveNum}>{live}</Text>
              <Text style={{ color: muted }}> / </Text>
              <Text style={{ color: text, fontWeight: "700" }}>{total}</Text>
            </Text>
          ) : (
            <Text style={[styles.totalOnly, { color: text }]}>{total}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]}>Select Sport</Text>
        <TouchableOpacity onPress={onReorder} hitSlop={12} style={styles.headerBtn}>
          <Text style={[styles.reorder, { color: accent }]}>Reorder</Text>
        </TouchableOpacity>
      </View>

      {loading && !rows.length ? (
        <View style={styles.loader}>
          <ActivityIndicator color={accent} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerBtn: {
    minWidth: 72,
    height: 40,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },
  reorder: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    position: "relative",
    minHeight: 56,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  iconSlot: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  labelCol: { flex: 1 },
  label: { fontSize: 17, fontWeight: "500" },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 44,
    alignItems: "center",
  },
  pillText: { fontSize: 14, fontWeight: "700" },
  liveNum: { color: "#EF4444", fontWeight: "800" },
  totalOnly: { fontSize: 14, fontWeight: "700" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 },
});

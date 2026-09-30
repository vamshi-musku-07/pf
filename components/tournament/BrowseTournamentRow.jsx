import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { resolveTournamentSportIcon } from "@/lib/tournamentSportIcon";
import {
  FORMAT_LABEL,
  formatDotDate,
  statusShortLabel,
} from "@/features/tournament/publicConfig";
import { colors } from "@/constants/theme";

/**
 * Browse-tab row styled like Sofascore match history:
 * date/status | sport icon + name/meta | green badge.
 * Supports dark and light themes.
 */
export default function BrowseTournamentRow({ item, onPress, isDark = true }) {
  const sportIcon = resolveTournamentSportIcon(item?.sport);
  const dateLabel =
    formatDotDate(item?.startDate) ||
    formatDotDate(item?.updatedAt) ||
    "—";
  const statusLabel = statusShortLabel(item?.status);
  const formatLabel = FORMAT_LABEL[item?.format] || item?.format || "League";
  const teamCount = item?.teamCount ?? item?.teams?.length ?? 0;
  const sportLabel = String(item?.sport || "").trim() || "Sport";
  const name = item?.name || "Tournament";
  const venue = String(item?.venue || "").trim();

  const text = isDark ? "#F5F5F7" : "#0B1324";
  const muted = isDark ? "#9CA3AF" : "#6B7280";
  const hairline = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
  const iconBg = isDark ? "#111318" : "#0B1324";

  const metaLine = [sportLabel, formatLabel, venue || null].filter(Boolean).join(" · ");

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
      <View style={[styles.row, { borderColor: hairline }]}>
        <View style={styles.dateCol}>
          <Text style={[styles.dateText, { color: muted }]} numberOfLines={1}>
            {dateLabel}
          </Text>
          <Text style={[styles.statusText, { color: muted }]}>{statusLabel}</Text>
        </View>

        <View style={styles.mainCol}>
          <View style={styles.line}>
            <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
              <ExpoImage
                source={sportIcon}
                style={styles.sportIcon}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
              />
            </View>
            <Text style={[styles.title, { color: text }]} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <View style={[styles.line, { marginTop: 8 }]}>
            <View style={styles.iconSpacer} />
            <Text style={[styles.meta, { color: muted }]} numberOfLines={1}>
              {metaLine}
            </Text>
          </View>
        </View>

        <View style={styles.badgeCol}>
          <View style={[styles.badge, { backgroundColor: colors.appGreen }]}>
            <Text style={styles.badgeText}>
              {teamCount > 0 ? String(teamCount) : "—"}
            </Text>
          </View>
          <Text style={[styles.publicHint, { color: muted }]}>PUB</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dateCol: { width: 62 },
  dateText: { fontSize: 11, fontWeight: "600" },
  statusText: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  mainCol: { flex: 1, paddingHorizontal: 8 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconSpacer: { width: 22, height: 22 },
  sportIcon: { width: 18, height: 22 },
  title: { flex: 1, fontSize: 14, fontWeight: "800" },
  meta: { flex: 1, fontSize: 12, fontWeight: "600" },
  badgeCol: { width: 54, alignItems: "flex-end", gap: 6 },
  badge: {
    minWidth: 36,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 5,
    alignItems: "center",
  },
  badgeText: { color: "#0B1324", fontWeight: "900", fontSize: 12 },
  publicHint: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
});

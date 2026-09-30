import { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useHomeUpcomingGames } from "@/hooks/useHomeUpcomingGames";

const UPCOMING_EMPTY_ICON = require("../assets/images/upcoming-empty-3d.png");

function TeamLogo({ source, abbrev, size = 56, colors }) {
  return (
    <View
      style={[
        S.logoWrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors?.logoBg ?? "#F3F4F6",
          borderColor: colors?.logoBorder ?? "#E5E7EB",
          borderWidth: colors?.logoBorderWidth ?? 2,
        },
      ]}
    >
      {source ? (
        <ExpoImage
          source={source}
          style={{ width: size - 8, height: size - 8 }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      ) : (
        <Text style={[S.logoAbbrev, colors?.teamName ? { color: colors.teamName } : null]}>
          {abbrev}
        </Text>
      )}
    </View>
  );
}

function CardSkeleton({ colors }) {
  const cardBg = colors?.skeletonCardBg ?? "#F3F4F6";
  const cardBorder = colors?.skeletonCardBorder ?? "#E5E7EB";
  const bone = colors?.skeletonBone ?? "#E5E7EB";
  return (
    <View
      style={[
        S.card,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
          borderWidth: 1,
          shadowOpacity: 0,
          elevation: 0,
        },
      ]}
    >
      <View style={[S.skeletonLine, { width: "55%", alignSelf: "center", backgroundColor: bone }]} />
      <View style={[S.matchRow, { marginTop: 18 }]}>
        <View style={[S.skeletonCircle, { width: 56, height: 56, borderRadius: 28, backgroundColor: bone }]} />
        <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <View style={[S.skeletonLine, { width: 72, height: 18, backgroundColor: bone }]} />
          <View style={[S.skeletonLine, { width: 96, backgroundColor: bone }]} />
        </View>
        <View style={[S.skeletonCircle, { width: 56, height: 56, borderRadius: 28, backgroundColor: bone }]} />
      </View>
    </View>
  );
}

function UpcomingMatchCard({ item, onPress, colors }) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        S.card,
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.cardBorder,
          borderWidth: colors.cardBorderWidth,
          shadowOpacity: colors.cardShadowOpacity,
        },
      ]}
    >
      <View style={S.eventBadgeWrap}>
        <View style={[S.eventBadgeChip, { backgroundColor: colors.badgeBg }]}>
          <Text style={[S.eventBadgeChipText, { color: colors.badgeText }]} numberOfLines={1}>
            {item.eventLabel}
          </Text>
        </View>
      </View>

      <View style={[S.matchRow, { marginTop: 36 }]}>
        <View style={S.sideCol}>
          <TeamLogo
            source={item.homeTeam.logo}
            abbrev={item.homeTeam.abbrev}
            colors={colors}
          />
          <Text style={[S.teamName, { color: colors.teamName }]} numberOfLines={2}>
            {item.homeTeam.name}
          </Text>
        </View>

        <View style={S.centerCol}>
          <Text style={[S.time, { color: colors.time }]}>{item.timeLabel}</Text>
          <Text style={[S.dateText, { color: colors.date }]}>
            {item.dateLongLabel || item.dateLabel || "Date TBD"}
          </Text>
          {item.place ? (
            <View style={S.placeRow}>
              <Ionicons name="location" size={13} color="#15803D" />
              <Text style={[S.place, { color: colors.place }]} numberOfLines={2}>
                {item.place}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={S.sideCol}>
          <TeamLogo
            source={item.awayTeam.logo}
            abbrev={item.awayTeam.abbrev}
            colors={colors}
          />
          <Text style={[S.teamName, { color: colors.teamName }]} numberOfLines={2}>
            {item.awayTeam.name}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function UpcomingTbdCard({ item, onPress, colors }) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        S.card,
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.cardBorder,
          borderWidth: colors.cardBorderWidth,
          shadowOpacity: colors.cardShadowOpacity,
        },
      ]}
    >
      <View style={S.eventBadgeWrap}>
        <View style={[S.eventBadgeChip, { backgroundColor: colors.badgeBg }]}>
          <Text style={[S.eventBadgeChipText, { color: colors.badgeText }]} numberOfLines={1}>
            {item.eventLabel}
          </Text>
        </View>
      </View>

      <View style={[S.tbdRow, { marginTop: 20 }]}>
        <View style={S.tbdTeamCol}>
          <TeamLogo
            source={item.homeTeam.logo}
            abbrev={item.homeTeam.abbrev}
            size={60}
            colors={colors}
          />
          <Text style={[S.teamName, { color: colors.teamName }]} numberOfLines={2}>
            {item.homeTeam.name}
          </Text>
        </View>

        <View style={S.centerCol}>
          <Text style={[S.time, { color: colors.time }]}>{item.timeLabel}</Text>
          <Text style={[S.dateText, { color: colors.date }]}>
            {item.dateLongLabel || item.dateLabel || "Date TBD"}
          </Text>
          {item.place ? (
            <View style={S.placeRow}>
              <Ionicons name="location" size={13} color="#15803D" />
              <Text style={[S.place, { color: colors.place }]} numberOfLines={2}>
                {item.place}
              </Text>
            </View>
          ) : (
            <Text style={[S.tbdHint, { color: colors.date }]}>Add venue in Schedule</Text>
          )}
        </View>

        <View style={S.tbdRight}>
          <Ionicons name="person-add-outline" size={28} color={colors.date} />
          <Text style={[S.tbdVs, { color: colors.date }]}>TBD</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const EVENT_CATEGORY_META = {
  sports: { icon: "football-outline", accent: "#16A34A", soft: "#DCFCE7" },
  fitness: { icon: "fitness-outline", accent: "#EA580C", soft: "#FFEDD5" },
  gaming: { icon: "game-controller-outline", accent: "#7C3AED", soft: "#EDE9FE" },
  music: { icon: "musical-notes-outline", accent: "#DB2777", soft: "#FCE7F3" },
  food: { icon: "restaurant-outline", accent: "#D97706", soft: "#FEF3C7" },
  tech: { icon: "hardware-chip-outline", accent: "#2563EB", soft: "#DBEAFE" },
  arts: { icon: "color-palette-outline", accent: "#C026D3", soft: "#FAE8FF" },
  networking: { icon: "people-outline", accent: "#0891B2", soft: "#CFFAFE" },
  outdoor: { icon: "trail-sign-outline", accent: "#059669", soft: "#D1FAE5" },
  workshop: { icon: "construct-outline", accent: "#4F46E5", soft: "#E0E7FF" },
  "volunteer work": { icon: "heart-outline", accent: "#DC2626", soft: "#FEE2E2" },
  fundraiser: { icon: "gift-outline", accent: "#9333EA", soft: "#F3E8FF" },
  "social event": { icon: "sparkles-outline", accent: "#0284C7", soft: "#E0F2FE" },
  other: { icon: "calendar-outline", accent: "#475569", soft: "#E2E8F0" },
};

function getEventCategoryMeta(category) {
  return EVENT_CATEGORY_META[String(category || "").toLowerCase()] || EVENT_CATEGORY_META.other;
}

function UpcomingJoinedEventCard({ item, onPress, colors, isDark }) {
  const meta = getEventCategoryMeta(item.category);
  const start = new Date(item.startTime);
  const month = Number.isFinite(start.getTime())
    ? start.toLocaleDateString(undefined, { month: "short" }).toUpperCase()
    : "TBD";
  const day = Number.isFinite(start.getTime()) ? String(start.getDate()) : "—";
  const spots =
    item.maxParticipants > 0
      ? `${item.participantCount}/${item.maxParticipants} going`
      : `${item.participantCount} going`;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        S.joinedEventCard,
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.cardBorder,
          borderWidth: colors.cardBorderWidth,
          shadowOpacity: colors.cardShadowOpacity,
        },
      ]}
    >
      <View style={S.joinedDateTile}>
        <View style={[S.joinedCalendarHeader, { backgroundColor: meta.accent }]}>
          <View style={S.joinedCalendarRingRow}>
            <View style={S.joinedCalendarRing} />
            <View style={S.joinedCalendarRing} />
          </View>
          <Text style={S.joinedMonth}>{month}</Text>
        </View>
        <Text style={S.joinedDay}>{day}</Text>
      </View>

      <View style={S.joinedEventBody}>
        <View style={S.joinedBadgeRow}>
          <View style={[S.joinedCategoryBadge, { backgroundColor: isDark ? `${meta.accent}28` : meta.soft }]}>
            <Ionicons name={meta.icon} size={13} color={meta.accent} />
            <Text style={[S.joinedCategoryText, { color: meta.accent }]} numberOfLines={1}>
              {item.eventLabel}
            </Text>
          </View>
          <View style={S.joinedStatusBadge}>
            <Ionicons name="checkmark-circle" size={13} color="#15803D" />
            <Text style={S.joinedStatusText}>Joined</Text>
          </View>
        </View>

        <Text style={[S.joinedTitle, { color: colors.teamName }]} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={S.joinedMetaRow}>
          <View style={S.joinedMetaItem}>
            <Ionicons name="time-outline" size={14} color={meta.accent} />
            <Text style={[S.joinedMetaText, { color: colors.place }]} numberOfLines={1}>
              {item.timeLabel}
            </Text>
          </View>
          <View style={S.joinedMetaItem}>
            <Ionicons name="people-outline" size={14} color={meta.accent} />
            <Text style={[S.joinedMetaText, { color: colors.place }]} numberOfLines={1}>
              {spots}
            </Text>
          </View>
        </View>

        {item.place ? (
          <View style={S.joinedLocationRow}>
            <Ionicons name="location-outline" size={14} color={meta.accent} />
            <Text style={[S.joinedLocation, { color: colors.date }]} numberOfLines={1}>
              {item.place}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function HomeUpcomingGamesSection({ onReady, isSignedIn = true, isDark = false }) {
  const colors = isDark
    ? {
        title: "#F5F5F7",
        subtitle: "#A1A1AA",
        cardBg: "#16161A",
        cardBorder: "transparent",
        cardBorderWidth: 0,
        cardShadowOpacity: 0.35,
        teamName: "#F5F5F7",
        time: "#F5F5F7",
        date: "#A1A1AA",
        place: "#D4D4D8",
        emptyTitle: "#F5F5F7",
        emptyBody: "#A1A1AA",
        emptyBox: "#16161A",
        emptyBorder: "#2A2A2E",
        refreshBg: "#1E1E24",
        refreshBorder: "#2A2A2E",
        refreshIcon: "#A1A1AA",
        logoBg: "#1E1E24",
        logoBorder: "#2A2A2E",
        logoBorderWidth: 1,
        badgeBg: "#1E1E24",
        badgeText: "#F5F5F7",
        skeletonBone: "#2A2A2E",
        skeletonCardBg: "#16161A",
        skeletonCardBorder: "#2A2A2E",
      }
    : {
        title: "#111827",
        subtitle: "#6B7280",
        cardBg: "#FFFFFF",
        cardBorder: "#D1D5DB",
        cardBorderWidth: 1,
        cardShadowOpacity: 0.1,
        teamName: "#111827",
        time: "#111827",
        date: "#6B7280",
        place: "#374151",
        emptyTitle: "#111827",
        emptyBody: "#6B7280",
        emptyBox: "#F9FAFB",
        emptyBorder: "#D1D5DB",
        refreshBg: "#FFFFFF",
        refreshBorder: "#E5E7EB",
        refreshIcon: "#6B7280",
        logoBg: "#F3F4F6",
        logoBorder: "#E5E7EB",
        logoBorderWidth: 2,
        badgeBg: "#1F2937",
        badgeText: "#F3F4F6",
        skeletonBone: "#E5E7EB",
        skeletonCardBg: "#F3F4F6",
        skeletonCardBorder: "#E5E7EB",
      };
  const router = useRouter();
  const { upcoming, loading, refreshing, error, refresh } = useHomeUpcomingGames();

  useFocusEffect(
    useCallback(() => {
      if (isSignedIn) refresh({ silent: true });
    }, [refresh, isSignedIn]),
  );

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    onReadyRef.current?.({ refresh });
  }, [refresh]);

  const openItem = useCallback(
    (item) => {
      if (item?.kind === "joinedEvent" && item.eventId) {
        router.push({
          pathname: "/events",
          params: { eventId: String(item.eventId), backTo: "home" },
        });
        return;
      }
      if (!item?.teamId) return;
      router.push({
        pathname: `/team/${item.teamId}`,
        params: {
          initialTab: item.gameId ? "STATS" : "SCHEDULE",
          ...(item.gameId ? { gameId: String(item.gameId) } : {}),
        },
      });
    },
    [router],
  );

  const openSchedule = useCallback(() => {
    router.push("/(tabs)/teams");
  }, [router]);

  const openEvents = useCallback(() => {
    router.push({ pathname: "/events", params: { backTo: "home" } });
  }, [router]);

  if (!isSignedIn) {
    return (
      <View style={S.section}>
        <Text style={[S.title, { color: colors.title }]}>Upcoming</Text>
        <Text style={[S.subtitle, { color: colors.subtitle }]}>Games and joined events</Text>
        <View style={[S.emptyBox, { marginTop: 12, backgroundColor: colors.emptyBox, borderColor: colors.emptyBorder }]}>
          <Ionicons name="log-in-outline" size={34} color="#9CA3AF" />
          <Text style={[S.emptyTitle, { color: colors.emptyTitle }]}>Sign in to view upcoming events</Text>
          <Text style={[S.emptyBody, { color: colors.emptyBody }]}>
            Your games and events you join will appear here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={S.section}>
      <View style={S.headerRow}>
        <View>
          <Text style={[S.title, { color: colors.title }]}>Upcoming</Text>
          <Text style={[S.subtitle, { color: colors.subtitle }]}>Games and joined events</Text>
        </View>
        <TouchableOpacity
          onPress={() => refresh({ force: true })}
          style={[
            S.refreshBtn,
            { backgroundColor: colors.refreshBg, borderColor: colors.refreshBorder },
          ]}
          hitSlop={12}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.refreshIcon} />
          ) : (
            <Ionicons name="refresh" size={18} color={colors.refreshIcon} />
          )}
        </TouchableOpacity>
      </View>

      {loading && upcoming.length === 0 ? (
        <View style={S.list}>
          <CardSkeleton colors={colors} />
          <CardSkeleton colors={colors} />
        </View>
      ) : error ? (
        <View style={[S.emptyBox, { backgroundColor: colors.emptyBox, borderColor: colors.emptyBorder }]}>
          <Ionicons name="cloud-offline-outline" size={32} color="#6B7280" />
          <Text style={[S.emptyTitle, { color: colors.emptyTitle }]}>Could not load events</Text>
          <Text style={[S.emptyBody, { color: colors.emptyBody }]}>{error}</Text>
          <TouchableOpacity onPress={() => refresh({ force: true })} style={S.emptyBtn}>
            <Text style={S.emptyBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : upcoming.length === 0 ? (
        <View style={[S.emptyBox, { backgroundColor: colors.emptyBox, borderColor: colors.emptyBorder }]}>
          <ExpoImage
            source={UPCOMING_EMPTY_ICON}
            style={S.emptyEventIcon}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
          <Text style={[S.emptyTitle, { color: colors.emptyTitle }]}>No upcoming Events</Text>
          <Text style={[S.emptyBody, { color: colors.emptyBody }]}>
            Schedule a team game or join a community event.
          </Text>
          <View style={S.emptyActions}>
            <TouchableOpacity onPress={openSchedule} style={S.emptySecondaryBtn}>
              <Text style={[S.emptyBtnText, { color: colors.emptyTitle }]}>Teams</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openEvents} style={[S.emptyBtn, { marginTop: 0 }]}>
              <Text style={S.emptyBtnText}>Browse Events</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={S.list}>
          {upcoming.map((item) =>
            item.kind === "joinedEvent" ? (
              <UpcomingJoinedEventCard
                key={String(item.id)}
                item={item}
                colors={colors}
                isDark={isDark}
                onPress={() => openItem(item)}
              />
            ) : item.hasOpponent ? (
              <UpcomingMatchCard
                key={String(item.id)}
                item={item}
                colors={colors}
                onPress={() => openItem(item)}
              />
            ) : (
              <UpcomingTbdCard
                key={String(item.id)}
                item={item}
                colors={colors}
                onPress={() => openItem(item)}
              />
            ),
          )}
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  section: {
    marginBottom: 22,
    marginTop: 4,
    zIndex: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    gap: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    minHeight: 168,
  },
  joinedEventCard: {
    minHeight: 148,
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    overflow: "hidden",
  },
  joinedDateTile: {
    width: 62,
    height: 76,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 13,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  joinedCalendarHeader: {
    width: "100%",
    height: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  joinedCalendarRingRow: {
    position: "absolute",
    top: -3,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  joinedCalendarRing: {
    width: 4,
    height: 9,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
    opacity: 0.95,
  },
  joinedMonth: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  joinedDay: {
    marginTop: 5,
    color: "#111827",
    fontSize: 26,
    lineHeight: 29,
    fontWeight: "900",
  },
  joinedEventBody: {
    flex: 1,
    minWidth: 0,
  },
  joinedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 7,
  },
  joinedCategoryBadge: {
    maxWidth: "58%",
    minHeight: 25,
    borderRadius: 999,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  joinedCategoryText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "800",
  },
  joinedStatusBadge: {
    minHeight: 25,
    borderRadius: 999,
    paddingHorizontal: 8,
    backgroundColor: "#DCFCE7",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  joinedStatusText: {
    color: "#15803D",
    fontSize: 10,
    fontWeight: "900",
  },
  joinedTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  joinedMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  joinedMetaItem: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  joinedMetaText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  joinedLocationRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 4,
  },
  joinedLocation: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
  },
  eventBadgeWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
  },
  eventBadge: {
    textAlign: "center",
    backgroundColor: "#E5E7EB",
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: "hidden",
  },
  tbdSubBadge: {
    position: "absolute",
    top: 32,
    alignSelf: "center",
    fontSize: 10,
    fontWeight: "700",
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 1,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6,
  },
  sideCol: {
    width: 88,
    alignItems: "center",
  },
  centerCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    paddingHorizontal: 4,
  },
  logoWrap: {
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  eventBadgeChip: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eventBadgeChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  logoAbbrev: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 13,
  },
  teamName: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    lineHeight: 14,
  },
  time: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },
  dateText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
    textAlign: "center",
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 8,
    maxWidth: "100%",
    paddingHorizontal: 2,
  },
  place: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
    lineHeight: 14,
  },
  tbdTopBadge: {
    alignSelf: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  tbdTopBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
  },
  tbdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tbdTeamCol: {
    width: 92,
    alignItems: "center",
  },
  tbdRight: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  tbdVs: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "900",
    color: "#9CA3AF",
  },
  tbdHint: {
    marginTop: 8,
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    fontWeight: "600",
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    minHeight: 160,
    justifyContent: "center",
  },
  emptyEventIcon: {
    width: 88,
    height: 88,
    marginBottom: -2,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
  emptyBtn: {
    marginTop: 14,
    backgroundColor: "#9AEA62",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  emptyActions: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptySecondaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  skeletonCircle: {},
});

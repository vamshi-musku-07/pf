import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Loading from "@/components/Loading";
import { SPORTS_LIST, HOME_PICK_SPORT_ICONS, HOME_PICK_SPORT_ICONS_DARK } from "@/constants/sports";
import { LinearGradient } from "expo-linear-gradient";
import { showToast } from "@/context/ToastContext";
import { useVideoPlayer } from "expo-video";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Asset } from "expo-asset";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useInvitations } from "@/hooks/useInvitations";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { useHomeScrollY } from "@/context/HomeScrollContext";
import { useRefresh } from "@/hooks/useRefresh";
import { acceptInvitationAPI } from "@/services/PlayerApi";
import { logoRequireMap } from "@/app/team/tabs/helpers";
import LottieView from "lottie-react-native";
import HomeUpcomingGamesSection from "@/components/HomeUpcomingGamesSection";
import HomeTournamentsSection from "@/components/HomeTournamentsSection";
import { BACK_TO_HOME } from "@/lib/navigationBack";
import { useAppearance } from "@/context/AppearanceContext";

const { width } = Dimensions.get("window");

const HOME_THEME = {
  light: {
    bg: "#f8f9fa",
    surface: "#FFFFFF",
    text: "#111827",
    textDim: "#64748B",
    textMuted: "#6B7280",
    headingLine: "#94A3B8",
    border: "#E5E7EB",
    inviteSubtitle: "#6b7280",
    emptyInvite: "#9ca3af",
    featureTitle: "#1f2937",
    splitGradient: ["#FFFFFF", "#E9FBF4"],
    eventsGradient: ["#FFFFFF", "#F1ECFD"],
    refresh: "#000",
  },
  dark: {
    bg: "#0A0A0C",
    surface: "#16161A",
    text: "#F5F5F7",
    textDim: "#A1A1AA",
    textMuted: "#71717A",
    headingLine: "#3F3F46",
    border: "#27272A",
    inviteSubtitle: "#A1A1AA",
    emptyInvite: "#71717A",
    featureTitle: "#F5F5F7",
    splitGradient: ["#464858", "#0F1A0C"],
    eventsGradient: ["#464858", "#160E22"],
    refresh: "#9AEA62",
  },
};

// Clay-style 3D icons for Pick a Sport (theme-specific scene art).
const sportsLight = SPORTS_LIST.map((s) => ({
  ...s,
  icon: HOME_PICK_SPORT_ICONS[s.name] || HOME_PICK_SPORT_ICONS.Football,
}));
const sportsDark = SPORTS_LIST.map((s) => ({
  ...s,
  icon: HOME_PICK_SPORT_ICONS_DARK[s.name] || HOME_PICK_SPORT_ICONS_DARK.Football,
}));
const FEATURE_ACTION_ICONS = {
  splitBill: require("../../assets/images/feature-split-bill-3d.png"),
  events: require("../../assets/images/feature-events-3d.png"),
};
const buildSportColumns = (list) =>
  Array.from({ length: Math.ceil(list.length / 2) }, (_, index) =>
    list.slice(index * 2, index * 2 + 2),
  );

const HERO_SLIDES = [
  {
    key: "team",
    title: "Level Up\nYour Play",
    cta: "Create Your Team",
    image: require("../../assets/images/home-hero-basketball.jpg"),
  },
  {
    key: "tournament",
    title: "Organise a\nTournament",
    cta: "Get Started",
    image: require("../../assets/images/tournament-header-arena-3d.jpg"),
  },
  {
    key: "events",
    title: "Discover\nLocal Events",
    cta: "Explore Events",
    image: require("../../assets/images/home-hero-events.jpg"),
    imagePosition: { right: "0%", top: "50%" },
  },
  {
    key: "split",
    title: "Split Bills\nWith Ease",
    cta: "Split a Bill",
    image: require("../../assets/images/home-hero-split.jpg"),
    imagePosition: "right",
  },
];
const HERO_CARD_W = width - 32;

// Decode featured tiles ASAP so the horizontal row feels instant.
Asset.loadAsync([
  ...sportsLight.map((s) => s.icon),
  ...sportsDark.map((s) => s.icon),
  ...Object.values(FEATURE_ACTION_ICONS),
  ...HERO_SLIDES.map((s) => s.image),
]).catch(() => {});

const resolveInvitationLogoSource = (teamLogo) => {
  if (!teamLogo || typeof teamLogo !== "string") return null;

  const mappedLogo = logoRequireMap[teamLogo];
  if (mappedLogo) return mappedLogo;

  if (/^https?:\/\//i.test(teamLogo)) {
    return { uri: teamLogo };
  }

  return null;
};

const formatCoachName = (coachName) => {
  if (typeof coachName !== "string") return "A Coach";
  const trimmedCoachName = coachName.trim();
  return trimmedCoachName || "A Coach";
};

const getInvitationSortTimestamp = (invitation) => {
  const timestamp = new Date(
    invitation?.sentAt || invitation?.acceptedAt || invitation?.expiresAt || 0
  ).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f9fa" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 150 },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 16,
    paddingTop: 100,
  },

  // Hero card
  hero: {
    width: "100%",
    height: 190,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111827",
    shadowColor: "#0b0b0b",
    shadowOpacity: 0.32,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 22 },
    elevation: 24,
    overflow: "hidden",
  },
  heroSubtleBlob: {
    position: "absolute",
    bottom: -70,
    left: 100,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,242,242,0.05)",
  },
  heroSlide: {
    width: HERO_CARD_W,
    height: 214,
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  heroSlideImage: { ...StyleSheet.absoluteFillObject },
  heroSlideOverlay: { ...StyleSheet.absoluteFillObject },
  heroSlideContent: { padding: 20 },
  heroCtaPill: {
    marginTop: 16,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#9AEA62",
  },
  heroDots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  heroDotActive: {
    width: 18,
    backgroundColor: "#FFFFFF",
  },
  heroTitle: {
    color: "#f3f4f6",
    textTransform: "uppercase",
    fontWeight: "700",
    fontSize: 30,
  },
  heroCtaRow: {
    marginTop: 28,
    padding: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "#9AEA62",
    shadowColor: "#9AEA62",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  heroCtaText: { color: "#1f2937", fontWeight: "700", fontSize: 15 },
  heroCtaBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  heroLottie: { position: "absolute", right: -56, bottom: -28 },

  // Sport card
  sportsSection: { paddingTop: 28, paddingBottom: 16 },
  sportsHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
  sportsHeadingLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#94A3B8",
  },
  sportsHeadingText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: "#64748B",
    textTransform: "uppercase",
  },
  sportsFadeWrapper: { position: "relative" },
  sportsFadeEdge: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
  },
  sportCardAnim: {},
  sportCardTouch: { alignItems: "center" },
  sportColumn: { gap: 8 },
  sportCard: {
    width: 108,
    height: 144,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8E8EA",
  },
  sportNameBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  sportCardLabel: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  sportIconImage: {
    width: "100%",
    height: "100%",
  },
  sportImageWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
  },
  sportImageBlend: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 30,
  },

  // Invitations section
  inviteSection: { paddingTop: 20, paddingBottom: 20 },
  inviteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  inviteTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  inviteSubtitle: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  viewAllBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  viewAllText: { color: "#374151", fontWeight: "600", fontSize: 12 },
  emptyInvite: { alignItems: "center", paddingVertical: 24 },
  emptyInviteText: { color: "#9ca3af", fontSize: 20, fontWeight: "600" },

  // Invitation card
  inviteCard: {
    borderRadius: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  inviteCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  inviteIconBox: {
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  inviteLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    shadowColor: "#111827",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  inviteLogoImage: { width: "100%", height: "100%" },
  inviteTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  inviteTeamName: { fontWeight: "700", fontSize: 20, color: "#111827" },
  inviteSportText: { fontSize: 11, color: "#171818" },
  inviteCoachMeta: {
    maxWidth: 120,
    marginLeft: 8,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  inviteCoachLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#475569",
    letterSpacing: 0.6,
  },
  inviteCoachName: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  inviteActionBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#111827",
    shadowOpacity: 0.26,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  inviteActionText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },

  // Feature cards
  featureSection: { paddingTop: 18, paddingBottom: 4 },
  featureRow: { flexDirection: "row", gap: 14 },
  featureCard: {
    flex: 1,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    position: "relative",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  featureCardBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.05)",
  },
  featureContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  featureIconImage: {
    width: 44,
    height: 44,
  },
  featureTitle: {
    color: "#1f2937",
    fontWeight: "400",
    fontSize: 15,
  },
});

// ─── Invitations skeleton ────────────────────────────────────────────────────
function InvitationsSkeleton() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ gap: 12 }}>
      {[0, 1].map((i) => (
        <Animated.View
          key={i}
          style={{
            opacity: pulse,
            backgroundColor: "#E5E7EB",
            borderRadius: 10,
            height: 110,
          }}
        />
      ))}
    </View>
  );
}

// FlatList perf defaults shared across all lists
const FLATLIST_PERF = {
  maxToRenderPerBatch: 8,
  updateCellsBatchingPeriod: 50,
  removeClippedSubviews: Platform.OS === "android",
  windowSize: 5,
};

// ─── Component ───────────────────────────────────────────────────────────────
const Index = () => {
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);
  const router = useRouter();
  const { isSignedIn } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = isDark ? HOME_THEME.dark : HOME_THEME.light;
  const sportColumns = buildSportColumns(isDark ? sportsDark : sportsLight);
  const homeScrollY = useHomeScrollY();
  const { invitations, isLoading: invitationsLoading, fetchInvitations } = useInvitations();
  const upcomingRefreshRef = useRef(null);
  const handleUpcomingReady = useCallback(({ refresh }) => {
    upcomingRefreshRef.current = () => refresh({ force: true });
  }, []);
  const { refreshing, onRefresh } = useRefresh(async () => {
    await fetchInvitations({ force: true });
    await upcomingRefreshRef.current?.();
  });


  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isSignedIn) fetchInvitations();
    }, [isSignedIn, fetchInvitations]),
  );

  const invitationCards = invitations
    .filter((inv) =>
      // Skip invitations where the team was deleted, player removed, or invitation is invalid
      !inv.teamDeleted &&
      !inv.isRemoved &&
      !inv.isRevoked &&
      !inv.isExpired &&
      inv.isActive !== false &&
      (inv.canAccept || inv.isAccepted)
    )
    .sort((left, right) => getInvitationSortTimestamp(right) - getInvitationSortTimestamp(left))
    .slice(0, 3)
    .map((inv) => ({
      id: inv.invitationId,
      team: inv.teamName || "Team Invitation",
      teamLogo: inv.teamLogo || inv.teamlogo || "",
      coachName: formatCoachName(inv.inviterName),
      sport: inv.sport || "",
      members: inv.season || "",
      icon:
        inv.sport === "Football"
          ? "football"
          : inv.sport === "Basketball"
            ? "basketball"
            : inv.sport === "Cricket"
              ? "tennisball"
              : "people",
      color:
        inv.sport === "Football"
          ? "#010911"
          : inv.sport === "Basketball"
            ? "#010911"
            : "#010911",
      isAccepted: inv.isAccepted,
      teamId: inv.teamId,
      invitationId: inv.invitationId,
      invitationToken: inv.token || inv.invitationToken,
      email: inv.email,
      season: inv.season,
      location: inv.location,
      playerRole: inv.playerRole,
      playerName: inv.playerName,
      playerPosition: inv.playerPosition,
      playerJerseyNumber: inv.playerJerseyNumber,
      expiresAt: inv.expiresAt,
    }));

  const handleViewInvitation = async (item) => {
    if (acceptingId) return;
    const teamId = item.teamId;

    if (item.isAccepted) {
      router.push({
        pathname: `/team/${teamId}`,
        params: { initialTab: "AVAILABILITY", backTo: "/(tabs)" },
      });
      return;
    }

    setAcceptingId(item.id);
    try {
      const result = await acceptInvitationAPI(
        item.invitationToken,
        item.email,
      );
      const resolvedTeamId = result?.data?.teamId || teamId;
      fetchInvitations({ force: true });
      router.push({
        pathname: `/team/${resolvedTeamId}`,
        params: { initialTab: "AVAILABILITY", backTo: "/(tabs)" },
      });
    } catch (err) {
      showToast(
        err.response?.data?.message ||
        err.message ||
        "Failed to accept invitation",
        "error",
      );
    } finally {
      setAcceptingId(null);
    }
  };

  const goToCreateTeam = useCallback(() => {
    router.push("/(tabs)/CreateTeam");
  }, [router]);

  const openCreateTeamWithSport = useCallback(
    (sportName) => {
      router.push({ pathname: "/(tabs)/CreateTeam", params: { sport: sportName } });
    },
    [router],
  );

  const heroRef = useRef(null);
  const [heroIndex, setHeroIndex] = useState(0);

  const handleHeroPress = useCallback(
    (key) => {
      if (key === "team") goToCreateTeam();
      else if (key === "tournament")
        router.push({ pathname: "/tournament", params: { backTo: BACK_TO_HOME } });
      else if (key === "split")
        router.push({ pathname: "/tricount", params: { backTo: BACK_TO_HOME } });
      else router.push({ pathname: "/events", params: { backTo: BACK_TO_HOME } });
    },
    [goToCreateTeam, router],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setHeroIndex((prev) => {
        const next = (prev + 1) % HERO_SLIDES.length;
        heroRef.current?.scrollToOffset({ offset: next * HERO_CARD_W, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const renderHeroSlide = useCallback(
    ({ item }) => (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => handleHeroPress(item.key)}
        style={[
          S.heroSlide,
          {
            borderWidth: isDark ? 1 : 0,
            borderColor: isDark ? "#2A2A2E" : "transparent",
            backgroundColor: isDark ? "#111827" : "#0B1220",
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={item.cta}
      >
        <ExpoImage
          source={item.image}
          style={S.heroSlideImage}
          contentFit="cover"
          contentPosition={item.imagePosition || "center"}
          cachePolicy="memory-disk"
          recyclingKey={`hero-${item.key}`}
          transition={0}
        />
        <LinearGradient
          colors={["rgba(10,14,25,0.88)", "rgba(10,14,25,0.35)", "rgba(10,14,25,0.15)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={S.heroSlideOverlay}
        />
        <View style={S.heroSlideContent}>
          <Text style={S.heroTitle}>{item.title}</Text>
          <View style={S.heroCtaPill}>
            <Text style={S.heroCtaText}>{item.cta}</Text>
            <View style={S.heroCtaBtn}>
              <MaterialIcons name="arrow-outward" size={18} color="white" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [handleHeroPress, isDark],
  );

  const animStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
  };

  const renderSportCard = useCallback(
    ({ item }) => (
      <Animated.View style={animStyle}>
        <TouchableOpacity
          style={S.sportCardTouch}
          accessibilityLabel={`${item.name} sport`}
          accessibilityRole="button"
          accessibilityHint={`Create a ${item.name} team`}
          activeOpacity={0.85}
          onPress={() => openCreateTeamWithSport(item.name)}
        >
          <View
            style={[
              S.sportCard,
              {
                backgroundColor: isDark ? "#000000" : "#FFFFFF",
                borderColor: isDark ? "#2A2A2E" : "#E8E8EA",
              },
            ]}
          >
            <View
              style={[
                S.sportImageWrap,
                { backgroundColor: isDark ? "#000000" : "#FFFFFF" },
              ]}
            >
              <ExpoImage
                source={item.icon}
                style={S.sportIconImage}
                contentFit="cover"
                contentPosition="center"
                cachePolicy="memory-disk"
                recyclingKey={`pick-${item.name}-${isDark ? "d" : "l"}`}
                transition={0}
              />
            </View>
            {/* Name sits on a bar matching the image header color so it blends seamless */}
            <View
              style={[
                S.sportNameBar,
                { backgroundColor: isDark ? "#000000" : "#FFFFFF" },
              ]}
              pointerEvents="none"
            >
              <Text
                style={[
                  S.sportCardLabel,
                  isDark && { color: "#F5F5F7" },
                ]}
                numberOfLines={1}
              >
                {item.name === "IceHockey"
                  ? "Ice Hockey"
                  : item.name === "Table Tennis"
                    ? "Table Tennis"
                    : item.name}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    ),
    [fadeAnim, slideAnim, scaleAnim, openCreateTeamWithSport, isDark],
  );

  const renderSportColumn = useCallback(
    ({ item }) => (
      <View style={S.sportColumn}>
        {item.map((sport) => (
          <View key={sport.name}>{renderSportCard({ item: sport })}</View>
        ))}
      </View>
    ),
    [renderSportCard],
  );

  const INVITE_CARD_BG = ["#27C6E4", "#C4E4A5", "#C7BAD4"];

  const renderInvitationCard = useCallback(
    ({ item, index }) => {
      const logoSource = resolveInvitationLogoSource(item.teamLogo);

      return (
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >


          <View
            className="relative overflow-hidden"
            style={[
              S.inviteCard,
              {
                backgroundColor: INVITE_CARD_BG[index % 3],
                zIndex: invitations.length - index,
              },
            ]}
          >
            <View className="flex-row items-start gap-4 mb-4">
              {logoSource ? (
                <View style={S.inviteLogoBox}>
                  <Image source={logoSource} style={S.inviteLogoImage} resizeMode="cover" />
                </View>
              ) : (
                <View
                  style={[
                    S.inviteIconBox,
                    { backgroundColor: item.color, shadowColor: item.color },
                  ]}
                >
                  <Ionicons name={item.icon} size={24} color="white" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={S.inviteTitleRow}>
                  <Text style={[S.inviteTeamName, { flex: 1 }]} numberOfLines={1}>
                    {item.team.charAt(0).toUpperCase() + item.team.slice(1)}
                  </Text>

                </View>
                {[item.sport, item.members].filter(Boolean).length > 0 ? (
                  <Text style={S.inviteSportText}>
                    {[item.sport, item.members].filter(Boolean).join(" • ")}
                  </Text>
                ) : null}


                <View className="flex-row items-center gap-1 w-full mt-1">
                  <Text className="font-semibold">Coach :</Text>
                  <Text className="truncate" numberOfLines={1}>
                    {item.coachName}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={acceptingId === item.id}
              onPress={() => handleViewInvitation(item)}
              style={S.inviteActionBtn}
              accessibilityLabel={
                item.isAccepted
                  ? `View RSVP for ${item.team}`
                  : `Accept invitation to join ${item.team}`
              }
              accessibilityRole="button"
              accessibilityState={{
                disabled: acceptingId === item.id,
                busy: acceptingId === item.id,
              }}
            >
              {acceptingId === item.id && (
                <ActivityIndicator size="small" color="#9AEA62" />
              )}
              <Text style={S.inviteActionText}>
                {acceptingId === item.id
                  ? "Joining…"
                  : item.isAccepted
                    ? "View RSVP →"
                    : "Accept & Set Availability →"}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    },
    [fadeAnim, slideAnim, acceptingId, invitations.length],
  );

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: T.bg }]} edges={["top"]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={T.bg}
      />
      <Animated.ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={
          homeScrollY
            ? Animated.event(
                [{ nativeEvent: { contentOffset: { y: homeScrollY } } }],
                { useNativeDriver: true },
              )
            : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[T.refresh]}
            tintColor={T.refresh}
          />
        }
      >
        <View style={[S.container, { backgroundColor: T.bg }]}>

          


 
          {/* Hero Carousel */}
          <View>
            <FlatList
              key={`hero-carousel-${isDark ? "d" : "l"}`}
              ref={heroRef}
              data={HERO_SLIDES}
              keyExtractor={(item) => item.key}
              renderItem={renderHeroSlide}
              extraData={isDark}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setHeroIndex(Math.round(e.nativeEvent.contentOffset.x / HERO_CARD_W))
              }
              getItemLayout={(_, index) => ({
                length: HERO_CARD_W,
                offset: HERO_CARD_W * index,
                index,
              })}
            />
            <View style={S.heroDots}>
              {HERO_SLIDES.map((slide, i) => (
                <View
                  key={slide.key}
                  style={[S.heroDot, i === heroIndex && S.heroDotActive]}
                />
              ))}
            </View>
          </View>



                {/* Quick actions */}
         <View className="mb-3" style={S.featureSection}>
            <View style={S.sportsHeadingRow}>
              <View style={[S.sportsHeadingLine, { backgroundColor: T.headingLine }]} />
              <Text style={[S.sportsHeadingText, { color: T.textDim }]}>Explore</Text>
              <View style={[S.sportsHeadingLine, { backgroundColor: T.headingLine }]} />
            </View>

            {/* <View className="flex-row items-center gap-3">
            <Text className="h-[1px] w-[10%] bg-gray-300"/>
              <Text className="text-[18px] mb-2 text-gray-500 ">Explore</Text>
              <Text className="h-[1px] w-[60%] bg-gray-300"/>
            </View> */}
            <View style={S.featureRow}>
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: "/tricount", params: { backTo: BACK_TO_HOME } })
                }
                activeOpacity={0.85}
                style={[
                  S.featureCard,
                  isDark && {
                    backgroundColor: T.surface,
                    borderWidth: 1,
                    borderColor: T.border,
                    shadowOpacity: 0.35,
                  },
                ]}
                accessibilityLabel="Split Bill"
                accessibilityRole="button"
                accessibilityHint="Share expenses with your team"
              >
                <LinearGradient
                  // SPLIT BILL tint: 2nd color = green. Make it stronger/darker
                  // (e.g. "#D6F5E8" or "#C7F0DC") to increase the green intensity.
                  colors={T.splitGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={S.featureCardBg}
                />
                <View style={S.featureContent}>
                  <ExpoImage
                    source={FEATURE_ACTION_ICONS.splitBill}
                    style={S.featureIconImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                  <Text style={[S.featureTitle, { color: T.featureTitle }]}>Split Bill</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: "/events", params: { backTo: BACK_TO_HOME } })
                }
                activeOpacity={0.85}
                style={[
                  S.featureCard,
                  isDark && {
                    backgroundColor: T.surface,
                    borderWidth: 1,
                    borderColor: T.border,
                    shadowOpacity: 0.35,
                  },
                ]}
                accessibilityLabel="Events"
                accessibilityRole="button"
                accessibilityHint="Find and join local sports events"
              >
                <LinearGradient
                  // EVENTS tint: 2nd color = violet. Make it stronger/darker
                  // (e.g. "#E6DCFB" or "#DCCFF7") to increase the violet intensity.
                  colors={T.eventsGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={S.featureCardBg}
                />
                <View style={S.featureContent}>
                  <ExpoImage
                    source={FEATURE_ACTION_ICONS.events}
                    style={S.featureIconImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                  <Text style={[S.featureTitle, { color: T.featureTitle }]}>Events</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

   


          {/* Featured Games */}
          <View style={S.sportsSection}>
            <View style={S.sportsHeadingRow}>
              <View style={[S.sportsHeadingLine, { backgroundColor: T.headingLine }]} />
              <Text style={[S.sportsHeadingText, { color: T.textDim }]}>Pick a Sport</Text>
              <View style={[S.sportsHeadingLine, { backgroundColor: T.headingLine }]} />
            </View>

            <View style={S.sportsFadeWrapper}>
              <FlatList
                data={sportColumns}
                keyExtractor={(item) => item.map((sport) => sport.name).join("-")}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: 8,
                  paddingHorizontal: 2,
                  paddingRight: 32,
                }}
                initialNumToRender={7}
                renderItem={renderSportColumn}
                accessibilityLabel="Featured games"
                {...FLATLIST_PERF}
              />
            </View>
          </View>



          




          <HomeUpcomingGamesSection
            isSignedIn={isSignedIn}
            onReady={handleUpcomingReady}
            isDark={isDark}
          />

          {/* <HomeTournamentsSection /> */}



          {/* Invitations */}
          <View style={S.inviteSection}>
            <View style={S.inviteHeader}>
              <View>
                <Text style={{ color: T.text, fontWeight: "600", fontSize: 20 }}>Invitations</Text>
                <Text style={[S.inviteSubtitle, { color: T.inviteSubtitle }]}>
                  {invitationCards.filter((i) => !i.isAccepted).length > 0
                    ? `You have ${invitationCards.filter((i) => !i.isAccepted).length} pending invitation${invitationCards.filter((i) => !i.isAccepted).length === 1 ? "" : "s"}`
                    : "No pending invitations"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/invitations")}
                activeOpacity={0.8}
                style={{
                  backgroundColor: isDark ? T.surface : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: isDark ? T.border : "#E5E7EB",
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: T.text }}>View all</Text>
              </TouchableOpacity>
            </View>

            {invitationsLoading ? (
              <InvitationsSkeleton />
            ) : invitationCards.length > 0 ? (
              <View style={{ gap: 12 }}>
                {invitationCards.map((item, index) => (
                  <View key={item.id || `invitation-${index}`}>
                    {renderInvitationCard({ item, index })}
                  </View>
                ))}
              </View>
            ) : (
              <View style={S.emptyInvite}>
                <Text style={[S.emptyInviteText, { color: T.emptyInvite }]}>No invitations yet</Text>
              </View>
            )}
          </View>




    

        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

export default Index;

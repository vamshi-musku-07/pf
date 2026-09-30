import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import LightOnDarkStatusBar from "@/components/LightOnDarkStatusBar";
import { goBackTo } from "@/lib/navigationBack";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import {
  SPORTS_LIST,
  HOME_PICK_SPORT_ICONS,
  HOME_PICK_SPORT_ICONS_DARK,
} from "@/constants/sports";
import { showToast } from "@/context/ToastContext";

/** Sports that can start tournament create today. */
const TOURNAMENT_SPORTS_READY = new Set(["Cricket", "Football", "Volleyball", "Baseball", "Basketball"]);

const displaySportName = (name) => {
  if (name === "IceHockey") return "Ice Hockey";
  if (name === "TableTennis") return "Table Tennis";
  return name;
};

const sportIdForCreate = (name) => {
  if (name === "Table Tennis") return "TableTennis";
  return name;
};

/**
 * Tournament create — sport picker (same card art as home Pick a Sport).
 */
export default function TournamentPickSport() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isDark } = useAppearance();
  const T = useMemo(() => getAppTheme(isDark), [isDark]);

  const pad = 16;
  const gap = 10;
  const cols = 3;
  const cardW = Math.floor((width - pad * 2 - gap * (cols - 1)) / cols);
  const cardH = Math.round(cardW * (144 / 108));

  const sports = useMemo(() => {
    const mapped = SPORTS_LIST.filter((s) => s.name !== "Chess").map((s) => ({
      ...s,
      id: sportIdForCreate(s.name),
      label: displaySportName(s.name),
      icon: isDark
        ? HOME_PICK_SPORT_ICONS_DARK[s.name] || HOME_PICK_SPORT_ICONS_DARK.Football
        : HOME_PICK_SPORT_ICONS[s.name] || HOME_PICK_SPORT_ICONS.Football,
    }));
    // Available sports first: Football, Cricket, Volleyball, Baseball, Basketball, then the rest
    const readyOrder = ["Football", "Cricket", "Volleyball", "Baseball", "Basketball"];
    return [...mapped].sort((a, b) => {
      const ai = readyOrder.indexOf(a.id);
      const bi = readyOrder.indexOf(b.id);
      const aReady = ai >= 0;
      const bReady = bi >= 0;
      if (aReady && bReady) return ai - bi;
      if (aReady) return -1;
      if (bReady) return 1;
      return 0;
    });
  }, [isDark]);

  const onSelect = (sport) => {
    if (!TOURNAMENT_SPORTS_READY.has(sport.id)) {
      showToast(`${sport.label} tournaments coming soon`, "info");
      return;
    }
    router.push({
      pathname: "/tournament/create",
      params: {
        sport: sport.id,
        backTo: params.backTo || "/tournament",
      },
    });
  };

  const pageBg = isDark ? "#0A0A0C" : "#F8F9FA";
  const cardBg = isDark ? "#000000" : "#FFFFFF";
  const cardBorder = isDark ? "#2A2A2E" : "#E8E8EA";
  const labelColor = isDark ? "#F5F5F7" : "#111827";
  const headingLine = isDark ? "#3F3F46" : "#94A3B8";
  const headingText = isDark ? "#A1A1AA" : "#64748B";

  return (
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      <LightOnDarkStatusBar />

      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: pad,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => goBackTo(router, params.backTo, "/tournament")}
          hitSlop={10}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDark ? T.surface : "#FFFFFF",
            borderWidth: 1,
            borderColor: T.border,
          }}
        >
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: pad,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingRow}>
          <View style={[styles.headingLine, { backgroundColor: headingLine }]} />
          <Text style={[styles.headingText, { color: headingText }]}>Pick a Sport</Text>
          <View style={[styles.headingLine, { backgroundColor: headingLine }]} />
        </View>

        <View style={[styles.grid, { gap }]}>
          {sports.map((sport) => {
            const ready = TOURNAMENT_SPORTS_READY.has(sport.id);
            return (
              <TouchableOpacity
                key={sport.id}
                activeOpacity={0.85}
                onPress={() => onSelect(sport)}
                accessibilityRole="button"
                accessibilityLabel={`${sport.label} tournament`}
                style={{
                  width: cardW,
                  height: cardH,
                  opacity: ready ? 1 : 0.55,
                }}
              >
                <View
                  style={[
                    styles.card,
                    {
                      width: cardW,
                      height: cardH,
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[styles.imageWrap, { backgroundColor: cardBg }]}
                  >
                    <ExpoImage
                      source={sport.icon}
                      style={styles.image}
                      contentFit="cover"
                      contentPosition="center"
                      cachePolicy="memory-disk"
                      recyclingKey={`tournament-pick-${sport.id}-${isDark ? "d" : "l"}`}
                      transition={0}
                    />
                  </View>
                  <View
                    style={[styles.nameBar, { backgroundColor: cardBg }]}
                    pointerEvents="none"
                  >
                    <Text
                      style={[styles.label, { color: labelColor }]}
                      numberOfLines={1}
                    >
                      {sport.label}
                    </Text>
                  </View>
                  {!ready ? (
                    <View style={styles.soonBadge} pointerEvents="none">
                      <Text
                        style={[
                          styles.soonText,
                          isDark
                            ? styles.soonTextDark
                            : styles.soonTextLight,
                        ]}
                      >
                        Soon
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginTop: 8,
    gap: 12,
  },
  headingLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  headingText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  imageWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  nameBar: {
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
  label: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  soonBadge: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  soonText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  soonTextDark: {
    color: "#F5F5F7",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  soonTextLight: {
    color: "#111827",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
});

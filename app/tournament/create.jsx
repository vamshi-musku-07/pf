import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import LightOnDarkStatusBar from "@/components/LightOnDarkStatusBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { showToast } from "@/context/ToastContext";
import { createTournamentAPI } from "@/services/TournamentApi";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import {
  DIVISION_COUNT_OPTIONS,
  QUALIFIERS_PER_DIVISION_OPTIONS,
  SINGLE_DIVISION_PLAYOFF_OPTIONS,
  VOLLEYBALL_MATCH_FORMATS,
  DEFAULT_VOLLEYBALL_POINTS,
  BASEBALL_INNINGS_OPTIONS,
  BASEBALL_EXTRA_INNINGS_OPTIONS,
  BASEBALL_TIME_LIMIT_OPTIONS,
  DEFAULT_BASEBALL_MERCY_RULES,
  BASKETBALL_QUARTER_OPTIONS,
  BASKETBALL_OVERTIME_OPTIONS,
  BASKETBALL_SHOT_CLOCK_OPTIONS,
  buildHybridPlayoffConfig,
  buildVolleyballMatchConfig,
  buildBaseballMatchConfig,
  buildBasketballMatchConfig,
  describeDivisionLayout,
  divisionCountTip,
  divisionPlayoffTip,
  describeKnockoutAutoStage,
  describeKnockoutPreviewSteps,
  getCreateFormats,
  divisionUnitLabel,
  usesGroupWording,
  isVolleyballSport,
  isBaseballSport,
  isBasketballSport,
} from "@/features/tournament/createConfig";

const SPORT_LABELS = {
  Cricket: "Cricket",
  Football: "Football",
  Basketball: "Basketball",
  Baseball: "Baseball",
  Volleyball: "Volleyball",
  Tennis: "Tennis",
  TableTennis: "Table Tennis",
  Badminton: "Badminton",
  Rugby: "Rugby",
  Hockey: "Hockey",
  IceHockey: "Ice Hockey",
  Pickleball: "Pickleball",
};

const MATCH_FORMATS = [
  { id: "T20", overs: 20 },
  { id: "ODI", overs: 50 },
  { id: "T10", overs: 10 },
  { id: "Custom", overs: 20 },
];

const FOOTBALL_HALF_OPTIONS = [
  { id: "40", minutes: 40 },
  { id: "45", minutes: 45 },
  { id: "Custom", minutes: 45 },
];

const Field = ({ label, children, hint, isDark, T }) => (
  <View style={{ marginBottom: 18 }}>
    <Text
      style={{
        fontSize: 13,
        fontWeight: "700",
        color: isDark ? T.textDim : "#374151",
        marginBottom: 8,
      }}
    >
      {label}
    </Text>
    {children}
    {hint ? (
      <Text
        style={{
          fontSize: 11,
          color: isDark ? T.textMuted : "#9CA3AF",
          marginTop: 8,
          lineHeight: 16,
        }}
      >
        {hint}
      </Text>
    ) : null}
  </View>
);

const InfoChip = ({ icon, title, subtitle, isDark, T }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
      borderWidth: 1,
      borderColor: isDark ? T.border : "#E2E8F0",
      borderRadius: 12,
      padding: 12,
      marginBottom: 18,
    }}
  >
    <Ionicons name={icon} size={18} color={isDark ? T.text : "#0B1324"} style={{ marginTop: 1 }} />
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>{title}</Text>
      {subtitle ? (
        <Text
          style={{
            fontSize: 12,
            color: isDark ? T.textDim : "#6B7280",
            marginTop: 3,
            lineHeight: 17,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  </View>
);

const SectionTitle = ({ children, isDark, T }) => (
  <Text
    style={{
      fontSize: 11,
      fontWeight: "800",
      color: isDark ? T.textMuted : "#94A3B8",
      letterSpacing: 0.6,
      marginBottom: 10,
      marginTop: 4,
    }}
  >
    {children}
  </Text>
);

const getInputStyle = (T, isDark) => ({
  backgroundColor: isDark ? T.surface : "#fff",
  borderWidth: 1,
  borderColor: isDark ? T.border : "#E5E7EB",
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
  color: isDark ? T.text : "#0B1324",
});

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const formatDisplayDate = (d) => {
  if (!d) return "Select date";
  try {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "Select date";
  }
};

function DateField({ label, value, onPress, required, isDark, T, inputStyle }) {
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: isDark ? T.textDim : "#374151",
          marginBottom: 8,
        }}
      >
        {label}{required ? " *" : ""}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          ...inputStyle,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Ionicons name="calendar-outline" size={18} color={isDark ? T.textDim : "#6B7280"} />
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: value ? (isDark ? T.text : "#0B1324") : isDark ? T.textMuted : "#9CA3AF",
            }}
            numberOfLines={1}
          >
            {formatDisplayDate(value)}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={isDark ? T.textMuted : "#9CA3AF"} />
      </TouchableOpacity>
    </View>
  );
}

function ChoiceChip({ active, onPress, children, style, isDark, T }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: active ? "#0B1324" : isDark ? T.surface : "#fff",
        borderWidth: 1,
        borderColor: active ? "#0B1324" : isDark ? T.border : "#E5E7EB",
        ...style,
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

export default function CreateTournamentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const sportParam = Array.isArray(params.sport) ? params.sport[0] : params.sport;
  const sport = String(sportParam || "").trim();
  const sportLabel = SPORT_LABELS[sport] || sport || "Tournament";
  const isFootball = String(sport).toLowerCase() === "football";
  const isVolleyball = isVolleyballSport(sport);
  const isBaseball = isBaseballSport(sport);
  const isBasketball = isBasketballSport(sport);
  const groupWording = usesGroupWording(sport);
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const inputStyle = getInputStyle(T, isDark);
  const pageBg = isDark ? T.bg : "#F0F4F8";
  const inactiveText = isDark ? T.textDim : "#374151";
  const cardSurface = isDark ? T.surface : "#fff";
  const cardBorder = isDark ? T.border : "#E5E7EB";

  // Sport must be chosen on pick-sport first
  useEffect(() => {
    if (!sport) {
      router.replace({
        pathname: "/tournament/pick-sport",
        params: backTo ? { backTo } : undefined,
      });
    }
  }, [sport, backTo, router]);

  const [name, setName] = useState("");
  const [season, setSeason] = useState("");
  const [format, setFormat] = useState("hybrid");
  const [matchFormat, setMatchFormat] = useState(
    isVolleyball ? "best_of_5" : isBaseball ? "baseball" : isBasketball ? "basketball" : "T20",
  );
  const [totalOvers, setTotalOvers] = useState("20");
  const [halfMinutes, setHalfMinutes] = useState("45");
  const [setPoints, setSetPoints] = useState("25");
  const [decidingSetPoints, setDecidingSetPoints] = useState("15");
  const [winByTwo, setWinByTwo] = useState(true);
  const [legs, setLegs] = useState(1);
  const [playoffTeams, setPlayoffTeams] = useState(4);
  const [divisionCount, setDivisionCount] = useState(isBaseball || isBasketball ? 4 : 3);
  const [qualifiersPerDivision, setQualifiersPerDivision] = useState(isBaseball || isBasketball ? 2 : 1);
  const [superOver, setSuperOver] = useState(true);
  const [extraTime, setExtraTime] = useState(true);
  const [penaltyShootout, setPenaltyShootout] = useState(true);
  const [thirdPlace, setThirdPlace] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pointsWin, setPointsWin] = useState(isFootball ? "3" : "2");
  const [pointsTie, setPointsTie] = useState("1");
  const [pointsNoResult, setPointsNoResult] = useState(isFootball || isVolleyball || isBaseball || isBasketball ? "0" : "1");
  const [pointsWinStraight, setPointsWinStraight] = useState(String(DEFAULT_VOLLEYBALL_POINTS.pointsWinStraight));
  const [pointsWinClose, setPointsWinClose] = useState(String(DEFAULT_VOLLEYBALL_POINTS.pointsWinClose));
  const [pointsLossClose, setPointsLossClose] = useState(String(DEFAULT_VOLLEYBALL_POINTS.pointsLossClose));
  const [pointsLossStraight, setPointsLossStraight] = useState(String(DEFAULT_VOLLEYBALL_POINTS.pointsLossStraight));
  const [scheduledInnings, setScheduledInnings] = useState("7");
  const [extraInnings, setExtraInnings] = useState("unlimited");
  const [extraInningsMax, setExtraInningsMax] = useState("2");
  const [allowPoolTies, setAllowPoolTies] = useState(true);
  const [mercyRuleEnabled, setMercyRuleEnabled] = useState(true);
  const [mercyAfter5, setMercyAfter5] = useState("10");
  const [mercyAfter7, setMercyAfter7] = useState("8");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("0");
  const [quarterMinutes, setQuarterMinutes] = useState("10");
  const [overtimeMinutes, setOvertimeMinutes] = useState("5");
  const [shotClockSeconds, setShotClockSeconds] = useState("24");
  const [submitting, setSubmitting] = useState(false);
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const d = startOfDay(new Date());
    d.setMonth(d.getMonth() + 1);
    return d;
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    if (isFootball) {
      setPointsWin("3");
      setPointsNoResult("0");
      setMatchFormat("11v11");
    } else if (isVolleyball) {
      setMatchFormat("best_of_5");
      setSetPoints("25");
      setDecidingSetPoints("15");
      setWinByTwo(true);
      setPointsWinStraight(String(DEFAULT_VOLLEYBALL_POINTS.pointsWinStraight));
      setPointsWinClose(String(DEFAULT_VOLLEYBALL_POINTS.pointsWinClose));
      setPointsLossClose(String(DEFAULT_VOLLEYBALL_POINTS.pointsLossClose));
      setPointsLossStraight(String(DEFAULT_VOLLEYBALL_POINTS.pointsLossStraight));
      setPointsNoResult(String(DEFAULT_VOLLEYBALL_POINTS.pointsNoResult));
    } else if (isBaseball) {
      setMatchFormat("baseball");
      setScheduledInnings("7");
      setExtraInnings("unlimited");
      setAllowPoolTies(true);
      setMercyRuleEnabled(true);
      setMercyAfter5(String(DEFAULT_BASEBALL_MERCY_RULES[0].leadRuns));
      setMercyAfter7(String(DEFAULT_BASEBALL_MERCY_RULES[1].leadRuns));
      setTimeLimitMinutes("0");
      setDivisionCount(4);
      setQualifiersPerDivision(2);
      setPointsNoResult("0");
    } else if (isBasketball) {
      setMatchFormat("basketball");
      setQuarterMinutes("10");
      setOvertimeMinutes("5");
      setShotClockSeconds("24");
      setDivisionCount(4);
      setQualifiersPerDivision(2);
      setPointsWin("2");
      setPointsTie("0");
      setPointsNoResult("0");
    } else {
      setPointsWin("2");
      setPointsNoResult("1");
      setMatchFormat("T20");
    }
  }, [isFootball, isVolleyball, isBaseball, isBasketball]);

  const formats = getCreateFormats(sport);
  const groupUnitPlural = divisionUnitLabel(sport, { plural: true, capitalize: true });
  const groupUnitSingular = divisionUnitLabel(sport, { plural: false, capitalize: false });
  const groupUnitSingularCap = divisionUnitLabel(sport, { plural: false, capitalize: true });
  const knockoutSteps = describeKnockoutPreviewSteps({
    sport,
    format,
    divisionCount,
    qualifiersPerDivision,
    playoffTeams,
  });
  const showKnockoutSettings = format !== "round_robin";

  const selectMatchFormat = (mf) => {
    setMatchFormat(mf.id);
    if (mf.id !== "Custom") setTotalOvers(String(mf.overs));
  };

  const selectVolleyballMatchFormat = (mf) => {
    setMatchFormat(mf.id);
  };

  const selectHalfOption = (opt) => {
    if (opt.id !== "Custom") setHalfMinutes(String(opt.minutes));
  };

  const selectFormat = (nextFormat) => {
    setFormat(nextFormat);
    if (nextFormat === "hybrid" && divisionCount === 1) {
      setDivisionCount(3);
      setQualifiersPerDivision(2);
    }
    if (nextFormat === "knockout") {
      setDivisionCount(1);
    }
  };

  const playoffConfig = buildHybridPlayoffConfig({
    format,
    divisionCount,
    qualifiersPerDivision,
    playoffTeams,
  });

  const showDivisionSetup = format !== "knockout";
  const showMultiDivQualifiers = format === "hybrid" && divisionCount > 1;
  const showSingleDivQualifiers = format === "hybrid" && divisionCount === 1;

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast("Enter a tournament name", "warning");
      return;
    }
    if (!startDate) {
      showToast("Select a start date", "warning");
      return;
    }
    if (endDate && startOfDay(endDate) < startOfDay(startDate)) {
      showToast("End date must be on or after the start date", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        sport: sport || "Cricket",
        format,
        season: season.trim() || undefined,
        startDate: startOfDay(startDate).toISOString(),
        endDate: endDate ? startOfDay(endDate).toISOString() : undefined,
        config: {
          ...(isFootball
            ? {
                halfMinutes: parseInt(halfMinutes, 10) || 45,
                matchFormat: "11v11",
                extraTime: showKnockoutSettings ? extraTime : false,
                penaltyShootout: showKnockoutSettings ? penaltyShootout : false,
                pointsWin: parseInt(pointsWin, 10) || 3,
                pointsTie: (() => {
                  const n = parseInt(pointsTie, 10);
                  return Number.isNaN(n) ? 1 : n;
                })(),
                pointsNoResult: (() => {
                  const n = parseInt(pointsNoResult, 10);
                  return Number.isNaN(n) ? 0 : n;
                })(),
                pointsLoss: 0,
              }
            : isVolleyball
              ? buildVolleyballMatchConfig({
                  matchFormat,
                  setPoints: parseInt(setPoints, 10) || 25,
                  decidingSetPoints: parseInt(decidingSetPoints, 10) || 15,
                  winByTwo,
                  pointsWinStraight: parseInt(pointsWinStraight, 10),
                  pointsWinClose: parseInt(pointsWinClose, 10),
                  pointsLossClose: parseInt(pointsLossClose, 10),
                  pointsLossStraight: parseInt(pointsLossStraight, 10),
                  pointsNoResult: parseInt(pointsNoResult, 10),
                })
              : isBaseball
                ? buildBaseballMatchConfig({
                    scheduledInnings: parseInt(scheduledInnings, 10) || 7,
                    extraInnings: showKnockoutSettings && extraInnings === "off" ? "unlimited" : extraInnings,
                    extraInningsMax: parseInt(extraInningsMax, 10) || 0,
                    allowPoolTies,
                    mercyRuleEnabled,
                    mercyRules: [
                      { afterInning: 5, leadRuns: parseInt(mercyAfter5, 10) || 10 },
                      { afterInning: 7, leadRuns: parseInt(mercyAfter7, 10) || 8 },
                    ],
                    timeLimitMinutes: parseInt(timeLimitMinutes, 10) || 0,
                  })
                : isBasketball
                  ? buildBasketballMatchConfig({
                      quarterMinutes: parseInt(quarterMinutes, 10) || 10,
                      overtimeMinutes: parseInt(overtimeMinutes, 10) || 5,
                      shotClockSeconds: parseInt(shotClockSeconds, 10) || 24,
                    })
                : {
                  totalOvers: parseInt(totalOvers, 10) || 20,
                  matchFormat,
                  superOver: showKnockoutSettings ? superOver : false,
                  pointsWin: parseInt(pointsWin, 10) || 2,
                  pointsTie: (() => {
                    const n = parseInt(pointsTie, 10);
                    return Number.isNaN(n) ? 1 : n;
                  })(),
                  pointsNoResult: (() => {
                    const n = parseInt(pointsNoResult, 10);
                    return Number.isNaN(n) ? 1 : n;
                  })(),
                  pointsLoss: 0,
                }),
          roundRobinLegs: legs,
          thirdPlace: showKnockoutSettings ? thirdPlace : false,
          ...playoffConfig,
        },
        divisionCount: format === "knockout" ? 1 : divisionCount,
      };
      const res = await createTournamentAPI(payload);
      const created = res?.data;
      showToast("Tournament created", "success");
      if (created?._id) {
        router.replace({ pathname: `/tournament/${created._id}`, params: { backTo: "/tournament", invite: "1" } });
      } else {
        router.replace("/tournament");
      }
    } catch (error) {
      showToast(error?.response?.data?.error || "Failed to create tournament", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!sport) {
    return (
      <View style={{ flex: 1, backgroundColor: pageBg }}>
        <LightOnDarkStatusBar />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      <LightOnDarkStatusBar />
      <View
        style={{
          backgroundColor: "#0B1324",
          paddingTop: insets.top,
          paddingHorizontal: 16,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() =>
            router.replace({
              pathname: "/tournament/pick-sport",
              params: backTo ? { backTo } : undefined,
            })
          }
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.1)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={20} color="white" />
        </TouchableOpacity>
        <Text style={{ color: "white", fontWeight: "900", fontSize: 19, marginLeft: 12 }}>
          New {sportLabel} Tournament
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <Field label="Tournament name" isDark={isDark} T={T}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Summer Premier League 2026"
            placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
            style={inputStyle}
          />
        </Field>

        <Field label="Season / edition (optional)" isDark={isDark} T={T}>
          <TextInput
            value={season}
            onChangeText={setSeason}
            placeholder="e.g. 2026"
            placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
            style={inputStyle}
          />
        </Field>

        <SectionTitle isDark={isDark} T={T}>SETUP</SectionTitle>

        <Field label="Tournament type" isDark={isDark} T={T}>
          {formats.map((f) => {
            const active = format === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => selectFormat(f.id)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: active ? "#0B1324" : cardSurface,
                  borderWidth: 1,
                  borderColor: active ? "#0B1324" : cardBorder,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: active ? "#fff" : isDark ? T.text : "#0B1324",
                      }}
                    >
                      {f.label}
                    </Text>
                    {f.recommended ? (
                      <View
                        style={{
                          backgroundColor: active
                            ? "#BAF072"
                            : isDark
                              ? "rgba(186,240,114,0.18)"
                              : "#E8F8D8",
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: "800",
                            color: active ? "#0B1324" : isDark ? "#BAF072" : "#0B1324",
                          }}
                        >
                          {isFootball || isVolleyball || isBasketball ? "★ RECOMMENDED" : "DEFAULT"}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color="#BAF072" />}
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    color: active ? "#CBD5E1" : T.textDim,
                    marginTop: 4,
                  }}
                >
                  {f.desc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Field>

        {showDivisionSetup && (
          <Field
            isDark={isDark}
            T={T}
            label={groupUnitPlural}
            hint={[
              describeDivisionLayout(divisionCount, 0, sport),
              divisionCountTip(divisionCount, sport),
              divisionPlayoffTip(format, divisionCount, sport),
            ].filter(Boolean).join("\n")}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {DIVISION_COUNT_OPTIONS.map((count) => {
                const active = divisionCount === count;
                return (
                  <ChoiceChip
                    key={count}
                    active={active}
                    onPress={() => setDivisionCount(count)}
                    isDark={isDark}
                    T={T}
                    style={{
                      minWidth: 44,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: active ? "#BAF072" : inactiveText, fontSize: 13 }}>
                      {count}
                    </Text>
                  </ChoiceChip>
                );
              })}
            </View>
          </Field>
        )}

        {showDivisionSetup && (
          <InfoChip
            isDark={isDark}
            T={T}
            icon="repeat-outline"
            title={
              groupWording
                ? divisionCount > 1
                  ? `${groupUnitSingularCap} format: Round Robin`
                  : "League format: Round Robin"
                : "Division format: Round Robin"
            }
            subtitle={
              format === "round_robin" && divisionCount > 1
                ? groupWording
                  ? isVolleyball
                    ? `Teams play only inside their ${groupUnitSingular}. Standings use set-based match points. Each ${groupUnitSingular} has its own champion — winners do not meet.`
                    : isBaseball
                      ? `Teams play only inside their ${groupUnitSingular}. Standings use winning percentage and run differential. Each ${groupUnitSingular} has its own champion — winners do not meet.`
                      : "Teams play only inside their group. Each group has its own champion — winners do not meet."
                  : "Each division plays only within its division. Standings use points and NRR. Division winners do not meet."
                : format === "round_robin" && divisionCount === 1
                  ? groupWording
                    ? isVolleyball
                      ? "Teams play a round-robin league. Standings use set-based match points (e.g. 3–0 win = 3 pts, 3–2 win = 2 pts)."
                      : isBaseball
                        ? "Teams play a round-robin league. Standings use winning percentage (PCT) and run differential."
                        : "Teams play a round-robin league. The team with the most points wins the championship. Standings use points and goal difference."
                    : "All teams play each other. Standings use points and NRR."
                  : format === "hybrid" && divisionCount > 1
                    ? groupWording
                      ? `Each ${groupUnitSingular} plays round-robin. After the ${groupUnitSingular} stage, generate knockout playoffs for the overall title.`
                      : "Each division plays round-robin within its division. After the league, generate playoffs so top teams from every division meet for the overall title."
                    : groupWording
                      ? isVolleyball
                        ? "Teams play round-robin. Standings use set-based match points and set difference."
                        : isBaseball
                          ? "Teams play round-robin. Standings use winning percentage (PCT) and run differential."
                          : "Teams play round-robin. Standings use points and goal difference."
                      : "Each division plays round-robin within its division. Standings use points and NRR."
            }
          />
        )}

        {showMultiDivQualifiers && (
          <Field
            isDark={isDark}
            T={T}
            label={`Teams qualifying per ${groupUnitSingular}`}
            hint={`Top ${qualifiersPerDivision} from each ${groupUnitSingular} advance (${playoffConfig.playoffTeams} teams total). Seeded automatically when you generate the knockout stage.`}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {QUALIFIERS_PER_DIVISION_OPTIONS.map((k) => {
                const active = qualifiersPerDivision === k;
                return (
                  <ChoiceChip
                    key={k}
                    active={active}
                    onPress={() => setQualifiersPerDivision(k)}
                    isDark={isDark}
                    T={T}
                    style={{ flex: 1, paddingVertical: 11, borderRadius: 12 }}
                  >
                    <Text style={{ fontWeight: "700", color: active ? "#BAF072" : inactiveText }}>Top {k}</Text>
                  </ChoiceChip>
                );
              })}
            </View>
          </Field>
        )}

        {showSingleDivQualifiers && (
          <Field label="Teams advancing to knockout" isDark={isDark} T={T}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {SINGLE_DIVISION_PLAYOFF_OPTIONS.map((k) => {
                const active = playoffTeams === k;
                return (
                  <ChoiceChip
                    key={k}
                    active={active}
                    onPress={() => setPlayoffTeams(k)}
                    isDark={isDark}
                    T={T}
                    style={{ flex: 1, paddingVertical: 11, borderRadius: 12 }}
                  >
                    <Text style={{ fontWeight: "700", color: active ? "#fff" : inactiveText }}>Top {k}</Text>
                  </ChoiceChip>
                );
              })}
            </View>
          </Field>
        )}

        {format === "hybrid" && (
          groupWording ? (
            <View
              style={{
                backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
                borderWidth: 1,
                borderColor: isDark ? T.border : "#E2E8F0",
                borderRadius: 12,
                padding: 14,
                marginBottom: 18,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: isDark ? T.textMuted : "#94A3B8",
                  letterSpacing: 0.6,
                  marginBottom: 10,
                  alignSelf: "flex-start",
                }}
              >
                KNOCKOUT PREVIEW
              </Text>
              {knockoutSteps.map((step, idx) => (
                <View key={`${step}-${idx}`} style={{ alignItems: "center", width: "100%" }}>
                  <View
                    style={{
                      backgroundColor: isDark ? T.surface : "#fff",
                      borderWidth: 1,
                      borderColor: isDark ? T.border : "#E2E8F0",
                      borderRadius: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      width: "100%",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                      {step}
                    </Text>
                  </View>
                  {idx < knockoutSteps.length - 1 ? (
                    <Text style={{ color: isDark ? T.textMuted : "#94A3B8", marginVertical: 4, fontSize: 16 }}>
                      ↓
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <InfoChip
              isDark={isDark}
              T={T}
              icon="git-network-outline"
              title="Knockout: Auto-generate"
              subtitle={describeKnockoutAutoStage(playoffConfig.playoffTeams)}
            />
          )
        )}

        <SectionTitle isDark={isDark} T={T}>MATCHES & SCHEDULE</SectionTitle>

        <Field label="Schedule" isDark={isDark} T={T}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <DateField
              label="Start date"
              value={startDate}
              required
              onPress={() => setShowStartPicker(true)}
              isDark={isDark}
              T={T}
              inputStyle={inputStyle}
            />
            <DateField
              label="End date"
              value={endDate}
              onPress={() => setShowEndPicker(true)}
              isDark={isDark}
              T={T}
              inputStyle={inputStyle}
            />
          </View>
          <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF", marginTop: 8 }}>
            When the league runs — shown on the tournament page and list.
          </Text>
          {showStartPicker ? (
            <DateTimePicker
              value={startDate || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              themeVariant={isDark ? "dark" : "light"}
              onChange={(_, d) => {
                if (Platform.OS === "android") setShowStartPicker(false);
                if (d) {
                  const next = startOfDay(d);
                  setStartDate(next);
                  if (endDate && startOfDay(endDate) < next) {
                    const adjusted = new Date(next);
                    adjusted.setMonth(adjusted.getMonth() + 1);
                    setEndDate(startOfDay(adjusted));
                  }
                }
              }}
            />
          ) : null}
          {showEndPicker ? (
            <DateTimePicker
              value={endDate || startDate || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              themeVariant={isDark ? "dark" : "light"}
              minimumDate={startDate || undefined}
              onChange={(_, d) => {
                if (Platform.OS === "android") setShowEndPicker(false);
                if (d) setEndDate(startOfDay(d));
              }}
            />
          ) : null}
          {Platform.OS === "ios" && (showStartPicker || showEndPicker) ? (
            <TouchableOpacity
              onPress={() => {
                setShowStartPicker(false);
                setShowEndPicker(false);
              }}
              style={{ marginTop: 8, alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 12 }}
            >
              <Text style={{ color: isDark ? "#BAF072" : "#0B1324", fontWeight: "700", fontSize: 14 }}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </Field>

        {isFootball ? (
          <Field label="Minutes per half" isDark={isDark} T={T}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {FOOTBALL_HALF_OPTIONS.map((opt) => {
                const active =
                  opt.id === "Custom"
                    ? !["40", "45"].includes(String(halfMinutes))
                    : String(halfMinutes) === String(opt.minutes);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => selectHalfOption(opt)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 9,
                      borderRadius: 999,
                      backgroundColor: active ? "#9AEA62" : cardSurface,
                      borderWidth: 1,
                      borderColor: active ? "#9AEA62" : cardBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        color: active ? "#0B1324" : inactiveText,
                        fontSize: 13,
                      }}
                    >
                      {opt.id === "Custom" ? "Custom" : `${opt.minutes}'`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              value={halfMinutes}
              onChangeText={setHalfMinutes}
              keyboardType="number-pad"
              style={inputStyle}
            />
          </Field>
        ) : isVolleyball ? (
          <>
            <Field
              label="Match format"
              isDark={isDark}
              T={T}
              hint={matchFormat === "best_of_3" ? "First to 2 sets wins the match." : "First to 3 sets wins the match."}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {VOLLEYBALL_MATCH_FORMATS.map((mf) => {
                  const active = matchFormat === mf.id;
                  return (
                    <TouchableOpacity
                      key={mf.id}
                      onPress={() => selectVolleyballMatchFormat(mf)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 999,
                        backgroundColor: active ? "#9AEA62" : cardSurface,
                        borderWidth: 1,
                        borderColor: active ? "#9AEA62" : cardBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "700",
                          color: active ? "#0B1324" : inactiveText,
                          fontSize: 13,
                        }}
                      >
                        {mf.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <Field label="Set format" isDark={isDark} T={T}>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginBottom: 6 }}>
                    Regular sets
                  </Text>
                  <TextInput
                    value={setPoints}
                    onChangeText={setSetPoints}
                    keyboardType="number-pad"
                    style={inputStyle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginBottom: 6 }}>
                    Deciding set
                  </Text>
                  <TextInput
                    value={decidingSetPoints}
                    onChangeText={setDecidingSetPoints}
                    keyboardType="number-pad"
                    style={inputStyle}
                  />
                </View>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: cardSurface,
                  borderWidth: 1,
                  borderColor: cardBorder,
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                    Win by 2 points
                  </Text>
                  <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginTop: 2 }}>
                    Sets continue past the target until a 2-point lead.
                  </Text>
                </View>
                <Switch value={winByTwo} onValueChange={setWinByTwo} trackColor={{ true: "#9AEA62" }} />
              </View>
            </Field>
          </>
        ) : isBasketball ? (
          <>
            <Field label="Number of quarters" isDark={isDark} T={T} hint="Games are played as 4 quarters. Overtime is added automatically when scores are level.">
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: cardSurface,
                  borderWidth: 1,
                  borderColor: cardBorder,
                }}
              >
                <Ionicons name="basketball-outline" size={16} color={isDark ? T.textDim : "#64748B"} />
                <Text style={{ fontWeight: "800", color: isDark ? T.text : "#0B1324", fontSize: 14 }}>4 quarters</Text>
              </View>
            </Field>

            <Field
              label="Quarter length (minutes)"
              isDark={isDark}
              T={T}
              hint="FIBA default is 10. Use 6–8 for youth or 12 for NBA-style community leagues."
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {BASKETBALL_QUARTER_OPTIONS.map((opt) => {
                  const active =
                    opt.id === "Custom"
                      ? !["6", "8", "10", "12"].includes(String(quarterMinutes))
                      : String(quarterMinutes) === String(opt.minutes);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        if (opt.id !== "Custom") setQuarterMinutes(String(opt.minutes));
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 999,
                        backgroundColor: active ? "#9AEA62" : cardSurface,
                        borderWidth: 1,
                        borderColor: active ? "#9AEA62" : cardBorder,
                      }}
                    >
                      <Text style={{ fontWeight: "700", color: active ? "#0B1324" : inactiveText, fontSize: 13 }}>
                        {opt.id === "Custom" ? "Custom" : `${opt.minutes}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput value={quarterMinutes} onChangeText={setQuarterMinutes} keyboardType="number-pad" style={inputStyle} />
            </Field>

            <Field label="Overtime length (minutes)" isDark={isDark} T={T}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {BASKETBALL_OVERTIME_OPTIONS.map((opt) => {
                  const active =
                    opt.id === "Custom"
                      ? !["3", "5", "10"].includes(String(overtimeMinutes))
                      : String(overtimeMinutes) === String(opt.minutes);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        if (opt.id !== "Custom") setOvertimeMinutes(String(opt.minutes));
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 999,
                        backgroundColor: active ? "#9AEA62" : cardSurface,
                        borderWidth: 1,
                        borderColor: active ? "#9AEA62" : cardBorder,
                      }}
                    >
                      <Text style={{ fontWeight: "700", color: active ? "#0B1324" : inactiveText, fontSize: 13 }}>
                        {opt.id === "Custom" ? "Custom" : `${opt.minutes}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput value={overtimeMinutes} onChangeText={setOvertimeMinutes} keyboardType="number-pad" style={inputStyle} />
            </Field>

            <Field label="Shot clock (seconds)" isDark={isDark} T={T} hint="24-second shot clock is standard in FIBA play.">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {BASKETBALL_SHOT_CLOCK_OPTIONS.map((opt) => {
                  const active =
                    opt.id === "Custom"
                      ? !["24", "30", "35"].includes(String(shotClockSeconds))
                      : String(shotClockSeconds) === String(opt.seconds);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        if (opt.id !== "Custom") setShotClockSeconds(String(opt.seconds));
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 999,
                        backgroundColor: active ? "#9AEA62" : cardSurface,
                        borderWidth: 1,
                        borderColor: active ? "#9AEA62" : cardBorder,
                      }}
                    >
                      <Text style={{ fontWeight: "700", color: active ? "#0B1324" : inactiveText, fontSize: 13 }}>
                        {opt.id === "Custom" ? "Custom" : `${opt.seconds}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput value={shotClockSeconds} onChangeText={setShotClockSeconds} keyboardType="number-pad" style={inputStyle} />
            </Field>
          </>
        ) : isBaseball ? (
          <>
            <Field
              label="Innings"
              isDark={isDark}
              T={T}
              hint="Youth and community games often use 5 or 7 innings; pro-style uses 9."
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {BASEBALL_INNINGS_OPTIONS.map((opt) => {
                  const active =
                    opt.id === "Custom"
                      ? !["5", "7", "9"].includes(String(scheduledInnings))
                      : String(scheduledInnings) === String(opt.innings);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        if (opt.id !== "Custom") setScheduledInnings(String(opt.innings));
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 999,
                        backgroundColor: active ? "#9AEA62" : cardSurface,
                        borderWidth: 1,
                        borderColor: active ? "#9AEA62" : cardBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "700",
                          color: active ? "#0B1324" : inactiveText,
                          fontSize: 13,
                        }}
                      >
                        {opt.id === "Custom" ? "Custom" : `${opt.innings}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                value={scheduledInnings}
                onChangeText={setScheduledInnings}
                keyboardType="number-pad"
                style={inputStyle}
              />
            </Field>

            <Field
              label="Extra innings"
              isDark={isDark}
              T={T}
              hint="Knockout games always need a winner — off is treated as unlimited in playoffs."
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {BASEBALL_EXTRA_INNINGS_OPTIONS.map((opt) => {
                  const active = extraInnings === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => setExtraInnings(opt.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        borderRadius: 999,
                        backgroundColor: active ? "#9AEA62" : cardSurface,
                        borderWidth: 1,
                        borderColor: active ? "#9AEA62" : cardBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "700",
                          color: active ? "#0B1324" : inactiveText,
                          fontSize: 12,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {extraInnings === "custom" ? (
                <TextInput
                  value={extraInningsMax}
                  onChangeText={setExtraInningsMax}
                  keyboardType="number-pad"
                  placeholder="Max extra innings"
                  placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                  style={inputStyle}
                />
              ) : null}
            </Field>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: cardSurface,
                borderWidth: 1,
                borderColor: cardBorder,
                borderRadius: 12,
                padding: 14,
                marginBottom: 18,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                  Allow pool ties
                </Text>
                <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginTop: 2 }}>
                  When extra innings are capped or off, pool games may end tied.
                </Text>
              </View>
              <Switch value={allowPoolTies} onValueChange={setAllowPoolTies} trackColor={{ true: "#9AEA62" }} />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: cardSurface,
                borderWidth: 1,
                borderColor: cardBorder,
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                  Run rule (mercy)
                </Text>
                <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginTop: 2 }}>
                  End early when one team leads by enough runs.
                </Text>
              </View>
              <Switch value={mercyRuleEnabled} onValueChange={setMercyRuleEnabled} trackColor={{ true: "#9AEA62" }} />
            </View>

            {mercyRuleEnabled ? (
              <Field label="Mercy thresholds" isDark={isDark} T={T}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginBottom: 6 }}>
                      After 5 innings
                    </Text>
                    <TextInput
                      value={mercyAfter5}
                      onChangeText={setMercyAfter5}
                      keyboardType="number-pad"
                      style={inputStyle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginBottom: 6 }}>
                      After 7 innings
                    </Text>
                    <TextInput
                      value={mercyAfter7}
                      onChangeText={setMercyAfter7}
                      keyboardType="number-pad"
                      style={inputStyle}
                    />
                  </View>
                </View>
              </Field>
            ) : null}

            <Field
              label="Game time limit"
              isDark={isDark}
              T={T}
              hint="Optional. No new inning starts after the limit; the current inning can finish."
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {BASEBALL_TIME_LIMIT_OPTIONS.map((opt) => {
                  const active =
                    opt.id === "Custom"
                      ? !["0", "90", "120"].includes(String(timeLimitMinutes))
                      : String(timeLimitMinutes) === String(opt.minutes);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        if (opt.id !== "Custom") setTimeLimitMinutes(String(opt.minutes));
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        borderRadius: 999,
                        backgroundColor: active ? "#9AEA62" : cardSurface,
                        borderWidth: 1,
                        borderColor: active ? "#9AEA62" : cardBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "700",
                          color: active ? "#0B1324" : inactiveText,
                          fontSize: 12,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                value={timeLimitMinutes}
                onChangeText={setTimeLimitMinutes}
                keyboardType="number-pad"
                style={inputStyle}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Match format" isDark={isDark} T={T}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {MATCH_FORMATS.map((mf) => {
                  const active = matchFormat === mf.id;
                  return (
                    <TouchableOpacity
                      key={mf.id}
                      onPress={() => selectMatchFormat(mf)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 999,
                        backgroundColor: active ? "#9AEA62" : cardSurface,
                        borderWidth: 1,
                        borderColor: active ? "#9AEA62" : cardBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "700",
                          color: active ? "#0B1324" : inactiveText,
                          fontSize: 13,
                        }}
                      >
                        {mf.id}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <Field label="Overs per innings" isDark={isDark} T={T}>
              <TextInput
                value={totalOvers}
                onChangeText={setTotalOvers}
                keyboardType="number-pad"
                editable={matchFormat === "Custom"}
                style={[
                  inputStyle,
                  matchFormat !== "Custom" && {
                    backgroundColor: isDark ? T.surfaceAlt : "#F3F4F6",
                    color: isDark ? T.textDim : "#6B7280",
                  },
                ]}
              />
            </Field>
          </>
        )}

        {format !== "knockout" && (
          <Field
            label="Round-robin legs"
            isDark={isDark}
            T={T}
            hint={legs === 2 ? "Doubles the number of matches (home & away)." : undefined}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2].map((l) => {
                const active = legs === l;
                return (
                  <ChoiceChip
                    key={l}
                    active={active}
                    onPress={() => setLegs(l)}
                    isDark={isDark}
                    T={T}
                    style={{ flex: 1, paddingVertical: 11, borderRadius: 12 }}
                  >
                    <Text style={{ fontWeight: "700", color: active ? "#fff" : inactiveText }}>
                      {l === 1 ? "Single (home only)" : "Double (home & away)"}
                    </Text>
                  </ChoiceChip>
                );
              })}
            </View>
          </Field>
        )}

        {showKnockoutSettings && isFootball && (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: cardSurface,
                borderWidth: 1,
                borderColor: cardBorder,
                borderRadius: 12,
                padding: 14,
                marginBottom: 18,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                  Extra time
                </Text>
                <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginTop: 2 }}>
                  Knockout draws go to extra time before penalties.
                </Text>
              </View>
              <Switch value={extraTime} onValueChange={setExtraTime} trackColor={{ true: "#9AEA62" }} />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: cardSurface,
                borderWidth: 1,
                borderColor: cardBorder,
                borderRadius: 12,
                padding: 14,
                marginBottom: 18,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                  Penalty shootout
                </Text>
                <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginTop: 2 }}>
                  Resolve tied knockout ties with a penalty shootout.
                </Text>
              </View>
              <Switch value={penaltyShootout} onValueChange={setPenaltyShootout} trackColor={{ true: "#9AEA62" }} />
            </View>
          </>
        )}

        {showKnockoutSettings && !isFootball && !isVolleyball && !isBaseball && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: cardSurface,
              borderWidth: 1,
              borderColor: cardBorder,
              borderRadius: 12,
              padding: 14,
              marginBottom: 18,
            }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                Super Over tiebreaker
              </Text>
              <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginTop: 2 }}>
                Tied knockout games are resolved by a Super Over instead of being drawn.
              </Text>
            </View>
            <Switch value={superOver} onValueChange={setSuperOver} trackColor={{ true: "#9AEA62" }} />
          </View>
        )}

        {showKnockoutSettings && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: cardSurface,
              borderWidth: 1,
              borderColor: cardBorder,
              borderRadius: 12,
              padding: 14,
              marginBottom: 18,
            }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                3rd place playoff
              </Text>
              <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginTop: 2 }}>
                Semifinal losers play one extra match for third place.
              </Text>
            </View>
            <Switch value={thirdPlace} onValueChange={setThirdPlace} trackColor={{ true: "#9AEA62" }} />
          </View>
        )}

        <TouchableOpacity
          onPress={() => setShowAdvanced((s) => !s)}
          style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}
        >
          <Ionicons
            name={showAdvanced ? "chevron-down" : "chevron-forward"}
            size={18}
            color={isDark ? T.text : "#0B1324"}
          />
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: isDark ? T.text : "#0B1324",
              marginLeft: 4,
            }}
          >
            Points system
          </Text>
        </TouchableOpacity>

        {showAdvanced && (
          isVolleyball ? (
            <View style={{ gap: 10, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", lineHeight: 17 }}>
                Match points by set result (configurable). Default FIVB-style: 3–0/3–1 → 3, 3–2 → 2, 2–3 → 1, 0–3/1–3 → 0.
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {[
                  { label: "Win 3–0 / 3–1", value: pointsWinStraight, set: setPointsWinStraight },
                  { label: "Win 3–2", value: pointsWinClose, set: setPointsWinClose },
                ].map((p) => (
                  <View key={p.label} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: isDark ? T.textDim : "#6B7280", marginBottom: 6 }}>{p.label}</Text>
                    <TextInput
                      value={p.value}
                      onChangeText={p.set}
                      keyboardType="number-pad"
                      style={[inputStyle, { textAlign: "center" }]}
                    />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {[
                  { label: "Lose 2–3", value: pointsLossClose, set: setPointsLossClose },
                  { label: "Lose 0–3 / 1–3", value: pointsLossStraight, set: setPointsLossStraight },
                  { label: "No result", value: pointsNoResult, set: setPointsNoResult },
                ].map((p) => (
                  <View key={p.label} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: isDark ? T.textDim : "#6B7280", marginBottom: 6 }}>{p.label}</Text>
                    <TextInput
                      value={p.value}
                      onChangeText={p.set}
                      keyboardType="number-pad"
                      style={[inputStyle, { textAlign: "center" }]}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
              {[
                { label: "Win", value: pointsWin, set: setPointsWin },
                { label: "Tie", value: pointsTie, set: setPointsTie },
                { label: "No result", value: pointsNoResult, set: setPointsNoResult },
              ].map((p) => (
                <View key={p.label} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginBottom: 6 }}>{p.label}</Text>
                  <TextInput
                    value={p.value}
                    onChangeText={p.set}
                    keyboardType="number-pad"
                    style={[inputStyle, { textAlign: "center" }]}
                  />
                </View>
              ))}
            </View>
          )
        )}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 16,
          paddingBottom: 16 + insets.bottom,
          backgroundColor: pageBg,
          borderTopWidth: 1,
          borderTopColor: isDark ? T.border : "#E5E7EB",
        }}
      >
        <TouchableOpacity
          onPress={handleCreate}
          disabled={submitting}
          style={{
            backgroundColor: "#0B1324",
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: "center",
            opacity: submitting ? 0.7 : 1,
            ...(isDark && { borderWidth: 1, borderColor: T.border }),
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Create Tournament</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

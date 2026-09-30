import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  Share,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "@/constants/typography";
import { useStreak } from "@/hooks/useStreak";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const FLAME_COLOR = require("../assets/images/streak-flame-v3.png");
const FLAME_MUTED = require("../assets/images/streak-flame-muted-v3.png");

/** Exact sizes tuned to Strava-style reference */
const S = {
  cardRadius: 20,
  cardPadX: 15,
  cardPadTop: 16,
  cardPadBottom: 18,
  title: 15,
  thisMonth: 12,
  chevron: 15,
  // Flame asset size behind number (keep text nested inside)
  flame: 72,
  weeksNum: 34,
  weeksLabel: 15,
  dot: 8,
  dotGap: 5.5,
  sheetRadius: 28,
  sheetPadX: 22,
  handleW: 36,
  handleH: 5,
  monthTitle: 19,
  sharePadX: 10,
  sharePadY: 4,
  shareIcon: 15,
  shareText: 12,
  statLabel: 12,
  statValue: 20,
  weekday: 14,
  dayNum: 15,
  dayCircle: 38,
  weekRing: 28,
  rowGap: 10,
};

function streakTheme(isDark) {
  if (isDark) {
    return {
      cardBg: "#1C1C1E",
      sheetBg: "#1C1C1E",
      text: "#FFFFFF",
      textDim: "#8E8E93",
      border: "transparent",
      pastDot: "#3A3A3C",
      todayRing: "#FFFFFF",
      futureRing: "rgba(255,255,255,0.22)",
      activeFill: "#FFFFFF",
      activeText: "#111111",
      dayCircle: "#2C2C2E",
      handle: "#3A3A3C",
      shareBorder: "rgba(255,255,255,0.2)",
      offMonth: "#48484A",
      weekRing: "rgba(255,255,255,0.28)",
    };
  }
  return {
    cardBg: "#FFFFFF",
    sheetBg: "#FFFFFF",
    text: "#111111",
    textDim: "#8E8E93",
    border: "rgba(0,0,0,0.08)",
    pastDot: "#D1D1D6",
    todayRing: "#111111",
    futureRing: "rgba(0,0,0,0.16)",
      activeFill: "#111111",
      activeText: "#FFFFFF",
      dayCircle: "#E5E5EA",
    handle: "#C7C7CC",
    shareBorder: "rgba(0,0,0,0.14)",
    offMonth: "#AEAEB2",
    weekRing: "rgba(0,0,0,0.2)",
  };
}

function MonthDots({ cells, daysMap, colors }) {
  const inMonth = cells.filter((c) => c.inMonth);
  const size = S.dot;
  const gap = S.dotGap;

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        width: 7 * (size + gap) - gap,
        rowGap: gap,
        columnGap: gap,
      }}
    >
      {inMonth.map((cell) => {
        const active = Boolean(daysMap[cell.key]);
        let bg = "transparent";
        let borderWidth = 0;
        let borderColor = "transparent";

        if (cell.isToday) {
          borderWidth = 1.5;
          borderColor = colors.todayRing;
          bg = active ? colors.activeFill : "transparent";
        } else if (cell.isFuture) {
          borderWidth = 1;
          borderColor = colors.futureRing;
        } else if (active) {
          bg = colors.activeFill;
        } else {
          bg = colors.pastDot;
        }

        return (
          <View
            key={cell.key}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: bg,
              borderWidth,
              borderColor,
            }}
          />
        );
      })}
    </View>
  );
}

function StreakSheet({
  visible,
  onClose,
  isDark,
  dayStreak,
  monthActivities,
  monthCells,
  monthTitle,
  daysMap,
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = streakTheme(isDark);

  const rows = useMemo(() => {
    const out = [];
    for (let i = 0; i < monthCells.length; i += 7) {
      out.push(monthCells.slice(i, i + 7));
    }
    return out;
  }, [monthCells]);

  // 7 day cols + 1 week-status col
  const available = width - S.sheetPadX * 2;
  const cellSize = Math.min(S.dayCircle + 6, Math.floor(available / 8));
  const circle = Math.min(S.dayCircle, cellSize - 4);
  const weekRing = Math.min(S.weekRing, circle - 8);

  const onShare = async () => {
    const daysLabel = dayStreak === 1 ? "1 Day" : `${dayStreak} Days`;
    try {
      await Share.share({
        message: `My PlayFlash streak: ${daysLabel} · ${monthActivities} activities this month. Keep moving with me on PlayFlash!`,
      });
    } catch {
      // cancelled
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: colors.sheetBg,
            borderTopLeftRadius: S.sheetRadius,
            borderTopRightRadius: S.sheetRadius,
            paddingBottom: Math.max(insets.bottom, 20),
            paddingTop: 12,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: S.handleW,
              height: S.handleH,
              borderRadius: S.handleH / 2,
              backgroundColor: colors.handle,
              marginBottom: 18,
            }}
          />

          <View
            style={{
              paddingHorizontal: S.sheetPadX,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                fontSize: S.monthTitle,
                fontWeight: "700",
                color: colors.text,
                fontFamily: fonts.bold,
                letterSpacing: -0.3,
              }}
            >
              {monthTitle}
            </Text>
            <TouchableOpacity
              onPress={onShare}
              activeOpacity={0.75}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                paddingHorizontal: S.sharePadX,
                paddingVertical: S.sharePadY,
                borderRadius: 22,
                borderWidth: 1.5,
                borderColor: colors.shareBorder,
              }}
            >
              <Ionicons
                name="share-outline"
                size={S.shareIcon}
                color={colors.textDim}
              />
              <Text
                style={{
                  fontSize: S.shareText,
                  fontWeight: "600",
                  color: colors.textDim,
                  fontFamily: fonts.semiBold,
                }}
              >
                Share
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              paddingHorizontal: S.sheetPadX,
              flexDirection: "row",
              marginBottom: 28,
              gap: 24,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: S.statLabel,
                  color: colors.textDim,
                  fontFamily: fonts.regular,
                  marginBottom: 6,
                }}
              >
                Your Streak
              </Text>
              <Text
                style={{
                  fontSize: S.statValue,
                  fontWeight: "700",
                  color: colors.text,
                  fontFamily: fonts.bold,
                  letterSpacing: -0.2,
                }}
              >
                {dayStreak} {dayStreak === 1 ? "Day" : "Days"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: S.statLabel,
                  color: colors.textDim,
                  fontFamily: fonts.regular,
                  marginBottom: 6,
                }}
              >
                Streak Activities
              </Text>
              <Text
                style={{
                  fontSize: S.statValue,
                  fontWeight: "700",
                  color: colors.text,
                  fontFamily: fonts.bold,
                  letterSpacing: -0.2,
                }}
              >
                {monthActivities}
              </Text>
            </View>
          </View>

          <View
            style={{
              paddingHorizontal: S.sheetPadX,
              flexDirection: "row",
              marginBottom: 12,
            }}
          >
            {WEEKDAYS.map((d, i) => (
              <View
                key={`${d}-${i}`}
                style={{ width: cellSize, alignItems: "center" }}
              >
                <Text
                  style={{
                    fontSize: S.weekday,
                    fontWeight: "600",
                    color: colors.text,
                    fontFamily: fonts.semiBold,
                  }}
                >
                  {d}
                </Text>
              </View>
            ))}
            <View style={{ width: cellSize }} />
          </View>

          {rows.map((row, rowIndex) => {
            const weekActive = row.some((c) => c.inMonth && daysMap[c.key]);
            return (
              <View
                key={`row-${rowIndex}`}
                style={{
                  paddingHorizontal: S.sheetPadX,
                  flexDirection: "row",
                  marginBottom: S.rowGap,
                  alignItems: "center",
                }}
              >
                {row.map((cell) => {
                  const active = Boolean(daysMap[cell.key]);

                  if (!cell.inMonth) {
                    return (
                      <View
                        key={cell.key}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: S.dayNum,
                            color: colors.offMonth,
                            fontFamily: fonts.medium,
                          }}
                        >
                          {cell.day}
                        </Text>
                      </View>
                    );
                  }

                  // Strava: all in-month days sit in filled circles;
                  // today gets a bright ring; future keeps a faint ring on top.
                  const showTodayRing = cell.isToday;
                  const showFutureRing = cell.isFuture;

                  return (
                    <View
                      key={cell.key}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={{
                          width: circle,
                          height: circle,
                          borderRadius: circle / 2,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: active
                            ? colors.activeFill
                            : colors.dayCircle,
                          borderWidth: showTodayRing
                            ? 2
                            : showFutureRing
                              ? 1.5
                              : 0,
                          borderColor: showTodayRing
                            ? colors.todayRing
                            : colors.futureRing,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: S.dayNum,
                            fontWeight: "600",
                            fontFamily: fonts.semiBold,
                            color: active ? colors.activeText : colors.text,
                          }}
                        >
                          {cell.day}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                <View
                  style={{
                    width: cellSize,
                    height: cellSize,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: weekRing,
                      height: weekRing,
                      borderRadius: weekRing / 2,
                      borderWidth: 1.5,
                      borderColor: weekActive
                        ? colors.todayRing
                        : colors.weekRing,
                      backgroundColor: weekActive
                        ? isDark
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(0,0,0,0.05)"
                        : "transparent",
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Profile streak card (above Trophy Case) + month bottom sheet.
 * Sizes match the Strava-style reference.
 */
export default function StreakCard({ isDark }) {
  const [open, setOpen] = useState(false);
  const {
    dayStreak,
    monthActivities,
    monthCells,
    monthTitle,
    daysMap,
  } = useStreak();
  const colors = streakTheme(isDark);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setOpen(true)}
        style={{
          marginTop: 28,
          backgroundColor: colors.cardBg,
          borderRadius: S.cardRadius,
          paddingHorizontal: S.cardPadX,
          paddingTop: S.cardPadTop,
          paddingBottom: S.cardPadBottom,
          borderWidth: isDark ? 0 : 1,
          borderColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontSize: S.title,
              fontWeight: "700",
              color: colors.text,
              fontFamily: fonts.bold,
            }}
          >
            Streak
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                fontSize: S.thisMonth,
                color: colors.textDim,
                fontFamily: fonts.medium,
                marginRight: 2,
              }}
            >
              This month
            </Text>
            <Ionicons
              name="chevron-forward"
              size={S.chevron}
              color={colors.textDim}
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: S.flame + S.weeksNum + 16,
          }}
        >
          {/* Left: flame above, day count below */}
          <View
            style={{
              width: "44%",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 5,
            }}
          >
            <Image
              source={dayStreak > 0 ? FLAME_COLOR : FLAME_MUTED}
              style={{
                width: S.flame,
                height: S.flame,
              }}
              resizeMode="contain"
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "center",
                flexWrap: "wrap",
                marginTop: 4,
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontSize: S.weeksNum,
                  fontWeight: "800",
                  color: colors.text,
                  fontFamily: fonts.extraBold,
                  lineHeight: S.weeksNum,
                  includeFontPadding: false,
                }}
              >
                {dayStreak}
              </Text>
              <Text
                style={{
                  fontSize: S.weeksLabel,
                  fontWeight: "700",
                  color: colors.text,
                  fontFamily: fonts.bold,
                  lineHeight: S.weeksLabel + 2,
                  includeFontPadding: false,
                }}
              >
                {dayStreak === 1 ? "Day" : "Days"}
              </Text>
            </View>
          </View>

          {/* Right: month dots */}
          <View
            style={{
              flex: 1,
              alignItems: "flex-end",
              justifyContent: "center",
              paddingLeft: 8,
            }}
          >
            <MonthDots cells={monthCells} daysMap={daysMap} colors={colors} />
          </View>
        </View>
      </TouchableOpacity>

      <StreakSheet
        visible={open}
        onClose={() => setOpen(false)}
        isDark={isDark}
        dayStreak={dayStreak}
        monthActivities={monthActivities}
        monthCells={monthCells}
        monthTitle={monthTitle}
        daysMap={daysMap}
      />
    </>
  );
}

export { recordStreakActivity } from "@/lib/streakStore";

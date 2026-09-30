import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BAR_HEIGHT = 48;
const CIRCLE = 36;
const CUTOUT = 46; // slightly larger than circle → visible gap around active orb

/**
 * High-performance curved tab bar.
 * Uses native-driven translateX only — no per-frame React/SVG updates.
 */
function CurvedBottomTabBar({
  tabs = [],
  activeKey,
  onChange,
  isDark = true,
  panelColor,
}) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const indexAnim = useRef(new Animated.Value(0)).current;
  const prevCountRef = useRef(tabs.length);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === activeKey),
  );

  const colors = useMemo(
    () =>
      isDark
        ? {
            bar: "#17171C",
            circle: "#9AEA62",
            iconActive: "#0B1324",
            iconIdle: "rgba(248,250,252,0.55)",
            labelIdle: "rgba(248,250,252,0.42)",
            cutout: panelColor || "#0A0A0C",
          }
        : {
            bar: "#FFFFFF",
            circle: "#111827",
            iconActive: "#FFFFFF",
            iconIdle: "#6B7280",
            labelIdle: "#9CA3AF",
            cutout: panelColor || "#F3F4F6",
          },
    [isDark, panelColor],
  );

  const count = Math.max(tabs.length, 1);
  const slot = width > 0 ? width / count : 0;

  // Seed / reseat when layout or tab count changes (no animation)
  useEffect(() => {
    if (width <= 0) return;
    if (prevCountRef.current !== count) {
      prevCountRef.current = count;
      indexAnim.setValue(activeIndex);
      return;
    }
    indexAnim.setValue(activeIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, count]);

  // Smooth native spring when the active tab changes
  useEffect(() => {
    if (width <= 0) return;
    Animated.spring(indexAnim, {
      toValue: activeIndex,
      friction: 9,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, indexAnim, width]);

  const circleTranslateX =
    width > 0
      ? indexAnim.interpolate({
          inputRange: tabs.map((_, i) => i),
          outputRange: tabs.map(
            (_, i) => slot * i + slot / 2 - CIRCLE / 2,
          ),
        })
      : 0;

  const cutoutTranslateX =
    width > 0
      ? indexAnim.interpolate({
          inputRange: tabs.map((_, i) => i),
          outputRange: tabs.map(
            (_, i) => slot * i + slot / 2 - CUTOUT / 2,
          ),
        })
      : 0;

  return (
    <View
      style={{
        paddingTop: 2,
        paddingBottom: Math.max(6, insets.bottom),
        backgroundColor: colors.cutout,
      }}
    >
      <View
        style={{ height: BAR_HEIGHT + 16 }}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - width) > 0.5) setWidth(w);
        }}
      >
        {width > 0 ? (
          <>
            {/* Solid bar */}
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: BAR_HEIGHT,
                backgroundColor: colors.bar,
                borderTopWidth: isDark ? 0 : 1,
                borderTopColor: "#E5E7EB",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: isDark ? 0 : 0.06,
                shadowRadius: 4,
                elevation: isDark ? 0 : 3,
              }}
            />

            {/* Moving cutout disc — same color as page bg, creates the U-gap */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: CUTOUT,
                height: CUTOUT,
                borderRadius: CUTOUT / 2,
                backgroundColor: colors.cutout,
                transform: [{ translateX: cutoutTranslateX }],
                zIndex: 1,
              }}
            />

            {/* Active floating circle */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: (CUTOUT - CIRCLE) / 2,
                left: 0,
                width: CIRCLE,
                height: CIRCLE,
                borderRadius: CIRCLE / 2,
                backgroundColor: colors.circle,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ translateX: circleTranslateX }],
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 6,
                zIndex: 3,
              }}
            >
              <Ionicons
                name={tabs[activeIndex]?.icon || "ellipse"}
                size={17}
                color={colors.iconActive}
              />
            </Animated.View>

            {/* Hit targets */}
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: BAR_HEIGHT,
                flexDirection: "row",
                zIndex: 2,
              }}
            >
              {tabs.map((tab, index) => {
                const active = index === activeIndex;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => {
                      if (tab.key === activeKey) return;
                      onChange?.(tab.key);
                    }}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "flex-end",
                      paddingBottom: 7,
                    }}
                  >
                    {!active ? (
                      <>
                        <Ionicons
                          name={tab.icon}
                          size={16}
                          color={colors.iconIdle}
                        />
                        {tab.label ? (
                          <Text
                            style={{
                              marginTop: 1,
                              fontSize: 7,
                              fontWeight: "800",
                              letterSpacing: 0.2,
                              textTransform: "uppercase",
                              color: colors.labelIdle,
                            }}
                            numberOfLines={1}
                          >
                            {tab.label}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <View style={{ height: 22 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

export default memo(CurvedBottomTabBar);

import React, { useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Path } from "react-native-svg";

const TRACK_H = 64;
const THUMB = 52;
const PAD = 6;
const COMPLETE_RATIO = 0.86;

function clamp(v, min, max) {
  "worklet";
  return Math.min(max, Math.max(min, v));
}

function TennisBallIcon({ size = 28, color = "#2563EB" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx="16" cy="16" r="14" fill={color} />
      <Path
        d="M6 10 C12 12, 12 20, 6 22"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M26 10 C20 12, 20 20, 26 22"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function useChevronWave(delayMs) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }),
          withTiming(0.28, { duration: 520, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [v, delayMs]);
  return v;
}

/**
 * Slide-to-unlock CTA — drag the ball right to confirm.
 */
export default function SlideToGetStarted({
  label = "Get Started",
  onComplete,
  trackColor = "#9AEA62",
  labelColor = "#0B1324",
  thumbIconColor = "#0B1324",
}) {
  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  const done = useSharedValue(false);
  const maxX = useSharedValue(0);
  const c1 = useChevronWave(0);
  const c2 = useChevronWave(140);
  const c3 = useChevronWave(280);

  const finish = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onComplete?.();
  }, [onComplete]);

  const onLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    maxX.value = Math.max(0, w - THUMB - PAD * 2);
  };

  const pan = Gesture.Pan()
    .activeOffsetX(4)
    .failOffsetY([-18, 18])
    .onBegin(() => {
      cancelAnimation(x);
      startX.value = clamp(x.value, 0, maxX.value);
    })
    .onUpdate((e) => {
      if (done.value) return;
      x.value = clamp(startX.value + e.translationX, 0, maxX.value);
    })
    .onEnd(() => {
      if (done.value) return;
      const limit = maxX.value;
      if (limit > 0 && x.value / limit >= COMPLETE_RATIO) {
        done.value = true;
        x.value = withTiming(limit, { duration: 160 });
        runOnJS(finish)();
      } else {
        x.value = withTiming(0, { duration: 180 });
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: clamp(x.value, 0, maxX.value || 0) }],
  }));

  const labelStyle = useAnimatedStyle(() => {
    const limit = maxX.value || 1;
    const pos = clamp(x.value, 0, limit);
    return {
      opacity: interpolate(
        pos,
        [0, limit * 0.55, limit],
        [1, 0.35, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  const groupStyle = useAnimatedStyle(() => {
    const limit = maxX.value || 1;
    const pos = clamp(x.value, 0, limit);
    return {
      opacity: interpolate(pos, [0, limit * 0.45, limit], [1, 0.2, 0], Extrapolation.CLAMP),
    };
  });

  const a1 = useAnimatedStyle(() => ({ opacity: 0.25 + c1.value * 0.75 }));
  const a2 = useAnimatedStyle(() => ({ opacity: 0.25 + c2.value * 0.75 }));
  const a3 = useAnimatedStyle(() => ({ opacity: 0.25 + c3.value * 0.75 }));

  return (
    <View
      onLayout={onLayout}
      style={[styles.track, { backgroundColor: trackColor }]}
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}. Slide right to continue`}
    >
      <Animated.Text style={[styles.label, { color: labelColor }, labelStyle]}>
        {label}
      </Animated.Text>

      <Animated.View style={[styles.chevrons, groupStyle]} pointerEvents="none">
        <Animated.View style={a1}>
          <Ionicons name="chevron-forward" size={17} color={labelColor} />
        </Animated.View>
        <Animated.View style={[a2, { marginLeft: -9 }]}>
          <Ionicons name="chevron-forward" size={17} color={labelColor} />
        </Animated.View>
        <Animated.View style={[a3, { marginLeft: -9 }]}>
          <Ionicons name="chevron-forward" size={17} color={labelColor} />
        </Animated.View>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <TennisBallIcon size={28} color={thumbIconColor} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  label: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  chevrons: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  thumb: {
    position: "absolute",
    left: PAD,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});

import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import AnimatedEmoji from "./AnimatedEmoji";

/**
 * Floating reaction burst animation.
 * centered=true — middle of parent (e.g. on a gallery image or message bubble).
 * centered=false — legacy corner placement (align left/right).
 */
export default function ReactionBurstOverlay({
  reactionKey,
  onDone,
  align = "right",
  centered = false,
  size = 72,
}) {
  const scale = useSharedValue(0.2);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 100 });
    scale.value = withSpring(1, { damping: 7, stiffness: 220 });
    translateY.value = withSpring(centered ? 0 : -8, { damping: 10, stiffness: 180 });

    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(centered ? -16 : -24, { duration: 200 });
      scale.value = withTiming(1.15, { duration: 200 });
      setTimeout(() => onDone?.(), 220);
    }, 850);

    return () => clearTimeout(timer);
  }, [scale, opacity, translateY, onDone, centered]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const wrapStyle = centered
    ? styles.wrapCenter
    : [styles.wrap, align === "left" ? styles.wrapLeft : styles.wrapRight];

  return (
    <View style={wrapStyle} pointerEvents="none">
      <Animated.View style={animStyle}>
        <AnimatedEmoji reactionKey={reactionKey} size={size} loop playEntry />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  wrap: {
    position: "absolute",
    top: -44,
    zIndex: 30,
  },
  wrapRight: {
    right: 4,
  },
  wrapLeft: {
    left: 4,
  },
});

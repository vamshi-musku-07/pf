import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { getAnimatedEmojiUri, getReactionByKey } from "@/constants/messageReactions";

/**
 * Renders Google Noto animated emoji (WebP) — same idea as Telegram animated reactions.
 */
export default function AnimatedEmoji({
  reactionKey,
  codepoint: codepointProp,
  emoji: emojiFallback,
  size = 32,
  loop = true,
  playEntry = false,
}) {
  const meta = reactionKey ? getReactionByKey(reactionKey) : null;
  const codepoint = codepointProp || meta?.codepoint;
  const fallback = emojiFallback || meta?.emoji || "❓";
  const uri = codepoint ? getAnimatedEmojiUri(codepoint) : null;

  const scale = useSharedValue(playEntry ? 0.3 : 1);
  const bounce = useSharedValue(0);

  useEffect(() => {
    if (playEntry) {
      scale.value = withSpring(1, { damping: 8, stiffness: 280 });
    }
    if (loop) {
      bounce.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 700 }),
          withTiming(0, { duration: 700 }),
        ),
        -1,
        true,
      );
    }
  }, [playEntry, loop, scale, bounce]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * (loop ? 0.92 + bounce.value * 0.08 : 1) },
    ],
  }));

  if (!uri) {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <Text style={{ fontSize: size * 0.72 }}>{fallback}</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.box, { width: size, height: size }, animStyle]}>
      <Image
        source={{ uri }}
        style={{ width: size, height: size }}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={codepoint}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
  },
});

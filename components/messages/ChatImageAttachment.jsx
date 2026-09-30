import { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

const SIZE = { width: 220, height: 165 };

/**
 * Chat bubble image/GIF — no solid placeholder bg; skeleton while loading.
 * Tap opens lightbox via onPress.
 */
export default function ChatImageAttachment({
  uri,
  variant = "incoming",
  isDark = false,
  onPress,
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const pulse = useRef(new Animated.Value(0.35)).current;

  const isOutgoing = variant === "outgoing";
  const iconColor = isOutgoing
    ? "#9AEA62"
    : isDark
      ? "#A1A1AA"
      : "#6B7280";
  const labelColor = isOutgoing
    ? "rgba(255,255,255,0.7)"
    : isDark
      ? "#A1A1AA"
      : "#6B7280";
  const skeletonColor = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(0,0,0,0.06)";

  useEffect(() => {
    if (!loading) return undefined;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [loading, pulse]);

  const content = (() => {
    if (!uri) {
      return (
        <View style={[styles.wrap, SIZE]}>
          <Ionicons name="image-outline" size={28} color={iconColor} />
          <Text style={[styles.failLabel, { color: labelColor }]}>
            Image unavailable
          </Text>
        </View>
      );
    }

    if (failed) {
      return (
        <View style={[styles.wrap, SIZE]}>
          <Ionicons name="image-outline" size={28} color={iconColor} />
          <Text style={[styles.failLabel, { color: labelColor }]}>
            Couldn't load image
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.wrap, SIZE]}>
        {loading ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: skeletonColor, opacity: pulse, borderRadius: 12 },
            ]}
          />
        ) : null}
        <ExpoImage
          recyclingKey={uri}
          source={{ uri }}
          style={[SIZE, styles.image, loading ? { opacity: 0 } : { opacity: 1 }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onLoadStart={() => {
            setLoading(true);
            setFailed(false);
          }}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      </View>
    );
  })();

  if (onPress && uri && !failed) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    borderRadius: 12,
  },
  failLabel: {
    marginTop: 6,
    fontSize: 12,
  },
});

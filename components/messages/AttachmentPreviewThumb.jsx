import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

const PREVIEW_SIZE = 60;

/**
 * Composer attachment thumb with skeleton until media is ready.
 * No solid background behind image / gif / video.
 */
export default function AttachmentPreviewThumb({
  attachment,
  onRemove,
  isDark = false,
}) {
  const [ready, setReady] = useState(false);
  const pulse = useRef(new Animated.Value(0.35)).current;
  const isVideo = attachment?.type === "video";
  const isAudio = attachment?.type === "audio" || attachment?.type === "voice";
  const uri = attachment?.uri;
  const skeletonColor = isDark ? "#2A2A2E" : "#E5E7EB";

  useEffect(() => {
    setReady(false);
  }, [uri]);

  useEffect(() => {
    if (ready || isAudio) return undefined;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [ready, isAudio, pulse]);

  // Audio has no visual load — mark ready immediately
  useEffect(() => {
    if (isAudio) setReady(true);
  }, [isAudio]);

  // Videos often don't fire Image onLoad; fall back after a short wait
  useEffect(() => {
    if (!isVideo || ready) return undefined;
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, [isVideo, ready, uri]);

  return (
    <View style={styles.wrap}>
      <View style={styles.thumb}>
        {!ready && !isAudio ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: skeletonColor,
                opacity: pulse,
                borderRadius: 10,
              },
            ]}
          />
        ) : null}

        {isAudio ? (
          <View style={styles.audioFallback}>
            <Ionicons name="mic" size={24} color="#9AEA62" />
          </View>
        ) : (
          <ExpoImage
            source={{ uri }}
            style={[
              styles.image,
              !ready ? { opacity: 0 } : { opacity: 1 },
            ]}
            contentFit="cover"
            cachePolicy="memory-disk"
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
          />
        )}

        {isVideo && ready ? (
          <View style={styles.playBadge} pointerEvents="none">
            <Ionicons name="play" size={14} color="#fff" />
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={onRemove}
        style={styles.removeBtn}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="close" size={12} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  thumb: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: 10,
  },
  audioFallback: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  playBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

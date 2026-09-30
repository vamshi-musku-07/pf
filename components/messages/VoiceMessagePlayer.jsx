import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AudioModule, createAudioPlayer } from "expo-audio";

let activePlayer = null;
let activeSetPlaying = null;

function stopActivePlayer() {
  if (activePlayer) {
    try {
      activePlayer.pause();
      activePlayer.remove();
    } catch {
      // ignore cleanup errors
    }
    activePlayer = null;
  }
  if (activeSetPlaying) {
    activeSetPlaying(false);
    activeSetPlaying = null;
  }
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Tap-to-play voice message bubble (WhatsApp-style play button + duration).
 */
export default function VoiceMessagePlayer({ uri, variant = "incoming", isDark = false }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const playerRef = useRef(null);
  const listenerRef = useRef(null);

  const isOutgoing = variant === "outgoing";
  const iconColor = isOutgoing
    ? "#9AEA62"
    : isDark
      ? "#F5F5F7"
      : "#081126";
  const textColor = isOutgoing
    ? "rgba(255,255,255,0.85)"
    : isDark
      ? "#A1A1AA"
      : "#374151";
  const trackBg = isOutgoing
    ? "rgba(255,255,255,0.2)"
    : isDark
      ? "rgba(255,255,255,0.12)"
      : "rgba(0,0,0,0.12)";
  const fillBg = isOutgoing ? "#9AEA62" : isDark ? "#9AEA62" : "#081126";
  const btnBg = isOutgoing
    ? "rgba(255,255,255,0.15)"
    : isDark
      ? "rgba(255,255,255,0.06)"
      : "rgba(8,17,38,0.08)";
  const playBtnBg = isOutgoing
    ? "rgba(154,234,98,0.2)"
    : isDark
      ? "rgba(255,255,255,0.1)"
      : "rgba(8,17,38,0.1)";

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const timeLabel = playing || position > 0
    ? formatDuration(position)
    : duration > 0
      ? formatDuration(duration)
      : "0:00";

  const cleanupPlayer = useCallback(() => {
    listenerRef.current?.remove?.();
    listenerRef.current = null;
    playerRef.current?.remove?.();
    playerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (playerRef.current === activePlayer) {
        stopActivePlayer();
      }
      cleanupPlayer();
    };
  }, [cleanupPlayer]);

  const togglePlay = async () => {
    if (!uri) {
      Alert.alert("Voice message", "Audio file is not available.");
      return;
    }

    if (playing && playerRef.current) {
      playerRef.current.pause();
      setPlaying(false);
      if (activePlayer === playerRef.current) {
        activePlayer = null;
        activeSetPlaying = null;
      }
      return;
    }

    try {
      setLoading(true);
      stopActivePlayer();

      await AudioModule.setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });

      if (!playerRef.current) {
        const player = createAudioPlayer({ uri });
        playerRef.current = player;

        listenerRef.current = player.addListener("playbackStatusUpdate", (status) => {
          const dur =
            status.duration ??
            (status.durationMillis != null ? status.durationMillis / 1000 : 0);
          const pos =
            status.currentTime ??
            (status.positionMillis != null ? status.positionMillis / 1000 : 0);
          if (dur > 0) setDuration(dur);
          setPosition(pos);

          if (status.didJustFinish || (!status.playing && pos > 0 && dur > 0 && pos >= dur - 0.05)) {
            setPlaying(false);
            setPosition(0);
            if (activePlayer === player) {
              activePlayer = null;
              activeSetPlaying = null;
            }
          }
        });
      } else {
        playerRef.current.seekTo(0);
      }

      activePlayer = playerRef.current;
      activeSetPlaying = setPlaying;
      playerRef.current.play();
      setPlaying(true);
    } catch (err) {
      Alert.alert("Voice message", err?.message || "Could not play this recording.");
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={togglePlay}
      style={[styles.row, { backgroundColor: btnBg }]}
    >
      <View style={[styles.playBtn, { backgroundColor: playBtnBg }]}>
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Ionicons name={playing ? "pause" : "play"} size={22} color={iconColor} />
        )}
      </View>

      <View style={styles.body}>
        <View style={[styles.track, { backgroundColor: trackBg }]}>
          <View style={[styles.fill, { backgroundColor: fillBg, width: `${Math.max(progress * 100, playing ? 8 : 0)}%` }]} />
        </View>
        <Text style={[styles.time, { color: textColor }]}>{timeLabel}</Text>
      </View>

      <Ionicons name="mic" size={16} color={iconColor} style={styles.mic} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minWidth: 200,
    maxWidth: 260,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
  time: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  mic: {
    marginLeft: 8,
    opacity: 0.7,
  },
});

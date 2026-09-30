import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Full-screen image lightbox */
export function ImageViewerModal({ uri, onClose }) {
  const insets = useSafeAreaInsets();
  if (!uri) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)" }}>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            position: "absolute",
            top: insets.top + 10,
            right: 16,
            zIndex: 2,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.14)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 8,
            paddingHorizontal: 12,
          }}
        >
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/** Full-screen video player with controls */
export function VideoPlayerModal({ uri, onClose }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const insets = useSafeAreaInsets();

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const controlsTimer = useRef(null);
  const seekBarWidth = useRef(1);

  const player = useVideoPlayer(uri || "", (p) => {
    if (uri) {
      p.loop = false;
      p.play();
    }
  });

  useEffect(() => {
    if (!uri) return undefined;
    const playing = player.addListener("playingChange", ({ isPlaying: p }) =>
      setIsPlaying(p),
    );
    const time = player.addListener("timeUpdate", ({ currentTime: t }) =>
      setCurrentTime(t),
    );
    const status = player.addListener("statusChange", ({ status: s }) => {
      setIsBuffering(s === "loading");
      if (s === "readyToPlay") setDuration(player.duration ?? 0);
    });
    return () => {
      playing.remove();
      time.remove();
      status.remove();
    };
  }, [player, uri]);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [resetControlsTimer]);

  const togglePlayPause = () => {
    if (isPlaying) player.pause();
    else player.play();
    resetControlsTimer();
  };

  const toggleMute = () => {
    player.muted = !isMuted;
    setIsMuted(!isMuted);
    resetControlsTimer();
  };

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      await ScreenOrientation.unlockAsync();
      setIsFullscreen(false);
    } else {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE,
      );
      setIsFullscreen(true);
    }
    resetControlsTimer();
  };

  const handleClose = async () => {
    try {
      player.pause();
    } catch {
      // ignore
    }
    await ScreenOrientation.unlockAsync().catch(() => {});
    onClose();
  };

  const handleSeek = (evt) => {
    if (!duration) return;
    const x = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / seekBarWidth.current));
    player.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
    resetControlsTimer();
  };

  if (!uri) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const videoStyle = isLandscape
    ? { flex: 1 }
    : { width: "100%", aspectRatio: 16 / 9 };

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center" }}>
        <TouchableOpacity
          activeOpacity={1}
          style={isLandscape ? { flex: 1 } : {}}
          onPress={() => {
            setShowControls((v) => !v);
            resetControlsTimer();
          }}
        >
          <VideoView
            player={player}
            style={videoStyle}
            contentFit="contain"
            nativeControls={false}
          />
          {isBuffering ? (
            <View style={styles.bufferOverlay}>
              <ActivityIndicator size="large" color="white" />
            </View>
          ) : null}
        </TouchableOpacity>

        {showControls ? (
          <View
            style={[StyleSheet.absoluteFill, { justifyContent: "space-between" }]}
            pointerEvents="box-none"
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                paddingHorizontal: 16,
                paddingTop: Math.max(insets.top, 48),
                paddingBottom: 12,
              }}
            >
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={togglePlayPause}
              style={styles.centerPlay}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={28}
                color="white"
                style={isPlaying ? undefined : { marginLeft: 4 }}
              />
            </TouchableOpacity>

            <View
              style={{
                paddingHorizontal: 16,
                paddingBottom: isLandscape ? 24 : Math.max(insets.bottom, 36),
              }}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={handleSeek}
                onLayout={(e) => {
                  seekBarWidth.current = e.nativeEvent.layout.width;
                }}
                style={{ height: 28, justifyContent: "center", marginBottom: 6 }}
              >
                <View
                  style={{
                    height: 4,
                    backgroundColor: "rgba(255,255,255,0.25)",
                    borderRadius: 2,
                  }}
                >
                  <View
                    style={{
                      height: 4,
                      width: `${progress * 100}%`,
                      backgroundColor: "#9AEA62",
                      borderRadius: 2,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: -5,
                      left: `${progress * 100}%`,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: "#fff",
                      marginLeft: -7,
                    }}
                  />
                </View>
              </TouchableOpacity>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
                >
                  <TouchableOpacity
                    onPress={togglePlayPause}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={isPlaying ? "pause" : "play"}
                      size={22}
                      color="white"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={toggleMute}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={isMuted ? "volume-mute" : "volume-high"}
                      size={20}
                      color="white"
                    />
                  </TouchableOpacity>
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" }}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={toggleFullscreen}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={isFullscreen ? "contract" : "expand"}
                    size={22}
                    color="white"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerPlay: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
});

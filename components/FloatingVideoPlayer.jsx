import { useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLiveStream } from "@/context/LiveStreamContext";

// Lazy-load Agora to avoid crash when native module isn't linked
let _agora = null;
function getAgora() {
  if (!_agora) _agora = require("react-native-agora");
  return _agora;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const PIP_W = 160;
const PIP_H = 100;
const EDGE_MARGIN = 12;

export default function FloatingVideoPlayer() {
  const { streamState, maximize, endStream } = useLiveStream();

  const pan = useRef(
    new Animated.ValueXY({
      x: SCREEN_W - PIP_W - EDGE_MARGIN,
      y: SCREEN_H - PIP_H - 100,
    }),
  ).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: (_, g) => {
        pan.flattenOffset();
        // Snap to nearest horizontal edge
        const curX = pan.x._value;
        const snapX =
          curX + PIP_W / 2 < SCREEN_W / 2
            ? EDGE_MARGIN
            : SCREEN_W - PIP_W - EDGE_MARGIN;
        // Clamp Y
        const snapY = Math.max(
          EDGE_MARGIN + 40,
          Math.min(SCREEN_H - PIP_H - EDGE_MARGIN - 80, pan.y._value),
        );
        Animated.spring(pan, {
          toValue: { x: snapX, y: snapY },
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    }),
  ).current;

  const handleTap = useCallback(() => {
    maximize();
  }, [maximize]);

  const handleClose = useCallback(() => {
    endStream();
  }, [endStream]);

  if (!streamState || !streamState.isMinimized) return null;

  const { RtcSurfaceView, VideoSourceType } = getAgora();
  const isBroadcaster = streamState.mode === "broadcaster";

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: "absolute",
        zIndex: 9999,
        elevation: 9999,
        width: PIP_W,
        height: PIP_H,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#000",
        borderWidth: 2,
        borderColor: "rgba(239,68,68,0.6)",
        transform: pan.getTranslateTransform(),
        ...Platform.select({
          ios: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
          },
        }),
      }}
    >
      {/* Video surface */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleTap}
        style={{ flex: 1 }}
      >
        {isBroadcaster ? (
          <RtcSurfaceView
            canvas={{
              uid: 0,
              sourceType: VideoSourceType.VideoSourceCamera,
            }}
            style={{ flex: 1 }}
            zOrderMediaOverlay
          />
        ) : streamState.remoteUid != null ? (
          <RtcSurfaceView
            canvas={{ uid: streamState.remoteUid }}
            style={{ flex: 1 }}
            zOrderMediaOverlay
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#111",
            }}
          >
            <Text style={{ color: "#6B7280", fontSize: 10 }}>
              Waiting…
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* LIVE badge */}
      <View
        style={{
          position: "absolute",
          top: 4,
          left: 4,
          backgroundColor: "#EF4444",
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 8,
            fontWeight: "900",
            letterSpacing: 1,
          }}
        >
          LIVE
        </Text>
      </View>

      {/* Close button */}
      <TouchableOpacity
        onPress={handleClose}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: "rgba(0,0,0,0.7)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="close" size={12} color="#fff" />
      </TouchableOpacity>

      {/* Tap to expand hint */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
          paddingVertical: 3,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#9CA3AF", fontSize: 8, fontWeight: "700" }}>
          Tap to expand
        </Text>
      </View>
    </Animated.View>
  );
}

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

function LightboxVideo({ url }) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(url || "", (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    if (!url) return undefined;
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") setReady(true);
    });
    return () => sub.remove();
  }, [player, url]);

  return (
    <View style={{ width: SCREEN_W, height: SCREEN_H * 0.72, justifyContent: "center" }}>
      {!ready ? (
        <ActivityIndicator
          color="#9AEA62"
          style={{ position: "absolute", alignSelf: "center" }}
        />
      ) : null}
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}

/**
 * Full-screen popup for post image/video.
 * item: { url, type?: 'image'|'video' } | null
 */
export default function MediaLightbox({ visible, item, onClose }) {
  const insets = useSafeAreaInsets();
  const isVideo =
    item?.type === "video" ||
    String(item?.mimeType || "").toLowerCase().startsWith("video/") ||
    /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i.test(String(item?.url || ""));

  return (
    <Modal
      visible={visible && Boolean(item?.url)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)" }}>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={12}
          style={{
            position: "absolute",
            top: insets.top + 10,
            right: 16,
            zIndex: 10,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.14)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
          }}
        >
          {item?.url ? (
            isVideo ? (
              <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation?.()}>
                <LightboxVideo url={item.url} />
              </TouchableOpacity>
            ) : (
              <Image
                source={{ uri: item.url }}
                style={{ width: SCREEN_W, height: SCREEN_H * 0.78 }}
                contentFit="contain"
              />
            )
          ) : null}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

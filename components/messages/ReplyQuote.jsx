import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { normalizeReplyPreview } from "@/lib/messageReplyPreview";

/**
 * WhatsApp-style quoted reply block (text, emoji, GIF thumbnail, photo, etc.)
 * variant: "incoming" | "outgoing" | "composer"
 */
export default function ReplyQuote({ reply, variant = "incoming", compact = false, isDark = false }) {
  const preview = normalizeReplyPreview(reply);
  if (!preview) return null;

  const isOutgoing = variant === "outgoing";
  const isComposer = variant === "composer";

  const nameColor = isOutgoing
    ? "#9AEA62"
    : isDark
      ? "#F5F5F7"
      : "#081126";
  const textColor = isOutgoing
    ? "rgba(255,255,255,0.75)"
    : isDark
      ? "#A1A1AA"
      : "#6B7280";
  const boxBg = isOutgoing
    ? "rgba(255,255,255,0.12)"
    : isComposer
      ? "transparent"
      : isDark
        ? "rgba(255,255,255,0.06)"
        : "#f0f4f8";
  const borderColor = "#9AEA62";
  const mutedIcon = isOutgoing ? "#fff" : isDark ? "#A1A1AA" : "#6B7280";

  const showThumb =
    (preview.previewKind === "gif" || preview.previewKind === "image") &&
    preview.previewUrl;

  const hasCaption = !!(preview.message || "").trim();
  const showLabelText =
    !showThumb ||
    hasCaption ||
    (preview.previewKind !== "gif" && preview.previewKind !== "image");

  const thumbSize = compact ? 36 : 44;

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: boxBg, borderLeftColor: borderColor },
        compact && styles.boxCompact,
      ]}
    >
      {!compact ? (
        <Text style={[styles.name, { color: nameColor }]} numberOfLines={1}>
          {preview.senderName}
        </Text>
      ) : null}
      <View style={styles.row}>
        {showThumb ? (
          <ExpoImage
            source={{ uri: preview.previewUrl, width: thumbSize, height: thumbSize }}
            style={[
              styles.thumb,
              {
                width: thumbSize,
                height: thumbSize,
                backgroundColor: isDark ? "#2A2A2E" : "#E5E7EB",
              },
            ]}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : preview.previewKind === "video" ? (
          <View
            style={[
              styles.iconThumb,
              {
                width: thumbSize,
                height: thumbSize,
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <Ionicons name="videocam" size={18} color={mutedIcon} />
          </View>
        ) : preview.previewKind === "audio" ? (
          <View
            style={[
              styles.iconThumb,
              {
                width: thumbSize,
                height: thumbSize,
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <Ionicons name="mic" size={18} color={mutedIcon} />
          </View>
        ) : preview.previewKind === "gif" && !preview.previewUrl ? (
          <View
            style={[
              styles.iconThumb,
              {
                width: thumbSize,
                height: thumbSize,
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <Text style={[styles.gifBadge, isDark ? { color: "#A1A1AA" } : null]}>GIF</Text>
          </View>
        ) : null}
        {showLabelText ? (
          <Text
            style={[styles.body, { color: textColor }]}
            numberOfLines={compact ? 1 : 2}
          >
            {preview.previewLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  boxCompact: {
    marginBottom: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderLeftWidth: 0,
  },
  name: {
    fontWeight: "700",
    fontSize: 11,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  thumb: {
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
  iconThumb: {
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  gifBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B7280",
  },
  body: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});

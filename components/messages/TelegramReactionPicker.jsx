import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MESSAGE_REACTIONS } from "@/constants/messageReactions";
import AnimatedEmoji from "./AnimatedEmoji";

/**
 * Telegram-style horizontal animated emoji reaction bar.
 */
export default function TelegramReactionPicker({ visible, onClose, onSelect, onMore, isDark = false }) {
  const insets = useSafeAreaInsets();

  const handleSelect = (key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSelect?.(key);
    onClose?.();
  };

  const barBg = isDark ? "#1E1E24" : "rgba(255,255,255,0.98)";
  const borderColor = isDark ? "#2A2A2E" : "rgba(0,0,0,0.06)";
  const moreBg = isDark ? "#16161A" : "#F3F4F6";
  const iconColor = isDark ? "#A1A1AA" : "#6B7280";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.backdrop, isDark && { backgroundColor: "rgba(0,0,0,0.45)" }]}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.anchor, { bottom: Math.max(insets.bottom, 24) + 72 }]}>
        <View style={[styles.bar, { backgroundColor: barBg, borderColor }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {MESSAGE_REACTIONS.map((reaction) => (
              <TouchableOpacity
                key={reaction.key}
                style={styles.emojiBtn}
                activeOpacity={0.75}
                onPress={() => handleSelect(reaction.key)}
              >
                <AnimatedEmoji reactionKey={reaction.key} size={40} loop playEntry={false} />
              </TouchableOpacity>
            ))}
            {onMore ? (
              <TouchableOpacity
                style={[styles.moreBtn, { backgroundColor: moreBg }]}
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onClose?.();
                  onMore();
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={iconColor} />
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
        <View style={[styles.tail, { backgroundColor: barBg, borderColor }]} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  anchor: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  bar: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 28,
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    maxWidth: "100%",
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    gap: 2,
  },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  moreBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    backgroundColor: "#F3F4F6",
  },
  tail: {
    width: 14,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.98)",
    transform: [{ rotate: "45deg" }],
    marginTop: -8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
});

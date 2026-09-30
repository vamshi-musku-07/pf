import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { ROLE_BADGES } from "@/lib/roleBadges";

const COLS = 3;
const H_PAD = 20;
const GAP = 18;
const CELL = (Dimensions.get("window").width - H_PAD * 2 - GAP * (COLS - 1)) / COLS;

/**
 * Clean sticker picker — no boxed cards. Tap a badge to wear it on your avatar.
 */
export default function RoleBadgesSheet({
  visible,
  selectedIds = [],
  onClose,
  onSave,
}) {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const selectedId = selectedIds?.[0] || null;
  const [activeId, setActiveId] = useState(selectedId);

  useEffect(() => {
    if (visible) setActiveId(selectedIds?.[0] || null);
  }, [visible, selectedIds]);

  const pick = (id) => {
    const next = activeId === id ? null : id;
    setActiveId(next);
    onSave?.(next ? [next] : []);
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? "#141418" : "#FFFFFF",
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: isDark ? "#3F3F46" : "#E5E7EB" }]} />
          </View>

          <Text style={[styles.title, { color: isDark ? "#F4F4F5" : "#0B1324" }]}>
            Choose a badge
          </Text>
          <Text style={[styles.hint, { color: isDark ? "#A1A1AA" : "#8B93A7" }]}>
          Let others know your role.
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.grid}
          >
            {ROLE_BADGES.map((badge) => {
              const active = activeId === badge.id;
              return (
                <TouchableOpacity
                  key={badge.id}
                  activeOpacity={0.82}
                  onPress={() => pick(badge.id)}
                  style={[styles.cell, { width: CELL }]}
                >
                  <View
                    style={[
                      styles.stickerWrap,
                      active && {
                        transform: [{ scale: 1.06 }],
                        shadowColor: "#9AEA62",
                        shadowOpacity: 0.45,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 5,
                      },
                    ]}
                  >
                    <Image
                      source={badge.image}
                      style={styles.sticker}
                      contentFit="contain"
                    />
                  </View>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: active
                          ? isDark
                            ? "#9AEA62"
                            : "#15803D"
                          : isDark
                            ? "#D4D4D8"
                            : "#374151",
                        fontWeight: active ? "800" : "600",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {badge.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedId ? (
            <TouchableOpacity
              onPress={() => {
                setActiveId(null);
                onSave?.([]);
                onClose?.();
              }}
              style={styles.clearBtn}
              hitSlop={8}
            >
              <Text style={[styles.clearText, { color: isDark ? "#A1A1AA" : "#9CA3AF" }]}>
                Remove badge
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.52)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: H_PAD,
    maxHeight: "78%",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
    marginTop: 4,
  },
  hint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: GAP,
    paddingBottom: 8,
  },
  cell: {
    alignItems: "center",
  },
  stickerWrap: {
    width: CELL * 0.86,
    height: CELL * 0.86,
    alignItems: "center",
    justifyContent: "center",
  },
  sticker: {
    width: "100%",
    height: "100%",
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
  },
  clearBtn: {
    alignSelf: "center",
    paddingVertical: 12,
  },
  clearText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

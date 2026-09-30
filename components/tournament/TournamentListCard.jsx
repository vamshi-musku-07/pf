import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { resolveTournamentSportIcon } from "@/lib/tournamentSportIcon";

/**
 * Shared tournament row for Browse / Mine / Applied.
 * Matches Teams-tab sport icon treatment (circular badge + 3D create icons)
 * and works in both dark and light themes.
 */
export default function TournamentListCard({
  title,
  subtitle,
  sport,
  chipLabel,
  chipBg,
  chipText,
  onPress,
  isDark = false,
  T,
}) {
  const sportIcon = resolveTournamentSportIcon(sport);
  const surface = isDark ? T?.surface || "#16161A" : "#FFFFFF";
  const border = isDark ? T?.border || "#2A2A2E" : "#E2E8F0";
  const titleColor = isDark ? T?.text || "#F5F5F7" : "#111827";
  const subColor = isDark ? T?.textDim || "#A1A1AA" : "#6B7280";
  const chevron = isDark ? T?.iconMuted || "#A1A1AA" : "#CBD5E1";
  const iconBg = isDark ? T?.surfaceAlt || "#1C1C1F" : "#0B1324";

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ marginBottom: 12 }}>
      <View
        style={{
          backgroundColor: surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: border,
          overflow: "hidden",
        }}
      >
        <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: iconBg,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <ExpoImage
              source={sportIcon}
              style={{ width: 40, height: 48 }}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
            />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text
                style={{ fontSize: 17, fontWeight: "700", color: titleColor, flex: 1 }}
                numberOfLines={1}
              >
                {title}
              </Text>
              {chipLabel ? (
                <View
                  style={{
                    backgroundColor: chipBg,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ color: chipText, fontSize: 10, fontWeight: "800" }}>
                    {String(chipLabel).toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
            {subtitle ? (
              <Text style={{ color: subColor, fontSize: 12, marginTop: 3 }} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={20} color={chevron} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

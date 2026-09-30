import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { resolveTeamFilterLabel } from "@/features/tournament/leaderboardConfig";

export default function TeamFilterPicker({ teams = [], selectedTeamId, onSelect }) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [open, setOpen] = useState(false);

  const sortedTeams = useMemo(
    () =>
      [...(teams || [])].sort((a, b) =>
        String(a.teamName || "").localeCompare(String(b.teamName || "")),
      ),
    [teams],
  );

  if (sortedTeams.length <= 1) return null;

  const label = resolveTeamFilterLabel(sortedTeams, selectedTeamId);

  const pick = (teamId) => {
    onSelect(teamId);
    setOpen(false);
  };

  const activeRowBg = isDark ? "rgba(186,240,114,0.12)" : "#F3FBE7";
  const checkColor = isDark ? "#BAF072" : "#4D7C0F";
  const titleColor = isDark ? T.text : "#0B1324";

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: isDark ? T.surface : "#fff",
          borderWidth: 1,
          borderColor: isDark ? T.border : "#E2E8F0",
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 12,
          gap: 8,
        }}
      >
        <Ionicons name="people-outline" size={16} color={isDark ? T.iconMuted : "#64748B"} />
        <Text style={{ color: isDark ? T.textDim : "#64748B", fontSize: 12, fontWeight: "700" }}>
          Team
        </Text>
        <Text
          style={{ color: titleColor, fontSize: 13, fontWeight: "800", maxWidth: 180 }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={isDark ? T.iconMuted : "#94A3B8"} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: isDark ? T.surface : "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 12,
              paddingBottom: 24,
              maxHeight: "60%",
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: isDark ? T.border : "#E2E8F0",
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: titleColor,
                paddingHorizontal: 20,
                marginBottom: 12,
              }}
            >
              Filter by team
            </Text>
            <ScrollView>
              <TouchableOpacity
                onPress={() => pick(null)}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: !selectedTeamId ? activeRowBg : "transparent",
                }}
              >
                <Text
                  style={{
                    color: titleColor,
                    fontSize: 15,
                    fontWeight: !selectedTeamId ? "800" : "600",
                  }}
                >
                  All teams
                </Text>
                {!selectedTeamId ? <Ionicons name="checkmark" size={18} color={checkColor} /> : null}
              </TouchableOpacity>
              {sortedTeams.map((team) => {
                const tid = String(team.teamId);
                const active = String(selectedTeamId) === tid;
                return (
                  <TouchableOpacity
                    key={tid}
                    onPress={() => pick(tid)}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: active ? activeRowBg : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: titleColor,
                        fontSize: 15,
                        fontWeight: active ? "800" : "600",
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {team.teamName || "Team"}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={18} color={checkColor} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

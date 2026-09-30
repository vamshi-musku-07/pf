import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatTeamCode, formatOwnerLabel, formatTeamMetaLine } from "./teamInviteSearch";

export default function TournamentTeamSearchRow({ team, selected, ownerProfile, onToggle }) {
  const meta = formatTeamMetaLine(team);
  const manager = formatOwnerLabel(ownerProfile);
  const code = formatTeamCode(team._id);

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.75}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        backgroundColor: selected ? "#F0FDF4" : "transparent",
        borderRadius: selected ? 12 : 0,
      }}
    >
      <Ionicons
        name={selected ? "checkbox" : "square-outline"}
        size={22}
        color={selected ? "#22C55E" : "#CBD5E1"}
        style={{ marginTop: 2 }}
      />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#0B1324", flex: 1 }} numberOfLines={1}>
            {team.teamName}
          </Text>
          <View style={{ backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: "#4338CA", letterSpacing: 0.5 }}>{code}</Text>
          </View>
        </View>
        {meta ? (
          <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
        {manager ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <Ionicons name="person-outline" size={12} color="#9CA3AF" />
            <Text style={{ fontSize: 12, color: "#374151", fontWeight: "600" }} numberOfLines={1}>
              Manager: {manager}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

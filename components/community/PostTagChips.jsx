import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Team / tournament tag chips under a post.
 */
export default function PostTagChips({
  taggedTeams = [],
  taggedTournaments = [],
  colors = {},
  onPressTeam,
  onPressTournament,
}) {
  const teams = Array.isArray(taggedTeams) ? taggedTeams : [];
  const tournaments = Array.isArray(taggedTournaments) ? taggedTournaments : [];
  if (!teams.length && !tournaments.length) return null;

  const {
    chipBg = "#F0F0F0",
    chipBorder = "#E5E5E5",
    chipText = "#111111",
    accent = "#9AEA62",
  } = colors;

  const Chip = ({ icon, label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: chipBg,
        borderWidth: 1,
        borderColor: chipBorder,
        marginRight: 8,
      }}
    >
      <Ionicons name={icon} size={13} color={accent} />
      <Text style={{ color: chipText, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 }}
    >
      {teams.map((t) => (
        <Chip
          key={`team-${t.teamId}`}
          icon="people-outline"
          label={t.teamName || "Team"}
          onPress={() => onPressTeam?.(t)}
        />
      ))}
      {tournaments.map((t) => (
        <Chip
          key={`tour-${t.tournamentId}`}
          icon="trophy-outline"
          label={t.tournamentName || "Tournament"}
          onPress={() => onPressTournament?.(t)}
        />
      ))}
    </ScrollView>
  );
}

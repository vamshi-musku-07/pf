import React from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { TournamentTeamLogo } from "@/features/tournament/helpers";
import { getByeAdvancer, describeByeAdvancement } from "@/features/tournament/bracketConfig";

/** Compact dark bye card for bracket columns. */
export default function BracketByeCard({ fixture, allFixtures = [] }) {
  const advancer = getByeAdvancer(fixture);
  const nextLabel = describeByeAdvancement(fixture, allFixtures);

  return (
    <View style={{ borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
      <LinearGradient
        colors={["#1E1B4B", "#312E81", "#1E1B4B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: 10,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "rgba(167,139,250,0.35)",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: "#A78BFA",
          }}
        />
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: "rgba(167,139,250,0.2)",
            borderWidth: 1,
            borderColor: "rgba(167,139,250,0.45)",
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 999,
            marginBottom: 8,
          }}
        >
          <Text style={{ color: "#C4B5FD", fontSize: 8, fontWeight: "900", letterSpacing: 1 }}>BYE</Text>
        </View>

        {advancer ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <TournamentTeamLogo teamLogo={advancer.teamLogo} teamName={advancer.teamName} size={22} />
            <Text style={{ flex: 1, fontSize: 11, fontWeight: "800", color: "#F8FAFC" }} numberOfLines={1}>
              {advancer.teamName}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="arrow-forward-circle-outline" size={12} color="#A78BFA" />
          <Text style={{ flex: 1, fontSize: 9, fontWeight: "600", color: "#C4B5FD", lineHeight: 13 }} numberOfLines={2}>
            Advances to {nextLabel}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

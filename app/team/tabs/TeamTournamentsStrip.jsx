import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAppTheme } from "@/constants/appearanceTheme";

export default function TeamTournamentsStrip({ teamId, tournaments = [], style, isDark = false }) {
  const T = getAppTheme(isDark);
  const router = useRouter();
  const list = Array.isArray(tournaments) ? tournaments.filter((t) => t?._id) : [];
  if (!list.length || !teamId) return null;

  const backTo = `/team/${teamId}`;

  return (
    <View style={style}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "800", color: isDark ? T.text : "#0F172A" }}>Tournaments</Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/tournament", params: { backTo } })}
        >
          <Text style={{ color: "#2563EB", fontWeight: "700", fontSize: 12 }}>View all</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 4 }}
      >
        {list.map((t) => (
          <TouchableOpacity
            key={t._id}
            onPress={() =>
              router.push({
                pathname: `/tournament/${t._id}`,
                params: { backTo, teamId: String(teamId) },
              })
            }
            style={{
              backgroundColor: isDark ? T.surfaceAlt : "#fff",
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: isDark ? T.border : "#E8EDF4",
              width: 210,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: "#081126",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trophy" size={17} color="#BAF072" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: isDark ? T.text : "#0F172A" }} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? T.textDim : "#64748B", marginTop: 1 }} numberOfLines={1}>
                  {t.teams?.length || 0} teams · {t.status || "active"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDark ? T.textMuted : "#CBD5E1"} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

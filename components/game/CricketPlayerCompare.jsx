import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { compareCricketPlayers } from "./hooks/cricketMatchAnalytics";
import { getAppTheme } from "@/constants/appearanceTheme";

function CompareBar({ label, valueA, valueB, winner, isDark, T }) {
  const a = Number(valueA) || 0;
  const b = Number(valueB) || 0;
  const total = a + b || 1;
  const muted = isDark ? T.textMuted : "#D1D5DB";
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ color: winner === "a" ? "#4ade80" : muted, fontWeight: winner === "a" ? "800" : "600", fontSize: 13 }}>{valueA ?? 0}</Text>
        <Text style={{ color: isDark ? T.textDim : "#9CA3AF", fontSize: 11, fontWeight: "600" }}>{label}</Text>
        <Text style={{ color: winner === "b" ? "#4ade80" : muted, fontWeight: winner === "b" ? "800" : "600", fontSize: 13 }}>{valueB ?? 0}</Text>
      </View>
      <View style={{ flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: isDark ? T.border : "#E5E7EB" }}>
        <View style={{ width: `${(a / total) * 100}%`, backgroundColor: winner === "a" ? "#22c55e" : "#94A3B8" }} />
        <View style={{ width: `${(b / total) * 100}%`, backgroundColor: winner === "b" ? "#22c55e" : "#94A3B8" }} />
      </View>
    </View>
  );
}

function PlayerPicker({ label, players, selectedId, onSelect, excludeId, isDark, T }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: isDark ? T.textMuted : "#6B7280", fontSize: 11, fontWeight: "700", marginBottom: 6 }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }}>
        {players
          .filter((p) => String(p.playerId) !== String(excludeId))
          .map((p) => {
            const active = String(p.playerId) === String(selectedId);
            return (
              <TouchableOpacity
                key={p.playerId}
                onPress={() => onSelect(p.playerId)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  marginRight: 6,
                  backgroundColor: active ? "#0B1324" : (isDark ? T.surfaceAlt : "#F3F4F6"),
                  borderWidth: isDark && !active ? 1 : 0,
                  borderColor: T.border,
                }}
              >
                <Text style={{ color: active ? "#fff" : (isDark ? T.textDim : "#374151"), fontSize: 11, fontWeight: "700" }} numberOfLines={1}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </View>
  );
}

export default function CricketPlayerCompare({ aggregatedPlayers = [], isDark = false }) {
  const T = getAppTheme(isDark);
  const [showModal, setShowModal] = useState(false);
  const [playerAId, setPlayerAId] = useState(aggregatedPlayers[0]?.playerId || "");
  const [playerBId, setPlayerBId] = useState(aggregatedPlayers[1]?.playerId || "");

  const playerA = aggregatedPlayers.find((p) => String(p.playerId) === String(playerAId));
  const playerB = aggregatedPlayers.find((p) => String(p.playerId) === String(playerBId));
  const rows = useMemo(
    () => (playerA && playerB ? compareCricketPlayers(playerA, playerB) : []),
    [playerA, playerB],
  );

  if (aggregatedPlayers.length < 2) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        className={`rounded-2xl p-4 mb-3 shadow-sm flex-row items-center justify-between ${isDark ? "" : "bg-white"}`}
        style={
          isDark
            ? { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border }
            : undefined
        }
      >
        <View className="flex-row items-center gap-3">
          <Ionicons name="git-compare-outline" size={20} color="#6366F1" />
          <View>
            <Text
              className="text-gray-900 font-bold text-sm"
              style={isDark ? { color: T.text } : undefined}
            >
              Compare Players
            </Text>
            <Text
              className="text-gray-400 text-xs"
              style={isDark ? { color: T.textMuted } : undefined}
            >
              Head-to-head batting & bowling
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? T.textMuted : "#9CA3AF"} />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, backgroundColor: isDark ? T.overlay : "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: isDark ? T.surface : "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "85%",
              padding: 20,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: isDark ? T.text : "#0B1324" }}>Player Comparison</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? T.textDim : "#6B7280"} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              <PlayerPicker label="Player A" players={aggregatedPlayers} selectedId={playerAId} onSelect={setPlayerAId} excludeId={playerBId} isDark={isDark} T={T} />
              <PlayerPicker label="Player B" players={aggregatedPlayers} selectedId={playerBId} onSelect={setPlayerBId} excludeId={playerAId} isDark={isDark} T={T} />
            </View>

            {playerA && playerB ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ flex: 1, textAlign: "center", fontWeight: "800", color: isDark ? T.text : "#0B1324" }} numberOfLines={1}>{playerA.name}</Text>
                  <Text style={{ width: 40, textAlign: "center", color: isDark ? T.textMuted : "#9CA3AF", fontWeight: "700" }}>vs</Text>
                  <Text style={{ flex: 1, textAlign: "center", fontWeight: "800", color: isDark ? T.text : "#0B1324" }} numberOfLines={1}>{playerB.name}</Text>
                </View>
                {rows.map((row) => (
                  <CompareBar key={row.label} label={row.label} valueA={row.a} valueB={row.b} winner={row.winner} isDark={isDark} T={T} />
                ))}
              </ScrollView>
            ) : (
              <Text style={{ color: isDark ? T.textDim : "#6B7280", textAlign: "center", paddingVertical: 24 }}>Select two players to compare</Text>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

import { useState, useMemo } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BaseballFieldMap, { POSITION_KEYS } from "./BaseballFieldMap";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

export default function BaseballFieldingSetup({
  visible,
  players = [],
  existingLineup = [],
  teamName = "Team",
  side,
  requireFullFielding = false,
  onConfirm,
  onCancel,
}) {
  const UI = useGameScoringTheme();
  const saveAccent = UI.isDark ? "#4ade80" : "#15803D";
  const warnAccent = UI.isDark ? "#facc15" : "#B45309";
  const posAccent = UI.isDark ? "#60a5fa" : "#2563EB";
  const initialAssignments = () => {
    const map = {};
    for (const entry of existingLineup) {
      if (entry.position && entry.position !== "DH") {
        const pid = String(entry.playerId);
        const found = players.find((p) => String(p._id || p.id) === pid);
        map[entry.position] = found
          ? { ...found, playerId: pid }
          : { playerId: pid, firstName: "?", lastName: "", jerseyNumber: entry.jerseyNumber };
      }
    }
    return map;
  };

  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedPosition, setSelectedPosition] = useState(null);

  const assignedPlayerIds = useMemo(
    () => new Set(Object.values(assignments).map((p) => String(p.playerId || p._id || p.id))),
    [assignments],
  );

  const availablePlayers = useMemo(
    () => players.filter((p) => p.role !== "manager" && !assignedPlayerIds.has(String(p._id || p.id))),
    [players, assignedPlayerIds],
  );

  const positionsData = useMemo(() => {
    return POSITION_KEYS.filter((k) => k !== "DH").map((posKey) => {
      const player = assignments[posKey];
      if (!player) return { position: posKey };
      return {
        position: posKey,
        playerId: String(player.playerId || player._id || player.id),
        firstName: player.firstName,
        lastName: player.lastName || "",
        jerseyNumber: player.jerseyNumber ?? player.number,
      };
    });
  }, [assignments]);

  const handlePositionTap = (posKey) => {
    if (selectedPosition === posKey && assignments[posKey]) {
      const updated = { ...assignments };
      delete updated[posKey];
      setAssignments(updated);
      setSelectedPosition(null);
    } else {
      setSelectedPosition(posKey);
    }
  };

  const handlePlayerSelect = (player) => {
    if (!selectedPosition) return;
    setAssignments({
      ...assignments,
      [selectedPosition]: { ...player, playerId: String(player._id || player.id) },
    });
    setSelectedPosition(null);
  };

  const filledCount = Object.keys(assignments).length;

  const handleConfirm = () => {
    if (filledCount === 0) return;
    if (requireFullFielding && filledCount < POSITION_KEYS.length) {
      Alert.alert(
        "Incomplete fielding",
        `Assign all ${POSITION_KEYS.length} fielding positions using your batting lineup players.`,
      );
      return;
    }
    const lineupPlayers = Object.entries(assignments).map(([pos, player]) => ({
      playerId: player.playerId || player._id || player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      jerseyNumber: player.jerseyNumber ?? player.number,
      position: pos,
    }));
    onConfirm({ side, players: lineupPlayers });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: UI.overlay, justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: UI.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", paddingBottom: 40, borderTopWidth: 1, borderColor: UI.border }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: UI.border }}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={{ color: UI.muted, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: UI.text, fontSize: 16, fontWeight: "800" }}>Fielding Positions</Text>
              <Text style={{ color: UI.muted, fontSize: 11 }}>{teamName}</Text>
            </View>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={filledCount === 0 || (requireFullFielding && filledCount < POSITION_KEYS.length)}
            >
              <Text
                style={{
                  color:
                    filledCount > 0 && (!requireFullFielding || filledCount >= POSITION_KEYS.length)
                      ? saveAccent
                      : UI.textMuted,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {/* Instruction */}
            {selectedPosition && (
              <View style={{ backgroundColor: UI.isDark ? "rgba(250,204,21,0.1)" : "#FEF3C7", borderRadius: 8, padding: 8, marginBottom: 8, alignItems: "center" }}>
                <Text style={{ color: warnAccent, fontSize: 12, fontWeight: "700" }}>
                  Tap a player below to assign to {selectedPosition}
                </Text>
                {assignments[selectedPosition] && (
                  <Text style={{ color: UI.muted, fontSize: 10, marginTop: 2 }}>
                    Tap {selectedPosition} again to remove current player
                  </Text>
                )}
              </View>
            )}
            {!selectedPosition && (
              <View style={{ alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: UI.muted, fontSize: 11 }}>
                  {requireFullFielding
                    ? "Assign all 9 positions using your batting lineup players"
                    : "Tap a position on the field to assign a player"}
                </Text>
              </View>
            )}

            {/* Field Map */}
            <View style={{ alignItems: "center", marginBottom: 12, backgroundColor: UI.isDark ? "rgba(0,0,0,0.3)" : UI.cardElevated, borderRadius: 12, paddingVertical: 12 }}>
              <BaseballFieldMap
                positions={positionsData}
                onPositionTap={handlePositionTap}
                highlightPosition={selectedPosition}
              />
            </View>

            {/* Position summary */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 12, justifyContent: "center" }}>
              {POSITION_KEYS.filter((k) => k !== "DH").map((posKey) => {
                const player = assignments[posKey];
                return (
                  <TouchableOpacity
                    key={posKey}
                    onPress={() => handlePositionTap(posKey)}
                    style={{
                      backgroundColor: selectedPosition === posKey
                        ? (UI.isDark ? "rgba(250,204,21,0.2)" : "#FEF3C7")
                        : player
                          ? (UI.isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE")
                          : UI.cardElevated,
                      borderWidth: 1,
                      borderColor: selectedPosition === posKey
                        ? warnAccent
                        : player
                          ? (UI.isDark ? "rgba(59,130,246,0.3)" : "#93C5FD")
                          : UI.border,
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      minWidth: "20%",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: "800", color: player ? posAccent : UI.muted }}>
                      {posKey}
                    </Text>
                    <Text style={{ fontSize: 8, color: UI.muted, marginTop: 1 }} numberOfLines={1}>
                      {player ? `#${player.jerseyNumber ?? ""} ${player.firstName || ""}${player.lastName ? ` ${player.lastName[0]}.` : ""}`.trim() : "empty"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Divider */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: UI.border }} />
              <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 2 }}>
                Available ({availablePlayers.length})
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: UI.border }} />
            </View>

            {/* Available players */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 20 }}>
              {availablePlayers.map((p) => (
                <TouchableOpacity
                  key={p._id || p.id}
                  onPress={() => handlePlayerSelect(p)}
                  disabled={!selectedPosition}
                  style={{
                    backgroundColor: UI.cardElevated,
                    borderWidth: 1,
                    borderColor: selectedPosition ? UI.border : UI.borderSubtle,
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    minWidth: "30%",
                    opacity: selectedPosition ? 1 : 0.4,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: UI.text }} numberOfLines={1}>
                    {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}
                    {p.firstName || ""}{p.lastName ? ` ${p.lastName}` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
              {availablePlayers.length === 0 && (
                <Text style={{ color: UI.textMuted, fontSize: 11, textAlign: "center", width: "100%", paddingVertical: 12 }}>
                  All players assigned
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

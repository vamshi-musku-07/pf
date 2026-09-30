import { useState, useMemo } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BaseballFieldMap from "./BaseballFieldMap";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];

export default function BaseballLineupSetup({
  visible,
  players = [],
  existingLineup = [],
  teamName = "Team",
  side,
  onConfirm,
  onCancel,
}) {
  const UI = useGameScoringTheme();
  const saveAccent = UI.isDark ? "#4ade80" : "#15803D";
  const warnAccent = UI.isDark ? "#facc15" : "#B45309";
  const posAccent = UI.isDark ? "#818cf8" : "#4338CA";
  const initialSlots = () => {
    if (existingLineup.length > 0) {
      return existingLineup.map((entry) => {
        const pid = String(entry.playerId);
        const found = players.find((p) => String(p._id || p.id) === pid);
        return {
          player: found || null,
          position: entry.position || "DH",
        };
      });
    }
    return [];
  };

  const [slots, setSlots] = useState(initialSlots);
  const [pickingSlot, setPickingSlot] = useState(null);

  const usedPlayerIds = useMemo(
    () => new Set(slots.filter((s) => s.player).map((s) => String(s.player._id || s.player.id))),
    [slots],
  );

  const availablePlayers = useMemo(
    () => players.filter((p) => p.role !== "manager" && !usedPlayerIds.has(String(p._id || p.id))),
    [players, usedPlayerIds],
  );

  const addPlayer = (player) => {
    if (pickingSlot !== null) {
      const updated = [...slots];
      updated[pickingSlot] = { player, position: updated[pickingSlot]?.position || "DH" };
      setSlots(updated);
      setPickingSlot(null);
    } else {
      setSlots([...slots, { player, position: "DH" }]);
    }
  };

  const removeSlot = (index) => {
    setSlots(slots.filter((_, i) => i !== index));
    if (pickingSlot === index) setPickingSlot(null);
  };

  const moveSlot = (from, to) => {
    if (to < 0 || to >= slots.length) return;
    const updated = [...slots];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    setSlots(updated);
  };

  const cyclePosition = (index) => {
    const updated = [...slots];
    const cur = updated[index].position;
    const idx = POSITIONS.indexOf(cur);
    updated[index] = { ...updated[index], position: POSITIONS[(idx + 1) % POSITIONS.length] };
    setSlots(updated);
  };

  const handleConfirm = () => {
    if (slots.length === 0) return;
    const lineupPlayers = slots.map((s) => ({
      playerId: s.player._id || s.player.id,
      firstName: s.player.firstName,
      lastName: s.player.lastName || "",
      jerseyNumber: s.player.jerseyNumber ?? s.player.number,
      position: s.position,
    }));
    onConfirm({ side, players: lineupPlayers });
  };

  const fieldPositions = useMemo(() => {
    return slots
      .filter((s) => s.player && s.position && s.position !== "DH")
      .map((s) => ({
        position: s.position,
        playerId: String(s.player._id || s.player.id),
        firstName: s.player.firstName,
        lastName: s.player.lastName || "",
        jerseyNumber: s.player.jerseyNumber ?? s.player.number,
      }));
  }, [slots]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: UI.overlay,
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: UI.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "90%",
            paddingBottom: 40,
            borderTopWidth: 1,
            borderColor: UI.border,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: UI.border,
            }}
          >
            <TouchableOpacity onPress={onCancel}>
              <Text style={{ color: UI.muted, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: UI.text, fontSize: 16, fontWeight: "800" }}>
                Batting Order
              </Text>
              <Text style={{ color: UI.muted, fontSize: 11 }}>
                {teamName}
              </Text>
            </View>
            <TouchableOpacity onPress={handleConfirm} disabled={slots.length === 0}>
              <Text
                style={{
                  color: slots.length > 0 ? saveAccent : UI.textMuted,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            {/* Compact field preview */}
            {slots.some((s) => s.position && s.position !== "DH") && (
              <View style={{ alignItems: "center", marginBottom: 10, backgroundColor: UI.isDark ? "rgba(0,0,0,0.3)" : UI.cardElevated, borderRadius: 10, paddingVertical: 8 }}>
                <BaseballFieldMap positions={fieldPositions} compact />
                <Text style={{ color: UI.muted, fontSize: 9, marginTop: 4 }}>
                  Tap position badge to change
                </Text>
              </View>
            )}

            {/* Batting order slots */}
            {slots.map((slot, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: UI.cardElevated,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: UI.border,
                }}
              >
                {/* Order number */}
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: UI.isDark ? "rgba(250,204,21,0.15)" : "#FEF3C7",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <Text style={{ color: warnAccent, fontSize: 14, fontWeight: "900" }}>
                    {i + 1}
                  </Text>
                </View>

                {/* Player name */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: UI.text, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                    {slot.player?.jerseyNumber ? `#${slot.player.jerseyNumber} ` : ""}
                    {slot.player?.firstName || ""}{slot.player?.lastName ? ` ${slot.player.lastName}` : ""}
                  </Text>
                </View>

                {/* Position badge */}
                <TouchableOpacity
                  onPress={() => cyclePosition(i)}
                  style={{
                    backgroundColor: UI.isDark ? "rgba(99,102,241,0.2)" : "#E0E7FF",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: posAccent, fontSize: 10, fontWeight: "700" }}>
                    {slot.position}
                  </Text>
                </TouchableOpacity>

                {/* Move buttons */}
                <TouchableOpacity
                  onPress={() => moveSlot(i, i - 1)}
                  disabled={i === 0}
                  style={{ padding: 4, opacity: i === 0 ? 0.2 : 1 }}
                >
                  <Ionicons name="chevron-up" size={16} color={UI.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveSlot(i, i + 1)}
                  disabled={i === slots.length - 1}
                  style={{ padding: 4, opacity: i === slots.length - 1 ? 0.2 : 1 }}
                >
                  <Ionicons name="chevron-down" size={16} color={UI.muted} />
                </TouchableOpacity>

                {/* Remove */}
                <TouchableOpacity onPress={() => removeSlot(i)} style={{ padding: 4, marginLeft: 4 }}>
                  <Ionicons name="close-circle" size={18} color={UI.muted} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Empty slot prompt */}
            {slots.length < 9 && (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: UI.border,
                  borderStyle: "dashed",
                  borderRadius: 10,
                  padding: 12,
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <Text style={{ color: UI.textMuted, fontSize: 11 }}>
                  Slot {slots.length + 1} — tap a player below to add
                </Text>
              </View>
            )}

            {/* Divider */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginVertical: 12,
              }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: UI.border }} />
              <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 2 }}>
                Available Players ({availablePlayers.length})
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: UI.border }} />
            </View>

            {/* Available players grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 20 }}>
              {availablePlayers.map((p) => (
                <TouchableOpacity
                  key={p._id || p.id}
                  onPress={() => addPlayer(p)}
                  disabled={slots.length >= 9 && pickingSlot === null}
                  style={{
                    backgroundColor: UI.cardElevated,
                    borderWidth: 1,
                    borderColor: UI.border,
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    minWidth: "30%",
                    opacity: slots.length >= 9 && pickingSlot === null ? 0.3 : 1,
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
                  All players assigned to lineup
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

const POSITIONS = [
  { key: "OH", label: "Outside Hitter", short: "OH" },
  { key: "OPP", label: "Opposite", short: "OPP" },
  { key: "MB", label: "Middle Blocker", short: "MB" },
  { key: "S", label: "Setter", short: "S" },
  { key: "L", label: "Libero", short: "L" },
  { key: "DS", label: "Defensive Specialist", short: "DS" },
];

const ROTATION_LABELS = ["P1 (RB)", "P2 (RF)", "P3 (CF)", "P4 (LF)", "P5 (LB)", "P6 (CB)"];

const createEmptyLineup = () => Array.from({ length: 6 }, (_, i) => ({
  playerId: null, playerName: null, position: null, rotation: i + 1, isLibero: false,
}));

const buildLineupState = (existingLineup = [], players = []) => {
  const playerNameById = new Map(
    (players || []).map((player) => [
      String(player?._id || player?.id),
      [player?.firstName, player?.lastName].filter(Boolean).join(" ").trim() || player?.playerName || "Player",
    ]),
  );
  const next = createEmptyLineup();
  existingLineup.forEach((player) => {
    const rotationIndex = Math.max(0, Math.min(5, (player?.rotation || 1) - 1));
    const playerId = player?.playerId ? String(player.playerId) : null;
    next[rotationIndex] = {
      playerId,
      playerName: player?.playerName || (playerId ? playerNameById.get(playerId) : null) || null,
      position: player?.position || null,
      rotation: rotationIndex + 1,
      isLibero: Boolean(player?.isLibero),
    };
  });
  return next;
};

const getRosterPlayerName = (players = [], playerId) => {
  const rosterPlayer = (players || []).find(
    (player) => String(player?._id || player?.id) === String(playerId),
  );
  if (!rosterPlayer) return null;
  return [rosterPlayer.firstName, rosterPlayer.lastName].filter(Boolean).join(" ").trim()
    || rosterPlayer.playerName
    || "Player";
};

function VolleyballLineupSetup({
  players = [],
  existingLineup = [],
  teamName = "Team",
  side = "home",
  onConfirm,
  onCancel,
  visible = false,
}) {
  const UI = useGameScoringTheme();
  const homeAccent = UI.isDark ? "#4ade80" : "#15803D";
  const awayAccent = UI.isDark ? "#f87171" : "#DC2626";
  const warnAccent = UI.isDark ? "#facc15" : "#B45309";
  // Light theme: solid surfaces only — translucent overlays make dark text unreadable.
  const softCard = UI.isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB";
  const softBorder = UI.isDark ? "rgba(255,255,255,0.1)" : "#D1D5DB";
  const sheetBg = UI.isDark ? "#1a1d2e" : "#FFFFFF";

  // lineup: array of 6 slots { playerId, playerName, position, rotation(1-6), isLibero }
  const [lineup, setLineup] = useState(createEmptyLineup);
  const [liberoPlayer, setLiberoPlayer] = useState(null); // { playerId, playerName }
  const [selectingSlot, setSelectingSlot] = useState(null); // rotation index 0-5
  const [selectingLibero, setSelectingLibero] = useState(false);
  const [firstServer, setFirstServer] = useState(0); // rotation index of first server (position 1)
  const previousVisibleRef = useRef(false);
  const previousSideRef = useRef(side);

  useEffect(() => {
    const justOpened = visible && !previousVisibleRef.current;
    const sideChanged = visible && previousSideRef.current !== side;

    if (justOpened || sideChanged) {
      setLineup(buildLineupState(existingLineup, players));
      const existingLibero = existingLineup.find((player) => player?.isLibero);
      setLiberoPlayer(existingLibero ? {
        playerId: existingLibero.playerId ? String(existingLibero.playerId) : null,
        playerName: existingLibero.playerName || getRosterPlayerName(players, existingLibero.playerId),
      } : null);
      setSelectingSlot(null);
      setSelectingLibero(false);
      setFirstServer(0);
    }

    previousVisibleRef.current = visible;
    previousSideRef.current = side;
  }, [visible, side, existingLineup, players]);

  const usedPlayerIds = useMemo(() => {
    const ids = lineup.filter((s) => s.playerId).map((s) => s.playerId);
    if (liberoPlayer?.playerId) ids.push(liberoPlayer.playerId);
    return ids;
  }, [lineup, liberoPlayer]);

  const availablePlayers = useMemo(() => {
    return (players || []).filter((p) => {
      const id = String(p._id || p.id);
      return !usedPlayerIds.includes(id);
    });
  }, [players, usedPlayerIds]);

  const pName = (p) => {
    if (!p) return "";
    const f = (p.firstName || "").trim();
    const l = (p.lastName || "").trim();
    return l ? `${f} ${l}` : f || "Player";
  };

  const handleSelectPlayer = (player) => {
    if (selectingLibero) {
      setLiberoPlayer({ playerId: String(player._id || player.id), playerName: pName(player) });
      setSelectingLibero(false);
      return;
    }
    if (selectingSlot == null) return;
    setLineup((prev) => {
      const next = [...prev];
      next[selectingSlot] = {
        ...next[selectingSlot],
        playerId: String(player._id || player.id),
        playerName: pName(player),
      };
      return next;
    });
    setSelectingSlot(null);
  };

  const handleSetPosition = (slotIdx, posKey) => {
    setLineup((prev) => {
      const next = [...prev];
      next[slotIdx] = { ...next[slotIdx], position: posKey, isLibero: posKey === "L" };
      return next;
    });
  };

  const handleClearSlot = (slotIdx) => {
    setLineup((prev) => {
      const next = [...prev];
      next[slotIdx] = { playerId: null, playerName: null, position: null, rotation: slotIdx + 1, isLibero: false };
      return next;
    });
  };

  const filledCount = lineup.filter((s) => s.playerId).length;
  const canConfirm = filledCount === 6;

  const handleConfirm = () => {
    if (!canConfirm) {
      Alert.alert("Incomplete", "Please select 6 players for the starting lineup.");
      return;
    }
    const data = lineup.map((s, i) => ({
      playerId: s.playerId,
      playerName: s.playerName,
      position: s.position || "OH",
      jerseyNumber: (players.find((p) => String(p._id || p.id) === s.playerId))?.jerseyNumber || i + 1,
      rotation: i + 1,
      isCaptain: false,
      isLibero: false,
      isStarter: true,
    }));
    onConfirm({
      side,
      players: data,
      libero: liberoPlayer,
      firstServerRotation: firstServer + 1,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <View style={{ flex: 1, backgroundColor: sheetBg }}>
        {/* Header */}
        <View style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 16,
          paddingTop: 50,
          borderBottomWidth: 1,
          borderBottomColor: softBorder,
          backgroundColor: sheetBg,
        }}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={UI.text} />
          </TouchableOpacity>
          <Text style={{ color: UI.text, fontSize: 16, fontWeight: "800", flex: 1, textAlign: "center", marginHorizontal: 8 }} numberOfLines={1}>
            {teamName} — Starting Lineup
          </Text>
          <TouchableOpacity onPress={handleConfirm} disabled={!canConfirm} style={{ opacity: canConfirm ? 1 : 0.3 }}>
            <Text style={{ color: homeAccent, fontSize: 14, fontWeight: "800" }}>CONFIRM</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, backgroundColor: sheetBg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Court diagram */}
          <Text style={{ color: UI.text, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, opacity: 0.7 }}>
            Rotation Order (tap to assign player)
          </Text>

          {/* 3x2 grid representing court positions */}
          <View style={{
            backgroundColor: UI.isDark ? "rgba(34,197,94,0.08)" : "#F0FDF4",
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: UI.isDark ? "rgba(34,197,94,0.2)" : "#BBF7D0",
            marginBottom: 16,
          }}>
            {/* Net label */}
            <View style={{ alignItems: "center", marginBottom: 8 }}>
              <View style={{
                backgroundColor: UI.isDark ? softCard : "#FFFFFF",
                paddingHorizontal: 20,
                paddingVertical: 4,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: softBorder,
              }}>
                <Text style={{ color: UI.text, fontSize: 9, fontWeight: "700", letterSpacing: 2, opacity: 0.65 }}>NET</Text>
              </View>
            </View>

            {/* Front row: P4(LF) P3(CF) P2(RF) */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              {[3, 2, 1].map((rotIdx) => {
                const slot = lineup[rotIdx];
                const isServer = rotIdx === firstServer;
                return (
                  <TouchableOpacity
                    key={rotIdx}
                    onPress={() => setSelectingSlot(rotIdx)}
                    style={{
                      flex: 1,
                      backgroundColor: slot.playerId
                        ? (UI.isDark ? "rgba(74,222,128,0.15)" : "#DCFCE7")
                        : softCard,
                      borderRadius: 10,
                      padding: 10,
                      alignItems: "center",
                      minHeight: 72,
                      borderWidth: isServer ? 2 : 1,
                      borderColor: isServer
                        ? warnAccent
                        : slot.playerId
                          ? (UI.isDark ? "rgba(74,222,128,0.3)" : "#86EFAC")
                          : softBorder,
                    }}
                  >
                    <Text style={{ color: UI.text, fontSize: 9, fontWeight: "700", marginBottom: 4, opacity: 0.55 }}>
                      {ROTATION_LABELS[rotIdx]}
                    </Text>
                    {slot.playerId ? (
                      <>
                        <Text style={{ color: UI.text, fontSize: 12, fontWeight: "700", textAlign: "center" }} numberOfLines={1}>
                          {slot.playerName}
                        </Text>
                        <Text style={{ color: homeAccent, fontSize: 9, fontWeight: "600", marginTop: 2 }}>
                          {slot.position || "—"}
                        </Text>
                      </>
                    ) : (
                      <Ionicons name="add-circle-outline" size={24} color={UI.isDark ? UI.muted : "#6B7280"} />
                    )}
                    {isServer && (
                      <View style={{ position: "absolute", top: 2, right: 4 }}>
                        <Text style={{ fontSize: 10 }}>🏐</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Back row: P5(LB) P6(CB) P1(RB) */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[4, 5, 0].map((rotIdx) => {
                const slot = lineup[rotIdx];
                const isServer = rotIdx === firstServer;
                return (
                  <TouchableOpacity
                    key={rotIdx}
                    onPress={() => setSelectingSlot(rotIdx)}
                    style={{
                      flex: 1,
                      backgroundColor: slot.playerId
                        ? (UI.isDark ? "rgba(74,222,128,0.15)" : "#DCFCE7")
                        : softCard,
                      borderRadius: 10,
                      padding: 10,
                      alignItems: "center",
                      minHeight: 72,
                      borderWidth: isServer ? 2 : 1,
                      borderColor: isServer
                        ? warnAccent
                        : slot.playerId
                          ? (UI.isDark ? "rgba(74,222,128,0.3)" : "#86EFAC")
                          : softBorder,
                    }}
                  >
                    <Text style={{ color: UI.text, fontSize: 9, fontWeight: "700", marginBottom: 4, opacity: 0.55 }}>
                      {ROTATION_LABELS[rotIdx]}
                    </Text>
                    {slot.playerId ? (
                      <>
                        <Text style={{ color: UI.text, fontSize: 12, fontWeight: "700", textAlign: "center" }} numberOfLines={1}>
                          {slot.playerName}
                        </Text>
                        <Text style={{ color: homeAccent, fontSize: 9, fontWeight: "600", marginTop: 2 }}>
                          {slot.position || "—"}
                        </Text>
                      </>
                    ) : (
                      <Ionicons name="add-circle-outline" size={24} color={UI.isDark ? UI.muted : "#6B7280"} />
                    )}
                    {isServer && (
                      <View style={{ position: "absolute", top: 2, right: 4 }}>
                        <Text style={{ fontSize: 10 }}>🏐</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* First Server selector */}
          <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            First Server
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {lineup.map((slot, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setFirstServer(idx)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: firstServer === idx
                    ? (UI.isDark ? "rgba(234,179,8,0.2)" : "#FEF3C7")
                    : softCard,
                  borderWidth: 1,
                  borderColor: firstServer === idx ? warnAccent : softBorder,
                }}
              >
                <Text style={{ color: firstServer === idx ? warnAccent : UI.muted, fontSize: 11, fontWeight: "700" }}>
                  P{idx + 1}{slot.playerName ? ` · ${slot.playerName.split(" ")[0]}` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Libero */}
          <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Libero (Optional)
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (liberoPlayer) { setLiberoPlayer(null); return; }
              setSelectingLibero(true);
            }}
            style={{
              backgroundColor: liberoPlayer
                ? (UI.isDark ? "rgba(147,51,234,0.15)" : "#F3E8FF")
                : softCard,
              borderRadius: 10,
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: liberoPlayer
                ? (UI.isDark ? "rgba(147,51,234,0.4)" : "#D8B4FE")
                : softBorder,
              marginBottom: 16,
            }}
          >
            {liberoPlayer ? (
              <>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#9333ea", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>L</Text>
                </View>
                <Text style={{ color: UI.text, fontSize: 13, fontWeight: "700", flex: 1 }}>{liberoPlayer.playerName}</Text>
                <Ionicons name="close-circle" size={18} color={UI.muted} />
              </>
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={22} color="#9333ea" />
                <Text style={{ color: UI.muted, fontSize: 12 }}>Tap to assign libero</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Position assignment for filled slots */}
          {lineup.some((s) => s.playerId) && (
            <>
              <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Assign Positions
              </Text>
              {lineup.filter((s) => s.playerId).map((slot, _) => {
                const idx = lineup.indexOf(slot);
                return (
                  <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Text style={{ color: UI.text, fontSize: 12, fontWeight: "600", width: 100 }} numberOfLines={1}>
                      {slot.playerName}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        {POSITIONS.filter((p) => p.key !== "L").map((pos) => (
                          <TouchableOpacity
                            key={pos.key}
                            onPress={() => handleSetPosition(idx, pos.key)}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 6,
                              backgroundColor: slot.position === pos.key
                                ? (UI.isDark ? "rgba(74,222,128,0.2)" : "#DCFCE7")
                                : softCard,
                              borderWidth: 1,
                              borderColor: slot.position === pos.key ? homeAccent : softBorder,
                            }}
                          >
                            <Text style={{ color: slot.position === pos.key ? homeAccent : UI.muted, fontSize: 10, fontWeight: "700" }}>
                              {pos.short}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                    <TouchableOpacity onPress={() => handleClearSlot(idx)}>
                      <Ionicons name="trash-outline" size={16} color={UI.muted} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>

        {/* Player picker (overlay when selecting) */}
        {(selectingSlot != null || selectingLibero) && (
          <View style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: "50%",
            backgroundColor: sheetBg,
            borderTopWidth: 1,
            borderTopColor: softBorder,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: UI.isDark ? 0.4 : 0.12,
            shadowRadius: 8,
            elevation: 12,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: softBorder }}>
              <Text style={{ color: UI.text, fontSize: 13, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                {selectingLibero ? "Select Libero" : `Select Player for ${ROTATION_LABELS[selectingSlot]}`}
              </Text>
              <TouchableOpacity onPress={() => { setSelectingSlot(null); setSelectingLibero(false); }}>
                <Ionicons name="close" size={20} color={UI.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              {availablePlayers.length === 0 ? (
                <Text style={{ color: UI.muted, fontSize: 12, textAlign: "center", padding: 20 }}>
                  No available players
                </Text>
              ) : (
                availablePlayers.map((p) => (
                  <TouchableOpacity
                    key={String(p._id || p.id)}
                    onPress={() => handleSelectPlayer(p)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: softBorder,
                    }}
                  >
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: UI.isDark ? "rgba(74,222,128,0.15)" : "#DCFCE7",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Text style={{ color: homeAccent, fontSize: 12, fontWeight: "800" }}>
                        {p.jerseyNumber || "—"}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ color: UI.text, fontSize: 13, fontWeight: "600" }}>
                        {pName(p)}
                      </Text>
                      {p.position && (
                        <Text style={{ color: UI.muted, fontSize: 10 }}>{p.position}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default VolleyballLineupSetup;

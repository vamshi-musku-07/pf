import { useState, useMemo, useEffect } from "react";
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

const pName = (p) => {
  if (!p) return "";
  const f = (p.firstName || p.playerName || "").trim();
  const l = (p.lastName || "").trim();
  return l ? `${f} ${l}` : f || "Player";
};

// ─── Regular Substitution Modal ───
function VolleyballSubstitutionModal({
  visible,
  onClose,
  lineups = { home: [], away: [] },
  benchPlayersBySide = { home: [], away: [] },
  teamNames = { home: "Home", away: "Away" },
  initialSide = "home",
  availableSides = ["home", "away"],
  subsThisSetBySide = { home: 0, away: 0 },
  maxSubs = 6,
  onConfirm,
}) {
  const UI = useGameScoringTheme();
  const homeAccent = UI.isDark ? "#4ade80" : "#15803D";
  const awayAccent = UI.isDark ? "#f87171" : "#DC2626";
  const warnAccent = UI.isDark ? "#facc15" : "#B45309";
  const softCard = UI.isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB";
  const softBorder = UI.isDark ? "rgba(255,255,255,0.1)" : "#D1D5DB";
  const sheetBg = UI.isDark ? "#1a1d2e" : "#FFFFFF";

  const [selectedSide, setSelectedSide] = useState(initialSide);
  const [playerOut, setPlayerOut] = useState(null);
  const [playerIn, setPlayerIn] = useState(null);

  useEffect(() => {
    if (!visible) return;
    const fallbackSide = availableSides.includes(initialSide)
      ? initialSide
      : availableSides[0] || initialSide;
    setSelectedSide(fallbackSide);
    setPlayerOut(null);
    setPlayerIn(null);
  }, [availableSides, visible, initialSide]);

  useEffect(() => {
    if (!availableSides.includes(selectedSide)) {
      setSelectedSide(availableSides[0] || initialSide);
    }
  }, [availableSides, initialSide, selectedSide]);

  useEffect(() => {
    setPlayerOut(null);
    setPlayerIn(null);
  }, [selectedSide]);

  const lineup = lineups[selectedSide] || [];
  const benchPlayers = benchPlayersBySide[selectedSide] || [];
  const teamName = teamNames[selectedSide] || "Team";
  const subsThisSet = subsThisSetBySide[selectedSide] || 0;

  const handleConfirm = () => {
    if (!playerOut || !playerIn) {
      Alert.alert("Incomplete", "Select both player out and player in.");
      return;
    }
    onConfirm({ playerOut, playerIn, side: selectedSide });
    setPlayerOut(null);
    setPlayerIn(null);
  };

  const remaining = maxSubs - subsThisSet;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: sheetBg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: softBorder, backgroundColor: sheetBg }}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={UI.text} />
          </TouchableOpacity>
          <Text style={{ color: UI.text, fontSize: 16, fontWeight: "800" }}>
            Substitution
          </Text>
          <TouchableOpacity onPress={handleConfirm} disabled={!playerOut || !playerIn} style={{ opacity: playerOut && playerIn ? 1 : 0.3 }}>
            <Text style={{ color: homeAccent, fontSize: 14, fontWeight: "800" }}>CONFIRM</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {availableSides.length > 1 && (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {availableSides.map((sideKey) => {
              const active = selectedSide === sideKey;
              return (
                <TouchableOpacity
                  key={sideKey}
                  onPress={() => setSelectedSide(sideKey)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: active
                      ? (UI.isDark ? "rgba(74,222,128,0.16)" : "#DCFCE7")
                      : softCard,
                    borderWidth: 1,
                    borderColor: active ? homeAccent : softBorder,
                  }}
                >
                  <Text style={{ color: active ? homeAccent : UI.text, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                    {teamNames[sideKey] || sideKey}
                  </Text>
                </TouchableOpacity>
              );
              })}
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: UI.isDark ? "#D1D5DB" : UI.text, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>{teamName}</Text>
            <Text style={{ color: UI.muted, fontSize: 11 }}>Subs remaining: {remaining}/{maxSubs}</Text>
            {remaining <= 1 && <Text style={{ color: awayAccent, fontSize: 11, fontWeight: "700" }}>⚠ Last sub!</Text>}
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Player Out */}
          <Text style={{ color: awayAccent, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Player OUT (on court)
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {lineup.filter((p) => p.playerId && !p.isLibero).map((p) => {
              const selected = playerOut?.playerId === p.playerId;
              return (
                <TouchableOpacity
                  key={p.playerId}
                  onPress={() => setPlayerOut(p)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                    backgroundColor: selected ? "rgba(239,68,68,0.2)" : softCard,
                    borderWidth: 1, borderColor: selected ? awayAccent : softBorder,
                    flexDirection: "row", alignItems: "center", gap: 6,
                  }}
                >
                  {p.jerseyNumber && (
                    <Text style={{ color: selected ? awayAccent : UI.muted, fontSize: 11, fontWeight: "800" }}>#{p.jerseyNumber}</Text>
                  )}
                  <Text style={{ color: selected ? UI.text : (UI.isDark ? "#D1D5DB" : UI.text), fontSize: 12, fontWeight: "600" }}>
                    {p.playerName || "Player"}
                  </Text>
                  <Text style={{ color: "#6B7280", fontSize: 9 }}>{p.position || ""}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Player In */}
          <Text style={{ color: homeAccent, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Player IN (from bench)
          </Text>
          {benchPlayers.length === 0 ? (
            <Text style={{ color: "#6B7280", fontSize: 12, padding: 12 }}>No bench players available</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {benchPlayers.map((p) => {
                const id = String(p._id || p.id || p.playerId);
                const selected = playerIn && String(playerIn._id || playerIn.id || playerIn.playerId) === id;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setPlayerIn(p)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                      backgroundColor: selected ? "rgba(74,222,128,0.2)" : softCard,
                      borderWidth: 1, borderColor: selected ? homeAccent : softBorder,
                      flexDirection: "row", alignItems: "center", gap: 6,
                    }}
                  >
                    {(p.jerseyNumber) && (
                      <Text style={{ color: selected ? homeAccent : UI.muted, fontSize: 11, fontWeight: "800" }}>#{p.jerseyNumber}</Text>
                    )}
                    <Text style={{ color: selected ? UI.text : (UI.isDark ? "#D1D5DB" : UI.text), fontSize: 12, fontWeight: "600" }}>
                      {pName(p)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Libero Replacement Modal ───
function VolleyballLiberoModal({
  visible,
  onClose,
  lineup = [],
  libero = null,
  liberoIsIn = false,
  teamName = "Team",
  side = "home",
  onConfirm,
}) {
  const UI = useGameScoringTheme();
  const homeAccent = UI.isDark ? "#4ade80" : "#15803D";
  const awayAccent = UI.isDark ? "#f87171" : "#DC2626";
  const warnAccent = UI.isDark ? "#facc15" : "#B45309";
  const softCard = UI.isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB";
  const softBorder = UI.isDark ? "rgba(255,255,255,0.1)" : "#D1D5DB";
  const sheetBg = UI.isDark ? "#1a1d2e" : "#FFFFFF";
  const overlayBg = UI.isDark ? "rgba(0,0,0,0.72)" : "rgba(15,23,42,0.4)";
  const liberoAccent = UI.isDark ? "#c084fc" : "#7E22CE";

  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Libero can only replace back-row players (P1, P5, P6 → indices 0, 4, 5 in current rotation)
  const backRowPlayers = useMemo(() => {
    return lineup.filter((p, idx) => {
      if (!p.playerId || p.isLibero) return false;
      // Back row positions: P1(idx=0), P5(idx=4), P6(idx=5)
      return [0, 4, 5].includes(idx);
    });
  }, [lineup]);

  const handleConfirm = () => {
    if (!selectedPlayer) return;
    onConfirm({
      side,
      liberoIn: !liberoIsIn,
      playerSwap: selectedPlayer,
    });
    setSelectedPlayer(null);
  };

  if (!libero) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: overlayBg, justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: sheetBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "60%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: softBorder }}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={UI.muted} />
            </TouchableOpacity>
            <Text style={{ color: UI.text, fontSize: 15, fontWeight: "800" }}>
              {liberoIsIn ? "Libero OUT" : "Libero IN"} · {teamName}
            </Text>
            <TouchableOpacity onPress={handleConfirm} disabled={!selectedPlayer} style={{ opacity: selectedPlayer ? 1 : 0.3 }}>
              <Text style={{ color: liberoAccent, fontSize: 14, fontWeight: "800" }}>CONFIRM</Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#9333ea", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>L</Text>
              </View>
              <Text style={{ color: liberoAccent, fontSize: 14, fontWeight: "700" }}>{libero.playerName || "Libero"}</Text>
              <View style={{ backgroundColor: liberoIsIn ? (UI.isDark ? "rgba(74,222,128,0.2)" : "#DCFCE7") : (UI.isDark ? "rgba(239,68,68,0.2)" : "#FEE2E2"), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ color: liberoIsIn ? homeAccent : awayAccent, fontSize: 10, fontWeight: "700" }}>
                  {liberoIsIn ? "ON COURT" : "ON BENCH"}
                </Text>
              </View>
            </View>

            <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              {liberoIsIn ? "Replace libero with:" : "Swap for back-row player:"}
            </Text>

            <View style={{ gap: 8 }}>
              {backRowPlayers.map((p) => {
                const selected = selectedPlayer?.playerId === p.playerId;
                return (
                  <TouchableOpacity
                    key={p.playerId}
                    onPress={() => setSelectedPlayer(p)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 10,
                      paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10,
                      backgroundColor: selected ? "rgba(147,51,234,0.15)" : softCard,
                      borderWidth: 1, borderColor: selected ? "#9333ea" : softBorder,
                    }}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: softCard, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: UI.text, fontSize: 11, fontWeight: "800" }}>
                        {p.jerseyNumber || "—"}
                      </Text>
                    </View>
                    <Text style={{ color: UI.text, fontSize: 13, fontWeight: "600" }}>{p.playerName || "Player"}</Text>
                    <Text style={{ color: "#6B7280", fontSize: 10 }}>{p.position || ""}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export { VolleyballSubstitutionModal, VolleyballLiberoModal };

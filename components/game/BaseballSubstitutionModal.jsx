import { useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

export default function BaseballSubstitutionModal({
  visible,
  lineup,
  benchPlayers,
  teamName,
  onConfirm,
  onCancel,
}) {
  const UI = useGameScoringTheme();
  const outAccent = UI.isDark ? "#f87171" : "#DC2626";
  const inAccent = UI.isDark ? "#4ade80" : "#15803D";
  const [playerOut, setPlayerOut] = useState(null);
  const [playerIn, setPlayerIn] = useState(null);
  const [step, setStep] = useState("out");

  const reset = () => {
    setPlayerOut(null);
    setPlayerIn(null);
    setStep("out");
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleConfirm = () => {
    if (playerOut && playerIn) {
      onConfirm({ playerOutId: playerOut.id, playerInId: playerIn.id, position: playerOut.position });
      reset();
    }
  };

  const handleSelectOut = (p) => {
    setPlayerOut(p);
    setStep("in");
  };

  const handleSelectIn = (p) => {
    setPlayerIn(p);
    setStep("confirm");
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: UI.overlay, justifyContent: "center", padding: 20 }}>
        <View style={{ backgroundColor: UI.card, borderRadius: 16, padding: 20, maxHeight: "80%", borderWidth: 1, borderColor: UI.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: UI.text }}>
              Substitution — {teamName}
            </Text>
            <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={UI.muted} />
            </TouchableOpacity>
          </View>

          {/* Step indicators */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            {["Player Out", "Player In", "Confirm"].map((s, i) => (
              <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: i <= ["out", "in", "confirm"].indexOf(step) ? "#3b82f6" : UI.cardElevated,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 9, fontWeight: "900", color: "#fff" }}>{i + 1}</Text>
                </View>
                <Text style={{ fontSize: 10, color: i <= ["out", "in", "confirm"].indexOf(step) ? (UI.isDark ? "#93c5fd" : "#1D4ED8") : UI.muted, fontWeight: "600" }}>
                  {s}
                </Text>
              </View>
            ))}
          </View>

          {step === "out" && (
            <>
              <Text style={{ fontSize: 11, color: UI.muted, marginBottom: 10 }}>
                Select player to remove from the game:
              </Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {lineup.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handleSelectOut(p)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 10,
                      backgroundColor: UI.cardElevated, borderRadius: 10,
                      padding: 12, marginBottom: 6, borderWidth: 1, borderColor: UI.border,
                    }}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: UI.isDark ? "rgba(248,113,113,0.15)" : "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 10, fontWeight: "900", color: outAccent }}>
                        {p.jerseyNumber || "#"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: UI.text }}>{p.name}</Text>
                      <Text style={{ fontSize: 9, color: UI.muted }}>{p.position || "—"}</Text>
                    </View>
                    <Ionicons name="remove-circle-outline" size={18} color={outAccent} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {step === "in" && (
            <>
              <Text style={{ fontSize: 11, color: UI.muted, marginBottom: 4 }}>
                Replacing: <Text style={{ color: outAccent, fontWeight: "700" }}>{playerOut?.name}</Text> ({playerOut?.position})
              </Text>
              <Text style={{ fontSize: 11, color: UI.muted, marginBottom: 10 }}>
                Select replacement from bench:
              </Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {benchPlayers.length === 0 && (
                  <Text style={{ fontSize: 12, color: UI.muted, textAlign: "center", paddingVertical: 20 }}>
                    No bench players available
                  </Text>
                )}
                {benchPlayers.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handleSelectIn(p)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 10,
                      backgroundColor: UI.cardElevated, borderRadius: 10,
                      padding: 12, marginBottom: 6, borderWidth: 1, borderColor: UI.border,
                    }}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: UI.isDark ? "rgba(74,222,128,0.15)" : "#DCFCE7", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 10, fontWeight: "900", color: inAccent }}>
                        {p.jerseyNumber || "#"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: UI.text }}>{p.name}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={18} color={inAccent} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity onPress={() => setStep("out")} style={{ marginTop: 10, alignItems: "center" }}>
                <Text style={{ color: UI.muted, fontSize: 11 }}>← Back</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "confirm" && (
            <>
              <View style={{ backgroundColor: UI.cardElevated, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: UI.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <View style={{ alignItems: "center" }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: UI.isDark ? "rgba(248,113,113,0.15)" : "#FEE2E2", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: "900", color: outAccent }}>
                        {playerOut?.jerseyNumber || "#"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: outAccent }}>{playerOut?.name}</Text>
                    <Text style={{ fontSize: 8, color: UI.muted }}>OUT</Text>
                  </View>
                  <Ionicons name="swap-horizontal" size={24} color={UI.muted} />
                  <View style={{ alignItems: "center" }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: UI.isDark ? "rgba(74,222,128,0.15)" : "#DCFCE7", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: "900", color: inAccent }}>
                        {playerIn?.jerseyNumber || "#"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: inAccent }}>{playerIn?.name}</Text>
                    <Text style={{ fontSize: 8, color: UI.muted }}>IN</Text>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => { setPlayerIn(null); setStep("in"); }}
                  style={{ flex: 1, backgroundColor: UI.cardElevated, borderRadius: 10, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: UI.border }}
                >
                  <Text style={{ color: UI.muted, fontWeight: "700", fontSize: 14 }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirm}
                  style={{ flex: 2, backgroundColor: "#3b82f6", borderRadius: 10, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Confirm Sub</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

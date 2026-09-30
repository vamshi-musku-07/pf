import { useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const REASONS = [
  { value: "tactical", label: "Tactical", icon: "swap-horizontal", color: "#3b82f6" },
  { value: "injury", label: "Injury", icon: "medkit", color: "#f97316" },
  { value: "blood", label: "Blood", icon: "water", color: "#ef4444" },
];

export default function RugbySubstitutionModal({
  visible,
  lineup,
  benchPlayers,
  teamName,
  onConfirm,
  onCancel,
}) {
  const [playerOut, setPlayerOut] = useState(null);
  const [playerIn, setPlayerIn] = useState(null);
  const [reason, setReason] = useState("tactical");
  const [step, setStep] = useState("out");

  const reset = () => {
    setPlayerOut(null);
    setPlayerIn(null);
    setReason("tactical");
    setStep("out");
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleConfirm = () => {
    if (playerOut && playerIn) {
      onConfirm({
        playerOutId: playerOut.id,
        playerInId: playerIn.id,
        position: playerOut.position,
        reason,
      });
      reset();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 20 }}>
        <View style={{ backgroundColor: "#1a1d2e", borderRadius: 16, padding: 20, maxHeight: "80%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>
              Substitution — {teamName}
            </Text>
            <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            {["Player Off", "Player On", "Reason", "Confirm"].map((s, i) => (
              <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: i <= ["out", "in", "reason", "confirm"].indexOf(step) ? "#3b82f6" : "rgba(255,255,255,0.1)",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 9, fontWeight: "900", color: "#fff" }}>{i + 1}</Text>
                </View>
                <Text style={{ fontSize: 9, color: i <= ["out", "in", "reason", "confirm"].indexOf(step) ? "#93c5fd" : "#6b7280", fontWeight: "600" }}>
                  {s}
                </Text>
              </View>
            ))}
          </View>

          {step === "out" && (
            <>
              <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 10 }}>
                Select player going OFF:
              </Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {lineup.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => { setPlayerOut(p); setStep("in"); }}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 10,
                      backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10,
                      padding: 12, marginBottom: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(248,113,113,0.15)", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 10, fontWeight: "900", color: "#f87171" }}>
                        {p.jerseyNumber || "#"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "#d1d5db" }}>{p.name}</Text>
                      <Text style={{ fontSize: 9, color: "#6b7280" }}>{p.position || "—"}</Text>
                    </View>
                    <Ionicons name="remove-circle-outline" size={18} color="#f87171" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {step === "in" && (
            <>
              <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>
                Replacing: <Text style={{ color: "#f87171", fontWeight: "700" }}>{playerOut?.name}</Text> ({playerOut?.position})
              </Text>
              <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 10 }}>
                Select player coming ON:
              </Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {benchPlayers.length === 0 && (
                  <Text style={{ fontSize: 12, color: "#6b7280", textAlign: "center", paddingVertical: 20 }}>
                    No bench players available
                  </Text>
                )}
                {benchPlayers.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => { setPlayerIn(p); setStep("reason"); }}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 10,
                      backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10,
                      padding: 12, marginBottom: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(74,222,128,0.15)", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 10, fontWeight: "900", color: "#4ade80" }}>
                        {p.jerseyNumber || "#"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "#d1d5db" }}>{p.name}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={18} color="#4ade80" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity onPress={() => setStep("out")} style={{ marginTop: 10, alignItems: "center" }}>
                <Text style={{ color: "#6b7280", fontSize: 11 }}>← Back</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "reason" && (
            <>
              <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 12 }}>
                Reason for substitution:
              </Text>
              <View style={{ gap: 8, marginBottom: 16 }}>
                {REASONS.map(r => (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setReason(r.value)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 12,
                      padding: 14, borderRadius: 10,
                      backgroundColor: reason === r.value ? `${r.color}22` : "rgba(255,255,255,0.05)",
                      borderWidth: 1,
                      borderColor: reason === r.value ? `${r.color}66` : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Ionicons name={r.icon} size={20} color={reason === r.value ? r.color : "#6b7280"} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: reason === r.value ? r.color : "#9CA3AF" }}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => { setPlayerIn(null); setStep("in"); }}
                  style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#9CA3AF", fontWeight: "700", fontSize: 14 }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStep("confirm")}
                  style={{ flex: 2, backgroundColor: "#3b82f6", borderRadius: 10, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Next</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === "confirm" && (
            <>
              <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <View style={{ alignItems: "center" }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(248,113,113,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: "900", color: "#f87171" }}>
                        {playerOut?.jerseyNumber || "#"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: "#f87171" }}>{playerOut?.name}</Text>
                    <Text style={{ fontSize: 8, color: "#6b7280" }}>OFF</Text>
                  </View>
                  <Ionicons name="swap-horizontal" size={24} color="#6b7280" />
                  <View style={{ alignItems: "center" }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(74,222,128,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: "900", color: "#4ade80" }}>
                        {playerIn?.jerseyNumber || "#"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: "#4ade80" }}>{playerIn?.name}</Text>
                    <Text style={{ fontSize: 8, color: "#6b7280" }}>ON</Text>
                  </View>
                </View>
                <View style={{ alignItems: "center", marginTop: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: 2 }}>
                    {REASONS.find(r => r.value === reason)?.label || reason}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setStep("reason")}
                  style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#9CA3AF", fontWeight: "700", fontSize: 14 }}>Back</Text>
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

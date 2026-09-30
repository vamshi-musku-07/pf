import { useState, useMemo } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

const DESTINATIONS = {
  first: ["second", "third", "home", "out"],
  second: ["third", "home", "out"],
  third: ["home", "out"],
};

const DEST_LABELS = {
  second: "2nd",
  third: "3rd",
  home: "Home",
  out: "Out",
};

const DEST_COLORS = {
  second: "#60a5fa",
  third: "#a78bfa",
  home: "#4ade80",
  out: "#f87171",
};

function getDefaultAdvancement(hitType, bases) {
  const adv = {};
  if (hitType === "single") {
    if (bases.third) adv.third = "home";
    if (bases.second) adv.second = "home";
    if (bases.first) adv.first = "second";
  } else if (hitType === "double") {
    if (bases.third) adv.third = "home";
    if (bases.second) adv.second = "home";
    if (bases.first) adv.first = "home";
  } else if (hitType === "triple") {
    if (bases.third) adv.third = "home";
    if (bases.second) adv.second = "home";
    if (bases.first) adv.first = "home";
  }
  return adv;
}

export default function BaseballRunnerModal({
  visible,
  hitType,
  bases,
  getRunnerName,
  onConfirm,
  onCancel,
}) {
  const defaults = useMemo(
    () => getDefaultAdvancement(hitType, bases),
    [hitType, bases],
  );
  const [advancement, setAdvancement] = useState(defaults);

  const runners = useMemo(() => {
    const r = [];
    if (bases.third) r.push({ base: "third", label: "3rd", playerId: bases.third });
    if (bases.second) r.push({ base: "second", label: "2nd", playerId: bases.second });
    if (bases.first) r.push({ base: "first", label: "1st", playerId: bases.first });
    return r;
  }, [bases]);

  const UI = useGameScoringTheme();
  const warnAccent = UI.isDark ? "#facc15" : "#B45309";

  const cycleDest = (base) => {
    const opts = DESTINATIONS[base];
    const curr = advancement[base] || opts[0];
    const idx = opts.indexOf(curr);
    const next = opts[(idx + 1) % opts.length];
    setAdvancement((prev) => ({ ...prev, [base]: next }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: UI.overlay, justifyContent: "center", padding: 20 }}>
        <View style={{ backgroundColor: UI.card, borderRadius: 16, padding: 20, maxHeight: "80%", borderWidth: 1, borderColor: UI.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: UI.text }}>
              Runner Advancement
            </Text>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={UI.muted} />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 11, color: UI.muted, marginBottom: 16 }}>
            Tap each runner to cycle their destination. Hit: {hitType?.replace(/_/g, " ").toUpperCase()}
          </Text>

          <ScrollView>
            {runners.map((runner) => {
              const dest = advancement[runner.base] || DESTINATIONS[runner.base][0];
              return (
                <TouchableOpacity
                  key={runner.base}
                  onPress={() => cycleDest(runner.base)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: UI.cardElevated,
                    borderWidth: 1,
                    borderColor: UI.border,
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: UI.isDark ? "rgba(250,204,21,0.2)" : "#FEF3C7", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 10, fontWeight: "900", color: warnAccent }}>{runner.label}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: UI.text }}>
                      {getRunnerName(runner.playerId)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="arrow-forward" size={14} color={UI.muted} />
                    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: `${DEST_COLORS[dest]}22` }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: DEST_COLORS[dest] }}>
                        {DEST_LABELS[dest]}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {runners.length === 0 && (
              <Text style={{ fontSize: 12, color: UI.muted, textAlign: "center", paddingVertical: 20 }}>
                No runners on base
              </Text>
            )}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{ flex: 1, backgroundColor: UI.cardElevated, borderRadius: 10, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: UI.border }}
            >
              <Text style={{ color: UI.muted, fontWeight: "700", fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(advancement)}
              style={{ flex: 2, backgroundColor: "#3b82f6", borderRadius: 10, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

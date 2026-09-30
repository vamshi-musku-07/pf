import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NRR_HELP_POINTS } from "@/features/tournament/helpers";

export default function NrrHelpSheet({
  visible,
  onClose,
  onExplain,
  showExplain = false,
  explainerLoading = false,
  isDark = false,
  T,
  mode = "cricket",
}) {
  const insets = useSafeAreaInsets();
  const isFootball = mode === "football";
  const isVolleyball = mode === "volleyball";
  const isBaseball = mode === "baseball";
  const isBasketball = mode === "basketball";
  const sheetBg = isDark ? T?.surface || "#16161A" : "#fff";
  const handleBg = isDark ? T?.border || "#2A2A2E" : "#E2E8F0";
  const titleColor = isDark ? T?.text || "#F5F5F7" : "#0B1324";
  const subtitleColor = isDark ? T?.textDim || "#A1A1AA" : "#6B7280";
  const closeBg = isDark ? T?.surfaceAlt || "#1E1E24" : "#F1F5F9";
  const closeIcon = isDark ? T?.iconMuted || "#A1A1AA" : "#64748B";
  const iconBoxBg = isDark ? "rgba(186,240,114,0.16)" : "#E8F8D8";
  const iconColor = isDark ? "#BAF072" : "#081126";
  const pointsBg = isDark ? T?.surfaceAlt || "#1E1E24" : "#F8FAFC";
  const pointsBorder = isDark ? T?.border || "#2A2A2E" : "#E2E8F0";
  const pointText = isDark ? T?.textDim || "#A1A1AA" : "#334155";
  const footerNote = isDark ? T?.textMuted || "#71717A" : "#94A3B8";
  const bullet = isDark ? T?.iconMuted || "#A1A1AA" : "#94A3B8";

  const footballPoints = [
    "Win = points for a win (usually 3); draw = 1 each; loss = 0.",
    "Goal difference (GD) = goals for − goals against.",
    "If points are level, higher GD ranks above.",
    "If GD is level, more goals scored (GF) ranks above.",
    "League form uses W / D / L. Knockout ties may use ET or penalties.",
  ];

  const volleyballPoints = [
    "Match points depend on the set score (configurable): typically 3–0/3–1 = 3 pts, 3–2 = 2 pts.",
    "A 2–3 loss often earns 1 pt; 0–3 / 1–3 losses earn 0.",
    "SW / SL = sets won / sets lost. PD = set difference (SW − SL).",
    "If points are level, higher set difference ranks above, then more sets won, then point difference.",
    "Volleyball matches do not normally draw — one team always wins the required sets.",
  ];

  const baseballPoints = [
    "Teams are ranked by winning percentage (PCT), not points.",
    "PCT = wins ÷ (wins + losses). Ties do not inflate the denominator in V1.",
    "RS / RA / RD = runs scored / runs allowed / run differential.",
    "If PCT is level, use head-to-head among the tied group, then RD, then RS, then fewer RA.",
    "Pool games may finish tied when configured; knockout games continue until there is a winner.",
  ];
  const basketballPoints = [
    "Every game has a winner (overtime if needed), so standings do not use draws.",
    "Pts = tournament points (default: win 2, loss 0).",
    "PF / PA / PD = points for / points against / point differential.",
    "If Pts are level, use head-to-head, then PD, then PF, then fewer PA.",
    "Form shows recent W/L results from completed group games.",
  ];

  const helpTitle = isFootball
    ? "How does the table work?"
    : isVolleyball
      ? "How do volleyball standings work?"
      : isBaseball
        ? "How do baseball standings work?"
      : isBasketball
        ? "How do basketball standings work?"
      : "How is NRR calculated?";
  const helpSubtitle = isFootball
    ? "League ranking & tie-breakers"
    : isVolleyball
      ? "Set-based match points & tie-breakers"
      : isBaseball
        ? "PCT ranking & pool tie-breakers"
      : isBasketball
        ? "Points table & tie-breakers"
      : "ICC-style league tie-breaker";
  const helpLines = isFootball
    ? footballPoints
    : isVolleyball
      ? volleyballPoints
      : isBaseball
        ? baseballPoints
      : isBasketball
        ? basketballPoints
        : NRR_HELP_POINTS.slice(1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />

        <View
          style={[
            styles.sheet,
            { backgroundColor: sheetBg, paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: handleBg }]} />

          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: iconBoxBg }]}>
              <Ionicons
                name={
                  isFootball
                    ? "football-outline"
                    : isVolleyball
                      ? "basketball-outline"
                      : isBaseball
                        ? "baseball-outline"
                        : isBasketball
                          ? "basketball-outline"
                        : "calculator-outline"
                }
                size={20}
                color={iconColor}
              />
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.title, { color: titleColor }]}>
                {helpTitle}
              </Text>
              <Text style={[styles.subtitle, { color: subtitleColor }]}>
                {helpSubtitle}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.closeBtn, { backgroundColor: closeBg }]}
            >
              <Ionicons name="close" size={20} color={closeIcon} />
            </TouchableOpacity>
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {isFootball ? (
              <View style={styles.formulaCard}>
                <Text style={styles.formulaLabel}>Order</Text>
                <Text style={styles.formulaText}>Pts → GD → GF → Wins</Text>
              </View>
            ) : isVolleyball ? (
              <View style={styles.formulaCard}>
                <Text style={styles.formulaLabel}>Order</Text>
                <Text style={styles.formulaText}>Pts → Set Diff → Sets Won → Point Diff</Text>
              </View>
            ) : isBaseball ? (
              <View style={styles.formulaCard}>
                <Text style={styles.formulaLabel}>Order</Text>
                <Text style={styles.formulaText}>PCT → H2H → RD → RS → RA</Text>
              </View>
            ) : isBasketball ? (
              <View style={styles.formulaCard}>
                <Text style={styles.formulaLabel}>Order</Text>
                <Text style={styles.formulaText}>Pts → H2H → PD → PF → PA</Text>
              </View>
            ) : (
              <View style={styles.formulaCard}>
                <Text style={styles.formulaLabel}>Formula</Text>
                <Text style={styles.formulaText}>
                  NRR = (Runs scored ÷ Balls faced) − (Runs conceded ÷ Balls bowled)
                </Text>
              </View>
            )}

            <View style={[styles.pointsCard, { backgroundColor: pointsBg, borderColor: pointsBorder }]}>
              {helpLines.map((line, idx) => (
                <View key={idx} style={[styles.pointRow, idx > 0 && styles.pointRowGap]}>
                  <View style={[styles.bullet, { backgroundColor: bullet }]} />
                  <Text style={[styles.pointText, { color: pointText }]}>{line}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.footerNote, { color: footerNote }]}>
              {isFootball
                ? "Standings order: points, then goal difference, then goals for, then wins."
                : isVolleyball
                  ? "Standings order: points, then set difference, then sets won, then rally point difference."
                  : isBaseball
                    ? "Standings order: winning percentage, then head-to-head, run differential, runs scored, runs allowed."
                  : isBasketball
                    ? "Standings order: points, then head-to-head, point differential, points for, then fewer points against."
                  : "Standings order: points, then NRR, then wins."}
            </Text>
          </ScrollView>

          {showExplain ? (
            <TouchableOpacity
              onPress={onExplain}
              disabled={explainerLoading}
              style={[
                styles.explainBtn,
                explainerLoading && { opacity: 0.6 },
                isDark && { borderWidth: 1, borderColor: T?.border || "#2A2A2E" },
              ]}
            >
              <Ionicons name="sparkles" size={16} color="#BAF072" />
              <Text style={styles.explainBtnText}>Explain my team's position</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(2, 6, 23, 0.55)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    maxHeight: "82%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: 4,
  },
  formulaCard: {
    backgroundColor: "#0B1324",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  formulaLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#BAF072",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  formulaText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F8FAFC",
    lineHeight: 21,
  },
  pointsCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  pointRowGap: {
    marginTop: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  pointText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  footerNote: {
    fontSize: 12,
    marginTop: 14,
    lineHeight: 18,
  },
  explainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#0B1324",
  },
  explainBtnText: {
    color: "#BAF072",
    fontWeight: "800",
    fontSize: 14,
  },
});

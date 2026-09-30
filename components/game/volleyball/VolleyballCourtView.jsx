import { useMemo } from "react";
import { Text, View } from "react-native";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

const POS_LABELS = ["P1", "P2", "P3", "P4", "P5", "P6"];
const ZONE_LABELS = ["RB", "RF", "CF", "LF", "LB", "CB"];

function VolleyballCourtView({
  lineup = [],
  rotation = 1,
  servingTeam = false,
  teamColor = "#4ade80",
  compact = false,
  libero = null,
}) {
  const UI = useGameScoringTheme();
  const warnAccent = UI.isDark ? "#facc15" : "#B45309";
  const softCard = UI.isDark ? "rgba(255,255,255,0.03)" : UI.cardElevated;
  const softBorder = UI.isDark ? "rgba(255,255,255,0.06)" : UI.border;
  const netBg = UI.isDark ? "rgba(255,255,255,0.04)" : UI.border;

  const onCourt = useMemo(() => {
    if (!lineup || lineup.length === 0) return [];
    const positions = [];
    for (let i = 0; i < 6; i++) {
      const playerIdx = (i + rotation - 1) % 6;
      const player = lineup[playerIdx];
      positions.push({
        posLabel: POS_LABELS[i],
        zoneLabel: ZONE_LABELS[i],
        playerName: player?.playerName || player?.position || `P${playerIdx + 1}`,
        playerId: player?.playerId,
        position: player?.position,
        jerseyNumber: player?.jerseyNumber,
        isLibero: false,
      });
    }
    return positions;
  }, [lineup, rotation]);

  if (onCourt.length === 0) {
    return (
      <View style={{ backgroundColor: softCard, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: softBorder }}>
        <Text style={{ color: UI.muted, fontSize: 11 }}>No lineup set</Text>
      </View>
    );
  }

  const sz = compact ? 10 : 12;
  const cellH = compact ? 44 : 56;

  const frontRow = [onCourt[3], onCourt[2], onCourt[1]];
  const backRow = [onCourt[4], onCourt[5], onCourt[0]];

  const renderCell = (p, isServer) => (
    <View style={{
      flex: 1,
      backgroundColor: isServer
        ? (UI.isDark ? "rgba(234,179,8,0.15)" : "#FEF3C7")
        : `${teamColor}15`,
      borderRadius: 8,
      padding: 4,
      alignItems: "center",
      justifyContent: "center",
      minHeight: cellH,
      borderWidth: isServer ? 2 : 1,
      borderColor: isServer ? warnAccent : `${teamColor}30`,
    }}>
      {isServer && <Text style={{ fontSize: 8, position: "absolute", top: 1, right: 3 }}>🏐</Text>}
      <Text style={{ color: UI.muted, fontSize: 8, fontWeight: "700" }}>{p.zoneLabel}</Text>
      <Text style={{ color: UI.text, fontSize: sz, fontWeight: "700", textAlign: "center" }} numberOfLines={1}>
        {p.jerseyNumber ? `#${p.jerseyNumber}` : p.playerName?.split(" ")[0] || "—"}
      </Text>
      {p.position && <Text style={{ color: teamColor, fontSize: 8, fontWeight: "600" }}>{p.position}</Text>}
    </View>
  );

  return (
    <View style={{ backgroundColor: softCard, borderRadius: 10, borderWidth: 1, borderColor: softBorder, overflow: "hidden" }}>
      <View style={{ alignItems: "center", paddingVertical: 3, backgroundColor: netBg }}>
        <Text style={{ color: UI.textMuted, fontSize: 8, fontWeight: "700", letterSpacing: 2 }}>NET</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 4, padding: 4 }}>
        {frontRow.map((p) => (
          <View key={`${p.playerId || p.posLabel}-${p.zoneLabel}`} style={{ flex: 1 }}>
            {renderCell(p, false)}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 4, padding: 4, paddingTop: 0 }}>
        {backRow.map((p, i) => (
          <View key={`${p.playerId || p.posLabel}-${p.zoneLabel}`} style={{ flex: 1 }}>
            {renderCell(p, i === 2 && servingTeam)}
          </View>
        ))}
      </View>
      {libero && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingBottom: 6 }}>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#9333ea", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 7, fontWeight: "800" }}>L</Text>
          </View>
          <Text style={{ color: UI.isDark ? "#c084fc" : "#7E22CE", fontSize: 10, fontWeight: "600" }}>
            {libero.playerName || "Libero"}
          </Text>
        </View>
      )}
    </View>
  );
}

export default VolleyballCourtView;

import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

const SIZE = 200;
const CX = SIZE / 2;
const CY = SIZE / 2 + 10;
const R = 72;

const ZONES = [
  { key: "off", label: "Off", angle: -50, color: "#0ea5e9" },
  { key: "straight", label: "Straight", angle: 0, color: "#4ade80" },
  { key: "leg", label: "Leg", angle: 50, color: "#f59e0b" },
];

const polarToXY = (angleDeg, radius) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
};

export default function WagonWheel({ zones = {}, compact = false }) {
  const size = compact ? 160 : SIZE;

  const zoneData = useMemo(() => {
    const maxRuns = Math.max(...ZONES.map((z) => zones[z.key]?.runs || 0), 1);
    return ZONES.map((z) => ({
      ...z,
      runs: zones[z.key]?.runs || 0,
      boundaries: zones[z.key]?.boundaries || 0,
      pct: (zones[z.key]?.runs || 0) / maxRuns,
    }));
  }, [zones]);

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle cx={CX} cy={CY} r={R + 8} fill="#1a2332" stroke="#334155" strokeWidth={1} />
        <Circle cx={CX} cy={CY} r={R} fill="#0f172a" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        {/* Pitch */}
        <Rect cx={CX - 3} cy={CY - 18} width={6} height={36} fill="#8B6914" x={CX - 3} y={CY - 18} />
        <Line x1={CX} y1={CY - 18} x2={CX} y2={CY + 18} stroke="#a07818" strokeWidth={4} />

        {zoneData.map((z) => {
          const innerR = 12 + z.pct * (R - 20);
          const end = polarToXY(z.angle, innerR);
          return (
            <G key={z.key}>
              <Line x1={CX} y1={CY} x2={end.x} y2={end.y} stroke={z.color} strokeWidth={3 + z.pct * 8} strokeLinecap="round" opacity={0.85} />
              {z.boundaries > 0 ? (
                <Circle cx={end.x} cy={end.y} r={4 + z.boundaries} fill={z.color} opacity={0.9} />
              ) : null}
              <SvgText
                x={polarToXY(z.angle, R + 14).x}
                y={polarToXY(z.angle, R + 14).y}
                fill="#94A3B8"
                fontSize={8}
                fontWeight="700"
                textAnchor="middle"
              >
                {z.label}
              </SvgText>
            </G>
          );
        })}

        {/* Field arc */}
        <Path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="rgba(74,222,128,0.2)"
          strokeWidth={1}
          strokeDasharray="4,3"
        />
      </Svg>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {zoneData.map((z) => (
          <View key={z.key} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: z.color }} />
            <Text style={{ color: "#9CA3AF", fontSize: 10 }}>
              {z.label}: {z.runs}r{z.boundaries > 0 ? ` (${z.boundaries}×4/6)` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
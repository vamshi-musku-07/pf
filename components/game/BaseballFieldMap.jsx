import { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from "react-native-svg";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

const POSITION_COORDS = {
  P:  { x: 150, y: 218 },
  C:  { x: 150, y: 305 },
  "1B": { x: 225, y: 210 },
  "2B": { x: 175, y: 155 },
  SS: { x: 115, y: 170 },
  "3B": { x: 72,  y: 210 },
  LF: { x: 50,  y: 85 },
  CF: { x: 150, y: 40 },
  RF: { x: 250, y: 85 },
};

const POSITION_KEYS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

export default function BaseballFieldMap({
  positions = [],
  onPositionTap,
  compact = false,
  highlightPosition,
}) {
  const UI = useGameScoringTheme();
  const positionMap = useMemo(() => {
    const map = {};
    for (const p of positions) {
      if (p.position) map[p.position] = p;
    }
    return map;
  }, [positions]);

  const size = compact ? 180 : 280;
  const markerR = compact ? 12 : 16;
  const fontSize = compact ? 7 : 9;
  const labelSize = compact ? 6 : 8;
  // Labels sit partly off the SVG onto the modal/card — white text vanishes in light theme.
  const nameLabelStyle = {
    fontSize: labelSize,
    color: UI.isDark ? "#FFFFFF" : "#0F172A",
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: UI.isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: UI.isDark ? 3 : 2,
  };
  const namePillStyle = {
    backgroundColor: UI.isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.95)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: UI.isDark ? 0 : 1,
    borderColor: "rgba(15,23,42,0.12)",
  };

  const svgHeight = size * 1.12;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: svgHeight, position: "relative" }}>
      <Svg width={size} height={svgHeight} viewBox="0 0 300 336">
        {/* Outfield grass */}
        <Path
          d="M 150 280 L 10 120 Q 10 5 150 5 Q 290 5 290 120 Z"
          fill="#1a5e2a"
          stroke="#2d8a42"
          strokeWidth={1}
        />

        {/* Infield dirt */}
        <Polygon
          points="150,275 230,210 150,145 70,210"
          fill="#8B6914"
          stroke="#a07818"
          strokeWidth={1}
        />

        {/* Infield grass (center) */}
        <Ellipse cx={150} cy={200} rx={38} ry={32} fill="#1f6b30" />

        {/* Pitcher's mound */}
        <Circle cx={150} cy={218} r={6} fill="#a07818" stroke="#8B6914" strokeWidth={1} />

        {/* Base paths */}
        <Line x1={150} y1={275} x2={230} y2={210} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
        <Line x1={230} y1={210} x2={150} y2={145} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
        <Line x1={150} y1={145} x2={70} y2={210} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
        <Line x1={70} y1={210} x2={150} y2={275} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />

        {/* Bases */}
        <Rect x={146} y={271} width={8} height={8} fill="#fff" transform="rotate(45,150,275)" />
        <Rect x={226} y={206} width={8} height={8} fill="#fff" transform="rotate(45,230,210)" />
        <Rect x={146} y={141} width={8} height={8} fill="#fff" transform="rotate(45,150,145)" />
        <Rect x={66} y={206} width={8} height={8} fill="#fff" transform="rotate(45,70,210)" />

        {/* Foul lines */}
        <Line x1={150} y1={280} x2={5} y2={130} stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="4,3" />
        <Line x1={150} y1={280} x2={295} y2={130} stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="4,3" />

        {/* Outfield fence arc */}
        <Path
          d="M 10 120 Q 10 10 150 10 Q 290 10 290 120"
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={2}
        />

        {/* Position markers */}
        {POSITION_KEYS.map((posKey) => {
          const coord = POSITION_COORDS[posKey];
          const player = positionMap[posKey];
          const isHighlighted = highlightPosition === posKey;
          const filled = !!player;

          return (
            <Circle
              key={posKey}
              cx={coord.x}
              cy={coord.y}
              r={markerR}
              fill={isHighlighted ? "rgba(250,204,21,0.9)" : filled ? "rgba(59,130,246,0.85)" : "rgba(75,85,99,0.7)"}
              stroke={isHighlighted ? "#facc15" : filled ? "#60a5fa" : "#9CA3AF"}
              strokeWidth={1.5}
            />
          );
        })}
      </Svg>

      {/* Overlay text labels (RN Text on top of SVG, absolutely positioned) */}
      <View style={{ position: "absolute", top: 0, left: 0, width: size, height: svgHeight }}>
        {POSITION_KEYS.map((posKey) => {
          const coord = POSITION_COORDS[posKey];
          const player = positionMap[posKey];
          const scaleX = size / 300;
          const scaleY = svgHeight / 336;
          const cx = coord.x * scaleX;
          const cy = coord.y * scaleY;

          const content = (
            <View
              style={{
                position: "absolute",
                left: cx - markerR,
                top: cy - markerR,
                width: markerR * 2,
                height: markerR * 2,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize, color: "#fff", fontWeight: "900", textAlign: "center" }} numberOfLines={1}>
                {player?.jerseyNumber != null ? player.jerseyNumber : posKey}
              </Text>
            </View>
          );

          const label = (
            <View
              style={{
                position: "absolute",
                left: cx - 28,
                top: cy + markerR + 1,
                width: 56,
                alignItems: "center",
              }}
            >
              <View style={namePillStyle}>
                <Text style={nameLabelStyle} numberOfLines={1}>
                  {player ? `${player.firstName || ""}${player.lastName ? ` ${player.lastName[0]}.` : ""}`.trim() : posKey}
                </Text>
              </View>
            </View>
          );

          if (onPositionTap) {
            return (
              <TouchableOpacity
                key={posKey}
                activeOpacity={0.6}
                onPress={() => onPositionTap(posKey)}
                style={{ position: "absolute", left: cx - markerR - 4, top: cy - markerR - 4, width: (markerR + 4) * 2, height: (markerR + 4) * 2 + labelSize + 10 }}
              >
                <View style={{ position: "relative", width: "100%", height: "100%" }}>
                  <View style={{ position: "absolute", left: 4, top: 4, width: markerR * 2, height: markerR * 2, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize, color: "#fff", fontWeight: "900", textAlign: "center" }} numberOfLines={1}>
                      {player?.jerseyNumber != null ? player.jerseyNumber : posKey}
                    </Text>
                  </View>
                  <View style={{ position: "absolute", left: 4 - 28 + markerR, top: 4 + markerR * 2 + 1, width: 56, alignItems: "center" }}>
                    <View style={namePillStyle}>
                      <Text style={nameLabelStyle} numberOfLines={1}>
                        {player ? `${player.firstName || ""}${player.lastName ? ` ${player.lastName[0]}.` : ""}`.trim() : posKey}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <View key={posKey}>
              {content}
              {label}
            </View>
          );
        })}
      </View>
      </View>
    </View>
  );
}

export { POSITION_KEYS, POSITION_COORDS };

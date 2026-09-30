import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";

const CHART_H = 140;
const PAD = { top: 12, right: 12, bottom: 24, left: 32 };

export default function WormChart({ data = [], totalOvers = 20, color = "#4ade80", height = CHART_H }) {
  const { points, maxY, width } = useMemo(() => {
    const w = 300;
    const series = data.length > 0 ? data : [{ over: 0, runs: 0 }];
    const maxRuns = Math.max(...series.map((d) => d.runs), 1);
    const maxX = Math.max(totalOvers, ...series.map((d) => d.over), 1);
    const innerW = w - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;

    const pts = series.map((d) => {
      const x = PAD.left + (d.over / maxX) * innerW;
      const y = PAD.top + innerH - (d.runs / maxRuns) * innerH;
      return { x, y, ...d };
    });

    return { points: pts, maxY: maxRuns, width: w };
  }, [data, totalOvers, height]);

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = PAD.top + (height - PAD.top - PAD.bottom) * (1 - frac);
          return (
            <Line
              key={frac}
              x1={PAD.left}
              y1={y}
              x2={width - PAD.right}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          );
        })}
        <Polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.filter((_, i) => i === 0 || i === points.length - 1 || i % 3 === 0).map((p) => (
          <Circle key={`${p.over}-${p.runs}`} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
        <SvgText x={PAD.left} y={height - 4} fill="#6B7280" fontSize={9} fontWeight="600">
          0 ov
        </SvgText>
        <SvgText x={width - PAD.right - 20} y={height - 4} fill="#6B7280" fontSize={9} fontWeight="600">
          {totalOvers} ov
        </SvgText>
        <SvgText x={4} y={PAD.top + 4} fill="#6B7280" fontSize={9}>
          {maxY}
        </SvgText>
      </Svg>
      <Text style={{ color: "#6B7280", fontSize: 10, textAlign: "center", marginTop: 2 }}>
        Cumulative runs
      </Text>
    </View>
  );
}

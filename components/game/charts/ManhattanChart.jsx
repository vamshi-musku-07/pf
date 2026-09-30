import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

const CHART_H = 140;
const PAD = { top: 12, right: 8, bottom: 24, left: 8 };

export default function ManhattanChart({ data = [], color = "#60a5fa", height = CHART_H }) {
  const { bars, maxY, width } = useMemo(() => {
    const w = 300;
    const series = data.length > 0 ? data : [];
    const maxRuns = Math.max(...series.map((d) => d.runs), 1);
    const count = Math.max(series.length, 1);
    const innerW = w - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const barW = Math.max(4, Math.min(20, innerW / count - 2));

    const barsData = series.map((d, i) => {
      const slotW = innerW / count;
      const x = PAD.left + i * slotW + (slotW - barW) / 2;
      const barH = (d.runs / maxRuns) * innerH;
      const y = PAD.top + innerH - barH;
      return { x, y, barH, barW, ...d };
    });

    return { bars: barsData, maxY: maxRuns, width: w };
  }, [data, height]);

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line
          x1={PAD.left}
          y1={height - PAD.bottom}
          x2={width - PAD.right}
          y2={height - PAD.bottom}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />
        {bars.map((b) => (
          <React.Fragment key={`bar-${b.over}`}>
            <Rect
              x={b.x}
              y={b.y}
              width={b.barW}
              height={Math.max(b.barH, b.runs > 0 ? 2 : 0)}
              fill={b.runs >= 15 ? "#f87171" : b.runs >= 10 ? color : `${color}99`}
              rx={2}
            />
            {b.runs > 0 && b.barH > 14 ? (
              <SvgText
                x={b.x + b.barW / 2}
                y={b.y + 10}
                fill="#fff"
                fontSize={7}
                fontWeight="700"
                textAnchor="middle"
              >
                {b.runs}
              </SvgText>
            ) : null}
          </React.Fragment>
        ))}
        <SvgText x={width / 2 - 20} y={height - 4} fill="#6B7280" fontSize={9} fontWeight="600">
          Runs per over
        </SvgText>
      </Svg>
      <Text style={{ color: "#6B7280", fontSize: 10, textAlign: "center", marginTop: 2 }}>
        Peak: {maxY} runs in one over
      </Text>
    </View>
  );
}

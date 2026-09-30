import React, { useMemo } from "react";
import { View, Text } from "react-native";

const COLORS = ["#4ade80", "#60a5fa", "#f59e0b", "#f87171", "#a78bfa", "#34d399", "#fb923c"];

export default function PartnershipTimeline({ partnerships = [] }) {
  const { segments, total } = useMemo(() => {
    const list = partnerships.filter((p) => p.runs > 0);
    const sum = list.reduce((s, p) => s + p.runs, 0) || 1;
    return { segments: list, total: sum };
  }, [partnerships]);

  if (segments.length === 0) {
    return (
      <Text style={{ color: "#6B7280", fontSize: 12, textAlign: "center", paddingVertical: 16 }}>
        Partnership data will appear as wickets fall
      </Text>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: "row", height: 28, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
        {segments.map((p, i) => (
          <View
            key={`${p.wicket}-${p.runs}`}
            style={{
              flex: p.runs / total,
              backgroundColor: COLORS[i % COLORS.length],
              minWidth: p.runs > 0 ? 8 : 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {p.runs / total > 0.12 ? (
              <Text style={{ color: "#0f1223", fontSize: 9, fontWeight: "800" }}>{p.runs}</Text>
            ) : null}
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        {segments.map((p, i) => (
          <View key={`row-${p.wicket}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS[i % COLORS.length] }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#E5E7EB", fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                {p.label}{p.notOut ? " *" : ""}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: 10 }}>
                {p.runs}({p.balls}) · RR {p.runRate}
              </Text>
            </View>
            <Text style={{ color: "#9CA3AF", fontSize: 11, fontWeight: "700" }}>
              {((p.runs / total) * 100).toFixed(0)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

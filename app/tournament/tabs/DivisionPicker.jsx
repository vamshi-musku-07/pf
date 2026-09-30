import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { sortDivisions, formatDivisionDisplayName } from "@/features/tournament/helpers";

export default function DivisionPicker({
  divisions = [],
  selectedId,
  onSelect,
  teamCounts = {},
  sport,
}) {
  const sorted = sortDivisions(divisions);
  if (sorted.length <= 1) return null;

  return (
    <View style={{ backgroundColor: "#0B1324", paddingBottom: 8, paddingTop: 0 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
      >
        {sorted.map((div) => {
          const active = String(selectedId) === String(div.id);
          const count = teamCounts[div.id] ?? (div.teamIds || []).length ?? 0;
          const label = formatDivisionDisplayName(div, sport);
          return (
            <TouchableOpacity
              key={div.id}
              onPress={() => onSelect(String(div.id))}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? "#BAF072" : "rgba(255,255,255,0.08)",
                borderWidth: 1,
                borderColor: active ? "#BAF072" : "rgba(255,255,255,0.12)",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: active ? "#0B1324" : "#CBD5E1",
                }}
                numberOfLines={1}
              >
                {label}
                {count > 0 ? ` (${count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

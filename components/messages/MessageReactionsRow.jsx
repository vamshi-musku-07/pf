import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getReactionByKey, resolveReactionKey } from "@/constants/messageReactions";
import { formatReactionCount, groupMessageReactions } from "@/lib/messageReactions";
import AnimatedEmoji from "./AnimatedEmoji";

export default function MessageReactionsRow({
  reactions = [],
  currentUserId,
  onToggle,
  align = "left",
  isDark = false,
}) {
  const grouped = groupMessageReactions(reactions, currentUserId);
  if (!grouped.length) return null;

  return (
    <View style={[styles.row, align === "right" ? styles.rowRight : styles.rowLeft]}>
      {grouped.map((item) => {
        const resolvedKey = resolveReactionKey(item.key);
        const meta = getReactionByKey(resolvedKey);
        if (!meta) return null;
        const countLabel = formatReactionCount(item.count);
        return (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.85}
            onPress={() => onToggle?.(item.key)}
            style={[
              styles.chip,
              item.mine && styles.chipMine,
              isDark && styles.chipDark,
              isDark && item.mine && styles.chipMineDark,
            ]}
          >
            <AnimatedEmoji reactionKey={resolvedKey} size={26} loop />
            {countLabel ? (
              <Text
                style={[
                  styles.count,
                  item.mine && styles.countMine,
                  isDark && styles.countDark,
                  isDark && item.mine && styles.countMineDark,
                ]}
              >
                {countLabel}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    maxWidth: "100%",
  },
  rowLeft: {
    justifyContent: "flex-start",
  },
  rowRight: {
    justifyContent: "flex-end",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chipDark: {
    backgroundColor: "#1E1E24",
    borderColor: "#2A2A2E",
    shadowOpacity: 0,
    elevation: 0,
  },
  chipMine: {
    backgroundColor: "#F0FDF4",
    borderColor: "#9AEA62",
  },
  chipMineDark: {
    backgroundColor: "rgba(154,234,98,0.14)",
    borderColor: "#9AEA62",
  },
  count: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    minWidth: 12,
    textAlign: "center",
  },
  countDark: {
    color: "#A1A1AA",
  },
  countMine: {
    color: "#081126",
  },
  countMineDark: {
    color: "#F5F5F7",
  },
});

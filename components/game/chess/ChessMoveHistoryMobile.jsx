import { useEffect, useMemo, useRef } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

function ChessMoveHistoryMobile({
  moves = [],
  currentMoveNumber = 0,
  opening = null,
  onMovePress,
}) {
  const scrollRef = useRef(null);

  const movePairs = useMemo(() => {
    const pairs = [];
    for (let index = 0; index < moves.length; index += 2) {
      pairs.push({
        number: Math.floor(index / 2) + 1,
        white: moves[index] || null,
        black: moves[index + 1] || null,
        whiteIndex: index,
        blackIndex: index + 1,
      });
    }
    return pairs;
  }, [moves]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [moves.length]);

  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: "rgba(15,23,42,0.55)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.06)",
        }}
      >
        <Text
          style={{
            color: "#cbd5e1",
            fontSize: 11,
            fontWeight: "800",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Move History
        </Text>
        <Text style={{ color: "#64748b", fontSize: 11 }}>
          {moves.length} move{moves.length === 1 ? "" : "s"}
        </Text>
      </View>

      {opening?.name ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255,255,255,0.05)",
            backgroundColor: "rgba(245,158,11,0.08)",
          }}
        >
          <Text style={{ color: "#fbbf24", fontSize: 12, fontWeight: "700" }}>
            {opening.eco ? `${opening.eco} ` : ""}
            {opening.name}
          </Text>
        </View>
      ) : null}

      {moves.length === 0 ? (
        <View style={{ paddingVertical: 28, alignItems: "center" }}>
          <Text style={{ color: "#64748b", fontSize: 13 }}>No moves yet</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ maxHeight: 260 }}
          contentContainerStyle={{ paddingVertical: 8 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {movePairs.map((pair) => {
            const whiteActive = pair.whiteIndex === currentMoveNumber - 1;
            const blackActive = pair.blackIndex === currentMoveNumber - 1;

            return (
              <View
                key={pair.number}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    width: 30,
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: "700",
                    textAlign: "right",
                    marginRight: 8,
                  }}
                >
                  {pair.number}.
                </Text>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => onMovePress?.(pair.whiteIndex)}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginRight: 6,
                    backgroundColor: whiteActive
                      ? "rgba(154,234,98,0.14)"
                      : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: whiteActive ? "#9AEA62" : "#e2e8f0",
                      fontSize: 13,
                      fontWeight: whiteActive ? "800" : "600",
                    }}
                  >
                    {pair.white || ""}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={pair.black ? 0.8 : 1}
                  disabled={!pair.black}
                  onPress={() => pair.black && onMovePress?.(pair.blackIndex)}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    backgroundColor: blackActive
                      ? "rgba(154,234,98,0.14)"
                      : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: blackActive
                        ? "#9AEA62"
                        : pair.black
                          ? "#e2e8f0"
                          : "transparent",
                      fontSize: 13,
                      fontWeight: blackActive ? "800" : "600",
                    }}
                  >
                    {pair.black || "."}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export default ChessMoveHistoryMobile;

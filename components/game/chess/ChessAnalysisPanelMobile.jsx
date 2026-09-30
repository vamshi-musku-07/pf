import { useMemo } from "react";
import { Text, View } from "react-native";
import {
  FILES,
  PIECE_VALUES,
  createChessEngine,
  getAllLegalMoves,
  getGameStatus,
  getMaterialBalance,
  getMaterialFromFEN,
} from "@/lib/chessUtils";

const CENTER_BONUS = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 0, 2, 3, 3, 2, 0, 0],
  [0, 0, 2, 3, 3, 2, 0, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const evaluatePosition = (fen) => {
  const game = createChessEngine(fen);
  const status = getGameStatus(fen);

  if (status.isCheckmate) return status.turn === "white" ? -9999 : 9999;
  if (status.isStalemate || status.isDraw) return 0;

  const board = game.board();
  let score = 0;

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const square = board[rank][file];
      if (!square) continue;

      const value = PIECE_VALUES[square.type === "n" ? "knight" : square.type === "b" ? "bishop" : square.type === "r" ? "rook" : square.type === "q" ? "queen" : square.type === "k" ? "king" : "pawn"] || 0;
      const center = CENTER_BONUS[rank][file] * (square.type === "n" || square.type === "b" ? 0.18 : 0.08);
      const delta = value + center;
      score += square.color === "w" ? delta : -delta;
    }
  }

  return Math.round(score * 10) / 10;
};

function MetricCard({ label, value, accent = "#f8fafc" }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        padding: 12,
      }}
    >
      <Text
        style={{
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: accent,
          fontSize: 22,
          fontWeight: "900",
          marginTop: 8,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ChessAnalysisPanelMobile({ fen, isOwner = false }) {
  const status = useMemo(() => getGameStatus(fen), [fen]);
  const legalMoves = useMemo(() => getAllLegalMoves(fen), [fen]);
  const evaluation = useMemo(() => evaluatePosition(fen), [fen]);
  const material = useMemo(() => getMaterialFromFEN(fen), [fen]);
  const materialBalance = useMemo(
    () => getMaterialBalance(material.white, material.black),
    [material],
  );

  const bestMoves = useMemo(() => {
    if (!isOwner || legalMoves.length === 0) return [];

    const isWhiteTurn = fen.split(" ")[1] === "w";
    const ranked = legalMoves.map((move) => {
      const engine = createChessEngine(fen);
      engine.move(move);
      return {
        san: move.san,
        from: move.from,
        to: move.to,
        eval: evaluatePosition(engine.fen()),
      };
    });

    ranked.sort((left, right) =>
      isWhiteTurn ? right.eval - left.eval : left.eval - right.eval,
    );

    return ranked.slice(0, 3);
  }, [fen, isOwner, legalMoves]);

  const evalLabel =
    evaluation > 1
      ? "White edge"
      : evaluation < -1
        ? "Black edge"
        : "Balanced";

  return (
    <View
      style={{
        borderRadius: 18,
        backgroundColor: "rgba(15,23,42,0.55)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        padding: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <Text style={{ color: "#f8fafc", fontSize: 17, fontWeight: "900" }}>
          Analysis
        </Text>
        <View style={{ flexDirection: "row" }}>
          {status.isCheck ? (
            <View
              style={{
                borderRadius: 999,
                backgroundColor: "rgba(239,68,68,0.18)",
                paddingHorizontal: 10,
                paddingVertical: 5,
                marginLeft: 8,
              }}
            >
              <Text style={{ color: "#fca5a5", fontSize: 11, fontWeight: "800" }}>
                Check
              </Text>
            </View>
          ) : null}
          {status.isCheckmate ? (
            <View
              style={{
                borderRadius: 999,
                backgroundColor: "rgba(245,158,11,0.18)",
                paddingHorizontal: 10,
                paddingVertical: 5,
                marginLeft: 8,
              }}
            >
              <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "800" }}>
                Mate
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: "row", marginBottom: 12 }}>
        <MetricCard
          label="Eval"
          value={`${evaluation > 0 ? "+" : ""}${evaluation.toFixed(1)}`}
          accent={evaluation >= 0 ? "#9AEA62" : "#f87171"}
        />
        <View style={{ width: 10 }} />
        <MetricCard
          label="Turn"
          value={status.turn === "white" ? "White" : "Black"}
          accent={status.turn === "white" ? "#ffffff" : "#cbd5e1"}
        />
      </View>

      <View style={{ flexDirection: "row", marginBottom: 12 }}>
        <MetricCard
          label="Legal Moves"
          value={String(legalMoves.length)}
          accent="#60a5fa"
        />
        <View style={{ width: 10 }} />
        <MetricCard
          label="Material"
          value={materialBalance > 0 ? `+${materialBalance}` : String(materialBalance)}
          accent={materialBalance >= 0 ? "#fbbf24" : "#f87171"}
        />
      </View>

      <View
        style={{
          borderRadius: 14,
          backgroundColor: "rgba(255,255,255,0.04)",
          padding: 12,
          marginBottom: bestMoves.length > 0 ? 12 : 0,
        }}
      >
        <Text style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>
          {evalLabel}
        </Text>
        <Text style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 18 }}>
          White: P{material.white.pawns} N{material.white.knights} B{material.white.bishops} R{material.white.rooks} Q{material.white.queens}
        </Text>
        <Text style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 18, marginTop: 4 }}>
          Black: P{material.black.pawns} N{material.black.knights} B{material.black.bishops} R{material.black.rooks} Q{material.black.queens}
        </Text>
      </View>

      {bestMoves.length > 0 ? (
        <View>
          <Text
            style={{
              color: "#94a3b8",
              fontSize: 11,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 8,
            }}
          >
            Best Moves
          </Text>
          {bestMoves.map((move, index) => (
            <View
              key={`${move.from}-${move.to}-${index}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.04)",
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: index === bestMoves.length - 1 ? 0 : 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor:
                      index === 0
                        ? "rgba(154,234,98,0.2)"
                        : index === 1
                          ? "rgba(96,165,250,0.18)"
                          : "rgba(255,255,255,0.06)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <Text
                    style={{
                      color: index === 0 ? "#9AEA62" : index === 1 ? "#60a5fa" : "#cbd5e1",
                      fontSize: 11,
                      fontWeight: "900",
                    }}
                  >
                    {index + 1}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: "#f8fafc", fontSize: 14, fontWeight: "800" }}>
                    {move.san}
                  </Text>
                  <Text style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
                    {move.from} to {move.to}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  color: move.eval >= 0 ? "#9AEA62" : "#f87171",
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {move.eval > 0 ? "+" : ""}
                {move.eval.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default ChessAnalysisPanelMobile;

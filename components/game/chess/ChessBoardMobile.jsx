import { memo, useMemo } from "react";
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Line, Polygon, Rect } from "react-native-svg";
import {
  FILES,
  PIECES,
  RANKS,
  getLegalMovesForSquare,
  getPieceColor,
  parseFEN,
  squareToCoords,
} from "@/lib/chessUtils";

const LIGHT_SQUARE = "#EBECD0";
const DARK_SQUARE = "#779556";

const overlayRect = (square, flipped, color, opacity = 0.55) => {
  const coords = squareToCoords(square, flipped);
  return (
    <Rect
      key={`${square}-${color}`}
      x={coords.x - 0.5}
      y={coords.y - 0.5}
      width={1}
      height={1}
      fill={color}
      opacity={opacity}
    />
  );
};

const Arrow = memo(function Arrow({ from, to, color = "rgba(0,180,0,0.72)", flipped }) {
  const start = squareToCoords(from, flipped);
  const end = squareToCoords(to, flipped);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const headLength = 0.32;
  const ux = dx / length;
  const uy = dy / length;
  const endX = end.x - ux * headLength * 0.45;
  const endY = end.y - uy * headLength * 0.45;

  return (
    <>
      <Line
        x1={start.x}
        y1={start.y}
        x2={endX}
        y2={endY}
        stroke={color}
        strokeWidth={0.15}
        strokeLinecap="round"
        opacity={0.9}
      />
      <Polygon
        points={[
          `${end.x},${end.y}`,
          `${end.x - ux * headLength + uy * headLength * 0.48},${end.y - uy * headLength - ux * headLength * 0.48}`,
          `${end.x - ux * headLength - uy * headLength * 0.48},${end.y - uy * headLength + ux * headLength * 0.48}`,
        ].join(" ")}
        fill={color}
        opacity={0.9}
      />
    </>
  );
});

function PromotionModal({
  visible,
  color,
  onSelect,
  onCancel,
}) {
  const pieces =
    color === "white"
      ? [
          { code: "Q", value: "q" },
          { code: "R", value: "r" },
          { code: "B", value: "b" },
          { code: "N", value: "n" },
        ]
      : [
          { code: "q", value: "q" },
          { code: "r", value: "r" },
          { code: "b", value: "b" },
          { code: "n", value: "n" },
        ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 320,
            borderRadius: 20,
            backgroundColor: "#151a2f",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
            padding: 18,
          }}
        >
          <Text
            style={{
              color: "#f8fafc",
              fontSize: 18,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            Choose Promotion
          </Text>
          <Text
            style={{
              color: "#94a3b8",
              fontSize: 12,
              textAlign: "center",
              marginTop: 6,
              marginBottom: 16,
            }}
          >
            Select the piece for this pawn promotion.
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {pieces.map((piece) => (
              <TouchableOpacity
                key={piece.code}
                onPress={() => onSelect?.(piece.value)}
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 34, color: piece.code === piece.code.toUpperCase() ? "#f8fafc" : "#111827" }}>
                  {PIECES[piece.code]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={onCancel}
            style={{
              marginTop: 16,
              alignSelf: "center",
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Text style={{ color: "#e2e8f0", fontWeight: "700" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ChessBoardMobile({
  fen,
  flipped = false,
  lastMove = null,
  isCheck = false,
  currentTurn = "white",
  onSquarePress,
  selectedSquare = null,
  isInteractive = false,
  arrows = [],
  highlights = [],
  annotationAnchor = null,
  showPromotion = false,
  promotionColor = "white",
  onPromotionSelect,
  onPromotionCancel,
}) {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(Math.max(width - 32, 280), 420);
  const squareSize = boardSize / 8;

  const board = useMemo(() => parseFEN(fen), [fen]);
  const legalMoves = useMemo(() => {
    if (!selectedSquare || !isInteractive) return [];
    return getLegalMovesForSquare(fen, selectedSquare);
  }, [fen, selectedSquare, isInteractive]);

  const kingPosition = useMemo(() => {
    if (!isCheck) return null;
    const kingChar = currentTurn === "white" ? "K" : "k";

    for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
      for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
        if (board[rankIndex]?.[fileIndex] === kingChar) {
          return `${FILES[fileIndex]}${8 - rankIndex}`;
        }
      }
    }

    return null;
  }, [board, currentTurn, isCheck]);

  const renderSquare = (rankIndex, fileIndex) => {
    const actualRankIndex = flipped ? 7 - rankIndex : rankIndex;
    const actualFileIndex = flipped ? 7 - fileIndex : fileIndex;
    const square = `${FILES[actualFileIndex]}${8 - actualRankIndex}`;
    const piece = board[actualRankIndex]?.[actualFileIndex];
    const isLight = (actualRankIndex + actualFileIndex) % 2 === 0;
    const isSelected = square === selectedSquare;
    const isMoveTarget = legalMoves.includes(square);
    const isLastMove = lastMove && (square === lastMove.from || square === lastMove.to);
    const isCheckedKing = isCheck && square === kingPosition;
    const isAnnotationAnchor = square === annotationAnchor;

    let backgroundColor = isLight ? LIGHT_SQUARE : DARK_SQUARE;
    if (isLastMove) {
      backgroundColor = isLight ? "#F7E08A" : "#B89B2B";
    }
    if (isSelected) {
      backgroundColor = "#E8C547";
    }
    if (isCheckedKing) {
      backgroundColor = "#D94B4B";
    }
    if (isAnnotationAnchor) {
      backgroundColor = "#60A5FA";
    }

    const showFileLabel = flipped ? rankIndex === 0 : rankIndex === 7;
    const showRankLabel = flipped ? fileIndex === 7 : fileIndex === 0;

    return (
      <TouchableOpacity
        key={square}
        activeOpacity={isInteractive ? 0.86 : 1}
        disabled={!isInteractive}
        onPress={() => onSquarePress?.(square, piece)}
        style={{
          width: squareSize,
          height: squareSize,
          backgroundColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {piece ? (
          <Text
            style={{
              fontSize: squareSize * 0.66,
              lineHeight: squareSize * 0.72,
              color: getPieceColor(piece) === "white" ? "#ffffff" : "#111827",
              textShadowColor:
                getPieceColor(piece) === "white"
                  ? "rgba(15,23,42,0.8)"
                  : "rgba(255,255,255,0.35)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
          >
            {PIECES[piece]}
          </Text>
        ) : null}

        {isMoveTarget && !piece ? (
          <View
            style={{
              position: "absolute",
              width: squareSize * 0.24,
              height: squareSize * 0.24,
              borderRadius: squareSize * 0.12,
              backgroundColor: "rgba(17,24,39,0.24)",
            }}
          />
        ) : null}

        {isMoveTarget && piece ? (
          <View
            style={{
              position: "absolute",
              width: squareSize * 0.84,
              height: squareSize * 0.84,
              borderRadius: squareSize * 0.42,
              borderWidth: 3,
              borderColor: "rgba(17,24,39,0.2)",
            }}
          />
        ) : null}

        {showFileLabel ? (
          <Text
            style={{
              position: "absolute",
              bottom: 2,
              right: 4,
              fontSize: 10,
              fontWeight: "800",
              color: isLight ? DARK_SQUARE : LIGHT_SQUARE,
            }}
          >
            {FILES[actualFileIndex]}
          </Text>
        ) : null}

        {showRankLabel ? (
          <Text
            style={{
              position: "absolute",
              top: 2,
              left: 4,
              fontSize: 10,
              fontWeight: "800",
              color: isLight ? DARK_SQUARE : LIGHT_SQUARE,
            }}
          >
            {8 - actualRankIndex}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: boardSize,
          height: boardSize,
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: 2,
          borderColor: "rgba(148,163,184,0.25)",
          backgroundColor: "#111827",
        }}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {RANKS.map((_, rankIndex) =>
            FILES.map((__, fileIndex) => renderSquare(rankIndex, fileIndex)),
          )}
        </View>

        <Svg
          pointerEvents="none"
          width={boardSize}
          height={boardSize}
          viewBox="0 0 8 8"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {highlights.map((item, index) =>
            overlayRect(
              item.square,
              flipped,
              item.color || "rgba(235, 97, 80, 0.55)",
              0.5,
            ),
          )}
          {arrows.map((arrow, index) => (
            <Arrow
              key={`${arrow.from}-${arrow.to}-${index}`}
              from={arrow.from}
              to={arrow.to}
              color={arrow.color}
              flipped={flipped}
            />
          ))}
        </Svg>
      </View>

      <PromotionModal
        visible={showPromotion}
        color={promotionColor}
        onSelect={onPromotionSelect}
        onCancel={onPromotionCancel}
      />
    </View>
  );
}

export default memo(ChessBoardMobile);

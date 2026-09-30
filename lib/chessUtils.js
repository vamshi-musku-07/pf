import { Chess } from "@/lib/vendor/chess";

export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const PIECES = {
  K: "\u2654",
  Q: "\u2655",
  R: "\u2656",
  B: "\u2657",
  N: "\u2658",
  P: "\u2659",
  k: "\u265a",
  q: "\u265b",
  r: "\u265c",
  b: "\u265d",
  n: "\u265e",
  p: "\u265f",
};

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

export const PIECE_VALUES = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

const PIECE_NAME_MAP = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const PIECE_TYPE_MAP = {
  pawn: "p",
  knight: "n",
  bishop: "b",
  rook: "r",
  queen: "q",
  king: "k",
};

export const parseFEN = (fen = STARTING_FEN) => {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const [position] = fen.split(" ");
  const rows = position.split("/");

  rows.forEach((row, rankIndex) => {
    let fileIndex = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        fileIndex += Number(char);
      } else {
        board[rankIndex][fileIndex] = char;
        fileIndex += 1;
      }
    }
  });

  return board;
};

export const getPieceColor = (piece) => {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? "white" : "black";
};

export const createChessEngine = (fen = STARTING_FEN) => {
  try {
    return new Chess(fen);
  } catch {
    return new Chess();
  }
};

export const getLegalMovesForSquare = (fen, square) => {
  if (!square) return [];
  try {
    const engine = createChessEngine(fen);
    return engine
      .moves({ square, verbose: true })
      .map((move) => move.to);
  } catch {
    return [];
  }
};

export const getAllLegalMoves = (fen) => {
  try {
    const engine = createChessEngine(fen);
    return engine.moves({ verbose: true });
  } catch {
    return [];
  }
};

export const getGameStatus = (fen) => {
  const engine = createChessEngine(fen);
  return {
    isCheck: engine.isCheck(),
    isCheckmate: engine.isCheckmate(),
    isStalemate: engine.isStalemate(),
    isDraw: engine.isDraw(),
    isGameOver: engine.isGameOver(),
    isThreefoldRepetition: engine.isThreefoldRepetition(),
    isInsufficientMaterial: engine.isInsufficientMaterial(),
    turn: engine.turn() === "w" ? "white" : "black",
  };
};

export const formatTime = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "--:--";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const parseClockString = (clockString) => {
  if (!clockString || typeof clockString !== "string") return null;

  const parts = clockString.split(":").map(Number);
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
};

export const isPromotionMove = (fen, from, to) => {
  try {
    const engine = createChessEngine(fen);
    const moves = engine.moves({ square: from, verbose: true });
    return moves.some((move) => move.to === to && Boolean(move.promotion));
  } catch {
    return false;
  }
};

export const squareToCoords = (square, flipped = false) => {
  if (!square || square.length < 2) return { x: 0.5, y: 0.5 };
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - Number(square[1]);
  const x = flipped ? 7 - file : file;
  const y = flipped ? 7 - rank : rank;
  return { x: x + 0.5, y: y + 0.5 };
};

export const getMaterialFromFEN = (fen) => {
  const engine = createChessEngine(fen);
  const board = engine.board();
  const material = {
    white: { pawns: 0, knights: 0, bishops: 0, rooks: 0, queens: 0 },
    black: { pawns: 0, knights: 0, bishops: 0, rooks: 0, queens: 0 },
  };

  const pluralMap = {
    p: "pawns",
    n: "knights",
    b: "bishops",
    r: "rooks",
    q: "queens",
  };

  for (const row of board) {
    for (const square of row) {
      if (!square || !pluralMap[square.type]) continue;
      material[square.color === "w" ? "white" : "black"][pluralMap[square.type]] += 1;
    }
  }

  return material;
};

export const getMaterialScore = (material) =>
  Object.entries(PIECE_VALUES).reduce(
    (total, [pieceName, value]) =>
      total + (material?.[`${pieceName}s`] || material?.[pieceName] || 0) * value,
    0,
  );

export const getMaterialBalance = (materialWhite, materialBlack) =>
  getMaterialScore(materialWhite) - getMaterialScore(materialBlack);

export const getMaterialSummary = (material) => {
  if (!material) return "";

  return [
    `P${material.pawns ?? 0}`,
    `N${material.knights ?? 0}`,
    `B${material.bishops ?? 0}`,
    `R${material.rooks ?? 0}`,
    `Q${material.queens ?? 0}`,
  ].join(" ");
};

export const buildFenHistoryFromMoves = (
  moves = [],
  startingFen = STARTING_FEN,
) => {
  const history = [];
  const engine = createChessEngine(startingFen);

  for (const move of moves) {
    if (typeof move !== "string" || !move.trim()) continue;
    try {
      engine.move(move);
      history.push(engine.fen());
    } catch {
      break;
    }
  }

  return history;
};

export const getMoveEventType = (move) => {
  if (!move) return "move";
  const flags = move.flags || "";

  if (flags.includes("k")) return "castling_kingside";
  if (flags.includes("q")) return "castling_queenside";
  if (flags.includes("e")) return "en_passant";
  if (flags.includes("p")) return "promotion";
  if (flags.includes("c")) return "capture";
  return "move";
};

export const getAutomaticDrawEventType = (moveResult) => {
  if (!moveResult?.isDraw) return null;
  if (moveResult.isStalemate) return "stalemate";
  if (moveResult.isThreefoldRepetition) return "threefold_repetition";
  if (moveResult.isInsufficientMaterial) return "insufficient_material";
  return "fifty_move_rule";
};

export const tryMove = (fen, from, to, promotion = "q") => {
  const engine = createChessEngine(fen);

  try {
    const move = engine.move({ from, to, promotion });
    if (!move) return { success: false };

    const pieceName = PIECE_NAME_MAP[move.piece] || move.piece || null;
    const capturedPiece = PIECE_NAME_MAP[move.captured] || null;
    const promotionPiece =
      PIECE_NAME_MAP[move.promotion] || PIECE_NAME_MAP[promotion] || null;

    return {
      success: true,
      move,
      san: move.san,
      fen: engine.fen(),
      isCheck: engine.isCheck(),
      isCheckmate: engine.isCheckmate(),
      isStalemate: engine.isStalemate(),
      isDraw: engine.isDraw(),
      isGameOver: engine.isGameOver(),
      isThreefoldRepetition: engine.isThreefoldRepetition(),
      isInsufficientMaterial: engine.isInsufficientMaterial(),
      capturedPiece,
      flags: move.flags,
      pieceName,
      promotionPiece,
      color: move.color === "w" ? "white" : "black",
      eventType: getMoveEventType(move),
    };
  } catch {
    return { success: false };
  }
};

export const getPieceSymbolFromName = (pieceName, color = "white") => {
  const type = PIECE_TYPE_MAP[pieceName];
  if (!type) return null;
  const fenChar = color === "white" ? type.toUpperCase() : type;
  return PIECES[fenChar] || null;
};

/** Human-readable winner label from standard chess result notation (home = White). */
export const formatChessResultLabel = (gameResult, homeName = "Home", awayName = "Away") => {
  if (gameResult === "1-0") return `${homeName} wins`;
  if (gameResult === "0-1") return `${awayName} wins`;
  if (gameResult === "1/2-1/2") return "Draw";
  return null;
};

/** Resolve outcome from stored result or current FEN via chess.js. */
export const resolveChessOutcome = (sport = {}) => {
  const existing = sport.gameResult;
  if (existing === "1-0") return { winner: "home", gameResult: "1-0" };
  if (existing === "0-1") return { winner: "away", gameResult: "0-1" };
  if (existing === "1/2-1/2") return { winner: "draw", gameResult: "1/2-1/2" };

  const engine = createChessEngine(sport.fen || STARTING_FEN);
  if (engine.isCheckmate()) {
    const winnerColor = engine.turn() === "w" ? "black" : "white";
    return {
      winner: winnerColor === "white" ? "home" : "away",
      gameResult: winnerColor === "white" ? "1-0" : "0-1",
    };
  }
  if (engine.isDraw() || engine.isStalemate() || engine.isGameOver()) {
    return { winner: "draw", gameResult: "1/2-1/2" };
  }
  return { winner: "draw", gameResult: "1/2-1/2" };
};

/** Livestream / overlay label — no numeric 0-0 score for chess. */
export const getChessLivestreamLabel = (game, homeLabel = "Home", awayLabel = "Away") => {
  const sport = game?.sport || {};
  const base = game?.base || {};
  const gr = sport.gameResult;
  const finished = base.status === "finished" || sport.matchStatus === "final";
  if (finished || gr === "1-0" || gr === "0-1" || gr === "1/2-1/2") {
    return formatChessResultLabel(gr, homeLabel, awayLabel) || "Game finished";
  }
  const plyCount = sport.moves?.length || 0;
  const turn = sport.currentTurn === "black" ? "Black" : "White";
  return plyCount > 0 ? `${turn} to move · ${plyCount} moves` : `${turn} to move`;
};

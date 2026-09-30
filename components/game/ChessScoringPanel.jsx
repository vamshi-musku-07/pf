/**
 * ChessScoringPanelMobile
 * Production-level chess panel — Lichess / GameChanger style.
 * Board: 8 rows × 8 squares, tap-to-move, legal move dots, check highlight.
 * Coach (displayOnly): observe only — players move pieces on their devices.
 * No scoreboard. Includes: player strips, move history, navigation, resign/draw.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Chess } from "chess.js";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatChessResultLabel, resolveChessOutcome } from "@/lib/chessUtils";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

/** 3D raised look — keeps face colors; only adds depth rim + shadow. */
function raised3d(deep, isDark = true, extra = {}) {
  return {
    borderBottomWidth: 4,
    borderBottomColor: deep,
    shadowColor: isDark ? "#000" : "#64748B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.3 : 0.2,
    shadowRadius: 3,
    elevation: 5,
    ...extra,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

// Chess.com board palette
const SQ_LIGHT  = "#F0D9B5";
const SQ_DARK   = "#B58863";
const SQ_SEL    = "#F6F669";      // selected square
const SQ_LAST_L = "#CDD16A";     // last-move highlight (light sq)
const SQ_LAST_D = "#AAAA23";     // last-move highlight (dark sq)
const SQ_CHECK  = "#C84B31";     // king-in-check

// Unicode pieces — readable on all platforms
const GLYPHS = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const PIECE_NAMES = {
  p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
};

// Default material (full set)
const DEF_MAT = { pawns: 8, knights: 2, bishops: 2, rooks: 2, queens: 1 };

// ─── Engine helpers ───────────────────────────────────────────────────────────
function eng(fen) {
  try { return new Chess(fen || INITIAL_FEN); } catch { return new Chess(); }
}

function parseFEN(fen) {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));
  const [pos] = (fen || INITIAL_FEN).split(" ");
  pos.split("/").forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += +ch;
      else { board[r][f] = ch; f++; }
    }
  });
  return board;
}

function pieceColor(p) {
  if (!p) return null;
  return p === p.toUpperCase() ? "white" : "black";
}

function legalDests(fen, sq) {
  return eng(fen).moves({ square: sq, verbose: true }).map(m => m.to);
}

function needsPromotion(fen, from, to) {
  return eng(fen).moves({ square: from, verbose: true }).some(m => m.to === to && m.promotion);
}

function applyMove(fen, from, to, promo = "q") {
  const e = eng(fen);
  try {
    const m = e.move({ from, to, promotion: promo });
    if (!m) return null;
    let drawReason = null;
    if (e.isStalemate()) drawReason = "stalemate";
    else if (e.isThreefoldRepetition?.()) drawReason = "threefold_repetition";
    else if (e.isDrawByFiftyMoves?.()) drawReason = "fifty_move_rule";
    else if (e.isInsufficientMaterial?.()) drawReason = "insufficient_material";
    return {
      san: m.san, fen: e.fen(),
      isCheck: e.isCheck(), isCheckmate: e.isCheckmate(),
      isStalemate: e.isStalemate(), isDraw: e.isDraw(),
      drawReason,
      captured: m.captured || null, piece: m.piece || null,
    };
  } catch { return null; }
}

function gameStatus(fen) {
  const e = eng(fen);
  return {
    turn: e.turn() === "w" ? "white" : "black",
    isCheck: e.isCheck(), isCheckmate: e.isCheckmate(),
    isStalemate: e.isStalemate(), isDraw: e.isDraw(),
    isOver: e.isGameOver(),
  };
}

function findKing(board, color) {
  const k = color === "white" ? "K" : "k";
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++)
      if (board[r][f] === k) return `${FILES[f]}${8 - r}`;
  return null;
}

function replayToIndex(moves, idx) {
  try {
    const e = new Chess();
    for (let i = 0; i <= idx; i++) e.move(moves[i]);
    return e.fen();
  } catch { return INITIAL_FEN; }
}

function calcMaterial(fen) {
  const e = eng(fen);
  const board = e.board();
  const mat = {
    white: { pawns: 0, knights: 0, bishops: 0, rooks: 0, queens: 0 },
    black: { pawns: 0, knights: 0, bishops: 0, rooks: 0, queens: 0 },
  };
  const map = { p: "pawns", n: "knights", b: "bishops", r: "rooks", q: "queens" };
  for (const row of board)
    for (const sq of row)
      if (sq && map[sq.type])
        mat[sq.color === "w" ? "white" : "black"][map[sq.type]]++;
  return mat;
}

function materialAdv(myMat, oppMat) {
  const val = m => (m.queens ?? 0)*9 + (m.rooks ?? 0)*5 +
    (m.bishops ?? 0)*3 + (m.knights ?? 0)*3 + (m.pawns ?? 0);
  return val(myMat) - val(oppMat);
}

// ─── Promotion picker ─────────────────────────────────────────────────────────
const PROMO_PIECES = [
  { code: "q", label: "Queen" },
  { code: "r", label: "Rook" },
  { code: "b", label: "Bishop" },
  { code: "n", label: "Knight" },
];

function PromotionModal({ visible, color, onSelect, onCancel, UI }) {
  const glyphs = color === "white"
    ? { q: "♕", r: "♖", b: "♗", n: "♘" }
    : { q: "♛", r: "♜", b: "♝", n: "♞" };
  const modalBg = UI?.isDark ? "#1e1e2e" : UI?.card || "#FFFFFF";
  const modalBorder = UI?.isDark ? "rgba(255,255,255,0.15)" : UI?.border || "#E5E7EB";
  const titleColor = UI?.isDark ? "#E5E7EB" : UI?.text || "#111827";
  const chipBg = UI?.isDark ? "rgba(255,255,255,0.08)" : UI?.surfaceAlt || "#F3F4F6";
  const chipBorder = UI?.isDark ? "rgba(255,255,255,0.12)" : UI?.border || "#E5E7EB";
  const labelColor = UI?.isDark ? "#9CA3AF" : UI?.muted || "#6B7280";
  const cancelColor = UI?.isDark ? "#6B7280" : UI?.textMuted || "#9CA3AF";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        style={{ flex: 1, backgroundColor: UI?.overlay || "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center" }}
        onPress={onCancel}
      >
        <Pressable
          style={{
            backgroundColor: modalBg,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: modalBorder,
            minWidth: 280,
          }}
          onPress={e => e.stopPropagation?.()}
        >
          <Text style={{ color: titleColor, fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 16 }}>
            Promote Pawn
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            {PROMO_PIECES.map(p => (
              <TouchableOpacity
                key={p.code}
                onPress={() => onSelect(p.code)}
                style={{
                  alignItems: "center",
                  backgroundColor: chipBg,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderColor: chipBorder,
                }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 34, lineHeight: 40,
                  color: color === "white" ? (UI?.isDark ? "#FFFFFF" : "#111827") : "#111111",
                  textShadowColor: color === "white" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.2)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}>
                  {glyphs[p.code]}
                </Text>
                <Text style={{ color: labelColor, fontSize: 11, marginTop: 4 }}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onCancel} style={{ marginTop: 14, alignItems: "center" }}>
            <Text style={{ color: cancelColor, fontSize: 13 }}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatPlayerName(player) {
  if (!player) return "";
  const first = (player.firstName || player.name || "").trim();
  const last = (player.lastName || "").trim();
  if (first && last) return `${first} ${last}`;
  return first || last || "Player";
}

function formatSidePlayers(roster = [], teamName = "") {
  const list = (roster || []).filter(Boolean);
  if (!list.length) return teamName?.trim() || "Player";
  if (list.length === 1) return formatPlayerName(list[0]);
  if (list.length === 2) return list.map(formatPlayerName).join(" · ");
  return `${formatPlayerName(list[0])} · +${list.length - 1}`;
}

function rosterForColor(color, players, teamNames) {
  return color === "white" ? (players?.home || []) : (players?.away || []);
}

function teamNameForColor(color, teamNames) {
  return color === "white" ? (teamNames?.home || "White") : (teamNames?.away || "Black");
}

// ─── Player Strip ─────────────────────────────────────────────────────────────
function PlayerStrip({ displayName, colorLabel, color, isActive, captured, advantage, teamName, UI }) {
  // captured = array of piece chars that this player captured from opponent
  const pieceIsBlack = color === "black";
  const label = colorLabel === "white" ? "White" : "Black";
  const nameColor = isActive
    ? (UI?.isDark ? "#FFFFFF" : UI?.text || "#111827")
    : (UI?.isDark ? "#D1D5DB" : UI?.textDim || "#4B5563");
  const labelColor = UI?.isDark ? "#9CA3AF" : UI?.muted || "#6B7280";
  const teamColor = UI?.isDark ? "#6B7280" : UI?.textMuted || "#9CA3AF";
  const capturedColor = pieceIsBlack
    ? (UI?.isDark ? "#D1D5DB" : "#4B5563")
    : (UI?.isDark ? "#9CA3AF" : "#6B7280");

  return (
    <View style={{
      flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 4,
    }}>
      {/* Color swatch (chess side — not app theme) */}
      <View style={{
        width: 18, height: 18, borderRadius: 3,
        backgroundColor: pieceIsBlack ? "#1a1a1a" : "#f5f5f5",
        borderWidth: 1.5,
        borderColor: pieceIsBlack ? "#555" : "#ccc",
        marginRight: 10,
      }} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{
          color: labelColor,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}>
          {label}
        </Text>
        <Text
          style={{ color: nameColor, fontSize: 14, fontWeight: isActive ? "700" : "600" }}
          numberOfLines={2}
        >
          {displayName}
        </Text>
        {!!teamName && displayName !== teamName && (
          <Text style={{ color: teamColor, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
            {teamName}
          </Text>
        )}
      </View>

      {/* Captured pieces + advantage */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        {captured.map((g, i) => (
          <Text key={i} style={{ fontSize: 11, opacity: 0.75, color: capturedColor }}>{g}</Text>
        ))}
        {advantage > 0 && (
          <Text style={{ color: labelColor, fontSize: 11, marginLeft: 4 }}>+{advantage}</Text>
        )}
      </View>

      {/* Active pulse */}
      {isActive && (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: UI?.isDark ? "#4ade80" : "#16A34A", marginLeft: 8 }} />
      )}
    </View>
  );
}

// ─── Move History ─────────────────────────────────────────────────────────────
function MoveList({ moves, activeIdx, onMoveClick, UI }) {
  const scrollRef = useRef(null);
  const cardBg = UI?.isDark ? "rgba(255,255,255,0.04)" : UI?.card || "#FFFFFF";
  const cardBorder = UI?.isDark ? "transparent" : UI?.border || "#E5E7EB";
  const rowBorder = UI?.isDark ? "rgba(255,255,255,0.05)" : UI?.border || "#E5E7EB";
  const headerBorder = UI?.isDark ? "rgba(255,255,255,0.08)" : UI?.border || "#E5E7EB";
  const muted = UI?.isDark ? "#6B7280" : UI?.muted || "#6B7280";
  const moveText = UI?.isDark ? "#E5E7EB" : UI?.text || "#111827";
  const blackMoveText = UI?.isDark ? "#9CA3AF" : UI?.textDim || "#4B5563";
  const activeBg = UI?.isDark ? "rgba(154,234,98,0.18)" : "#DCFCE7";
  const activeText = UI?.isDark ? "#9AEA62" : "#15803D";

  const pairs = useMemo(() => {
    const out = [];
    for (let i = 0; i < moves.length; i += 2)
      out.push({ num: Math.floor(i / 2) + 1, w: moves[i] || null, b: moves[i + 1] || null, wi: i, bi: i + 1 });
    return out;
  }, [moves]);

  useEffect(() => {
    if (scrollRef.current && moves.length > 0)
      scrollRef.current.scrollToEnd?.({ animated: true });
  }, [moves.length]);

  if (moves.length === 0) return (
    <View style={{ backgroundColor: cardBg, borderRadius: 10, padding: 14, alignItems: "center", borderWidth: UI?.isDark ? 0 : 1, borderColor: cardBorder }}>
      <Text style={{ color: muted, fontSize: 13 }}>No moves yet — game will begin with White's first move</Text>
    </View>
  );

  return (
    <View style={{ backgroundColor: cardBg, borderRadius: 10, overflow: "hidden", borderWidth: UI?.isDark ? 0 : 1, borderColor: cardBorder }}>
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: headerBorder, paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: muted, fontSize: 11, width: 30, fontWeight: "600" }}>#</Text>
        <Text style={{ color: muted, fontSize: 11, flex: 1, fontWeight: "600" }}>WHITE</Text>
        <Text style={{ color: muted, fontSize: 11, flex: 1, fontWeight: "600" }}>BLACK</Text>
      </View>
      <ScrollView ref={scrollRef} style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
        {pairs.map(pair => (
          <View key={pair.num} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: rowBorder }}>
            <Text style={{ color: muted, fontSize: 12, width: 30, paddingHorizontal: 10, paddingVertical: 8, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}>
              {pair.num}.
            </Text>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 4,
                backgroundColor: pair.wi === activeIdx ? activeBg : "transparent" }}
              onPress={() => onMoveClick(pair.wi)}
            >
              <Text style={{
                fontSize: 13, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                color: pair.wi === activeIdx ? activeText : moveText,
                fontWeight: pair.wi === activeIdx ? "700" : "400",
              }}>{pair.w || ""}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 4,
                backgroundColor: pair.bi === activeIdx ? activeBg : "transparent" }}
              onPress={() => pair.b && onMoveClick(pair.bi)}
            >
              <Text style={{
                fontSize: 13, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                color: pair.bi === activeIdx ? activeText : blackMoveText,
                fontWeight: pair.bi === activeIdx ? "700" : "400",
              }}>{pair.b || ""}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function ChessScoringPanelMobile({
  currentGame,
  players = { home: [], away: [] },
  teamNames = { home: "White", away: "Black" },
  isUpdating = false,
  onEvent,
  gameOver = false,
  displayOnly = false,
  isOwner = false,
  isScheduled = false,
  onStartGame,
  userSide = "home",
  onEndGame,
}) {
  const UI = useGameScoringTheme();
  const mutedText = UI.isDark ? "#9CA3AF" : UI.muted;
  const chipBg = UI.isDark ? "rgba(255,255,255,0.07)" : UI.surfaceAlt;
  const chipBorder = UI.isDark ? "rgba(255,255,255,0.1)" : UI.border;
  const chipIcon = UI.isDark ? "#D1D5DB" : UI.textDim;
  const boardFrame = UI.isDark ? "#374151" : "#CBD5E1";
  const resultBanner = {
    bg: UI.isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7",
    border: UI.isDark ? "rgba(245,158,11,0.35)" : "#F59E0B",
    text: UI.isDark ? "#FBBF24" : "#B45309",
  };
  const historyBanner = {
    bg: UI.isDark ? "rgba(59,130,246,0.12)" : "#DBEAFE",
    border: UI.isDark ? "rgba(59,130,246,0.3)" : "#93C5FD",
    text: UI.isDark ? "#93C5FD" : "#1D4ED8",
    link: UI.isDark ? "#60A5FA" : "#1E40AF",
  };
  const scheduledBanner = {
    bg: UI.isDark ? "rgba(234,179,8,0.14)" : "#FEF3C7",
    border: UI.isDark ? "rgba(234,179,8,0.35)" : "#F59E0B",
    waitText: UI.isDark ? "#D1D5DB" : UI.textDim,
  };
  const turnCanMove = {
    bg: UI.isDark ? "rgba(34,197,94,0.12)" : "#DCFCE7",
    border: UI.isDark ? "rgba(34,197,94,0.3)" : "#86EFAC",
    text: UI.isDark ? "#4ade80" : "#15803D",
  };
  const turnCoach = {
    bg: UI.isDark ? "rgba(59,130,246,0.12)" : "#DBEAFE",
    border: UI.isDark ? "rgba(59,130,246,0.3)" : "#93C5FD",
    text: UI.isDark ? "#93C5FD" : "#1D4ED8",
  };
  const turnWait = {
    bg: UI.isDark ? "rgba(75,85,99,0.2)" : "#F3F4F6",
    border: UI.isDark ? "rgba(75,85,99,0.3)" : "#D1D5DB",
    text: UI.isDark ? "#9CA3AF" : UI.muted,
  };
  const checkBanner = {
    text: UI.isDark ? "#F87171" : "#B91C1C",
  };
  const drawOffer = {
    bg: UI.isDark ? "rgba(59,130,246,0.12)" : "#DBEAFE",
    border: UI.isDark ? "rgba(59,130,246,0.35)" : "#93C5FD",
    text: UI.isDark ? "#BFDBFE" : "#1E40AF",
    acceptBg: UI.isDark ? "rgba(34,197,94,0.2)" : "#DCFCE7",
    acceptBorder: UI.isDark ? "rgba(34,197,94,0.35)" : "#86EFAC",
    acceptText: UI.isDark ? "#86EFAC" : "#15803D",
    declineBg: UI.isDark ? "rgba(239,68,68,0.16)" : "#FEE2E2",
    declineBorder: UI.isDark ? "rgba(239,68,68,0.3)" : "#FCA5A5",
    declineText: UI.isDark ? "#FCA5A5" : "#B91C1C",
  };
  const dangerBtn = UI.isDark
    ? { bg: "#DC2626", border: "#EF4444", deep: "#7F1D1D", text: "#FFFFFF" }
    : { bg: "#EF4444", border: "#DC2626", deep: "#B91C1C", text: "#FFFFFF" };
  const drawBtn = UI.isDark
    ? { bg: "#3B82F6", border: "#60A5FA", deep: "#1E3A8A", text: "#FFFFFF" }
    : { bg: "#3B82F6", border: "#2563EB", deep: "#1D4ED8", text: "#FFFFFF" };
  const resignBtn = UI.isDark
    ? { bg: "#EA580C", border: "#F97316", deep: "#9A3412", text: "#FFFFFF" }
    : { bg: "#F97316", border: "#EA580C", deep: "#C2410C", text: "#FFFFFF" };
  const startBtn = { bg: "#16A34A", border: "#22C55E", deep: "#166534", text: "#FFFFFF" };

  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomContentPad = Math.max(insets.bottom + 28, 48);
  const BOARD = Math.min(screenW - 16, 420);
  const SQ = BOARD / 8;

  // State
  const [sel, setSel] = useState(null);           // selected square
  const [promo, setPromo] = useState(null);        // { from, to }
  const [flipped, setFlipped] = useState(userSide === "away");
  const [viewIdx, setViewIdx] = useState(null);    // null = live
  const [optimisticFen, setOptimisticFen] = useState(null); // instant local move preview

  const sport  = currentGame?.sport || {};
  const base   = currentGame?.base  || {};

  const liveFen     = sport.fen || INITIAL_FEN;
  const moves       = sport.moves || [];
  const gameResult  = sport.gameResult || "*";
  const isLive      = base.status === "live";

  // Active FEN: optimistic → live → historical
  const activeFen = useMemo(() => {
    if (viewIdx !== null) {
      if (sport.fenHistory?.[viewIdx]) return sport.fenHistory[viewIdx];
      return moves.length > 0 ? replayToIndex(moves, viewIdx) : liveFen;
    }
    return optimisticFen || liveFen;
  }, [viewIdx, liveFen, optimisticFen, sport.fenHistory, moves]);

  const status  = useMemo(() => gameStatus(activeFen), [activeFen]);
  const isViewing = viewIdx !== null;

  // When server confirms the move (liveFen updates), clear optimistic state
  useEffect(() => { setOptimisticFen(null); setViewIdx(null); }, [liveFen]);

  const board = useMemo(() => parseFEN(activeFen), [activeFen]);

  // Material
  const material = useMemo(() => calcMaterial(activeFen), [activeFen]);
  const topColor    = flipped ? "white" : "black";
  const bottomColor = flipped ? "black" : "white";
  const topPlayerDisplay = formatSidePlayers(rosterForColor(topColor, players, teamNames), teamNameForColor(topColor, teamNames));
  const bottomPlayerDisplay = formatSidePlayers(rosterForColor(bottomColor, players, teamNames), teamNameForColor(bottomColor, teamNames));

  // Captures for each player
  function getCaptured(forColor) {
    // forColor captured opponent's pieces = opponent's pieces that are missing
    const oppColor = forColor === "white" ? "black" : "white";
    const oppMat = material[oppColor];
    const captured = [];
    const pairs2 = [
      { key: "queens",  g: forColor === "white" ? "♛" : "♕" },
      { key: "rooks",   g: forColor === "white" ? "♜" : "♖" },
      { key: "bishops", g: forColor === "white" ? "♝" : "♗" },
      { key: "knights", g: forColor === "white" ? "♞" : "♘" },
      { key: "pawns",   g: forColor === "white" ? "♟" : "♙" },
    ];
    for (const { key, g } of pairs2) {
      const missing = (DEF_MAT[key] || 0) - (oppMat[key] || 0);
      for (let i = 0; i < Math.max(0, missing); i++) captured.push(g);
    }
    return captured;
  }

  const topCaptures    = getCaptured(topColor);
  const bottomCaptures = getCaptured(bottomColor);
  const topAdv    = materialAdv(material[topColor],    material[topColor === "white" ? "black" : "white"]);
  const bottomAdv = materialAdv(material[bottomColor], material[bottomColor === "white" ? "black" : "white"]);

  // Can user move?
  const userColor = userSide === "home" ? "white" : "black";
  const canMove   = !displayOnly && !gameOver && isLive && !isViewing && status.turn === userColor && !status.isOver;

  // Legal moves for selected square
  const legal = useMemo(() => {
    if (!sel || !canMove) return [];
    return legalDests(activeFen, sel);
  }, [sel, canMove, activeFen]);

  // Last move highlight
  const lastMove = useMemo(() => {
    const events = sport.events || [];
    const e = events[events.length - 1];
    if (e?.fromSquare && e?.toSquare) return { from: e.fromSquare, to: e.toSquare };
    return null;
  }, [sport.events]);

  // King in check
  const checkSq = useMemo(() => status.isCheck ? findKing(board, status.turn) : null, [board, status]);

  // Execute move
  const doMove = useCallback((from, to, promotion = null) => {
    const result = applyMove(activeFen, from, to, promotion || "q");
    if (!result) return;

    // Optimistic update — show the move instantly before server confirms
    setOptimisticFen(result.fen);
    setSel(null);
    setViewIdx(null);

    onEvent?.("move", {
      fromSquare: from, toSquare: to, san: result.san, fen: result.fen,
      promotion: promotion || undefined,
      color: status.turn,
      moveNumber: Math.floor(moves.length / 2) + 1,
      isCheck: result.isCheck, isCheckmate: result.isCheckmate,
      isStalemate: result.isStalemate, isDraw: result.isDraw,
      drawReason: result.drawReason || undefined,
      captured: result.captured ? PIECE_NAMES[result.captured] : undefined,
      piece: result.piece ? PIECE_NAMES[result.piece] : undefined,
    });
  }, [activeFen, status.turn, moves.length, onEvent]);

  // Square tap
  const onTap = useCallback((sq, piece) => {
    if (!canMove) return;
    if (sel) {
      if (sq === sel) { setSel(null); return; }
      if (legal.includes(sq)) {
        if (needsPromotion(activeFen, sel, sq)) { setPromo({ from: sel, to: sq }); return; }
        doMove(sel, sq);
      } else if (piece && pieceColor(piece) === userColor) {
        setSel(sq);
      } else {
        setSel(null);
      }
    } else if (piece && pieceColor(piece) === userColor) {
      setSel(sq);
    }
  }, [sel, legal, canMove, activeFen, userColor, doMove]);

  // Resign
  const resign = useCallback(() => {
    Alert.alert("Resign", "Are you sure you want to resign?", [
      { text: "Cancel", style: "cancel" },
      { text: "Resign", style: "destructive", onPress: () => onEvent?.("resign", { color: userColor }) },
    ]);
  }, [onEvent, userColor]);

  // Offer draw
  const offerDraw = useCallback(() => {
    Alert.alert("Offer Draw", "Offer a draw to your opponent?", [
      { text: "Cancel", style: "cancel" },
      { text: "Offer Draw", onPress: () => onEvent?.("draw_offer", { color: userColor }) },
    ]);
  }, [onEvent, userColor]);

  const pendingDrawOffer = useMemo(() => {
    const events = sport.events || [];
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const ev = events[i];
      if (!ev) continue;
      if (ev.eventType === "draw_accept" || ev.eventType === "draw_decline") return null;
      if (ev.eventType === "draw_offer") return ev;
    }
    return null;
  }, [sport.events]);

  const canRespondToDraw = !!pendingDrawOffer && !displayOnly && pendingDrawOffer.color !== userColor && !status.isOver;

  // Result banner text
  const resultLabel = useMemo(() => {
    const fromStored = formatChessResultLabel(gameResult, teamNames.home, teamNames.away);
    if (fromStored) return fromStored;
    if (gameOver || base.status === "finished") {
      const outcome = resolveChessOutcome(sport);
      return formatChessResultLabel(outcome.gameResult, teamNames.home, teamNames.away);
    }
    return null;
  }, [gameResult, gameOver, base.status, sport, teamNames.home, teamNames.away]);

  // ── Render a single board square ────────────────────────────────────────────
  const renderSq = useCallback((ri, fi) => {
    const aRank = flipped ? 7 - ri : ri;
    const aFile = flipped ? 7 - fi : fi;
    const sq    = `${FILES[aFile]}${8 - aRank}`;
    const piece = board[aRank]?.[aFile];
    const light = (aRank + aFile) % 2 === 0;

    const isSelected  = sel === sq;
    const isLastMove  = lastMove && (sq === lastMove.from || sq === lastMove.to);
    const isLegalDest = legal.includes(sq);
    const isCheck     = sq === checkSq;
    const pc          = pieceColor(piece);

    // Background
    let bg = light ? SQ_LIGHT : SQ_DARK;
    if (isCheck)    bg = SQ_CHECK;
    else if (isSelected) bg = SQ_SEL;
    else if (isLastMove) bg = light ? SQ_LAST_L : SQ_LAST_D;

    // Rank / file labels
    const showFile = flipped ? ri === 0  : ri === 7;
    const showRank = flipped ? fi === 7  : fi === 0;

    const squareStyle = {
      width: SQ,
      height: SQ,
      backgroundColor: bg,
      alignItems: "center",
      justifyContent: "center",
    };

    const squareBody = (
      <>
        {/* Piece */}
        {piece ? (
          <Text
            allowFontScaling={false}
            style={{
              fontSize: SQ * 0.72,
              lineHeight: SQ * 0.86,
              includeFontPadding: false,
              color: pc === "white" ? "#FFFFFF" : "#1a1a1a",
              textShadowColor: pc === "white" ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.2)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: pc === "white" ? 2 : 1,
              userSelect: "none",
            }}
          >
            {GLYPHS[piece]}
          </Text>
        ) : null}

        {/* Legal move — empty square: dot */}
        {isLegalDest && !piece ? (
          <View style={{
            position: "absolute",
            width: SQ * 0.3, height: SQ * 0.3,
            borderRadius: SQ * 0.15,
            backgroundColor: "rgba(0,0,0,0.22)",
          }} />
        ) : null}

        {/* Legal move — occupied: ring */}
        {isLegalDest && piece ? (
          <View style={{
            position: "absolute",
            width: SQ * 0.9, height: SQ * 0.9,
            borderRadius: SQ * 0.45,
            borderWidth: 3,
            borderColor: "rgba(0,0,0,0.25)",
          }} />
        ) : null}

        {/* File label (bottom row) */}
        {showFile ? (
          <Text allowFontScaling={false} style={{
            position: "absolute", bottom: 1, right: 2,
            fontSize: 9, fontWeight: "700", lineHeight: 11,
            color: light ? SQ_DARK : SQ_LIGHT,
          }}>{FILES[aFile]}</Text>
        ) : null}

        {/* Rank label (left col) */}
        {showRank ? (
          <Text allowFontScaling={false} style={{
            position: "absolute", top: 1, left: 2,
            fontSize: 9, fontWeight: "700", lineHeight: 11,
            color: light ? SQ_DARK : SQ_LIGHT,
          }}>{8 - aRank}</Text>
        ) : null}
      </>
    );

    return (
      <TouchableOpacity
        key={sq}
        activeOpacity={canMove ? 0.9 : 1}
        onPress={() => onTap(sq, piece)}
        style={squareStyle}
      >
        {squareBody}
      </TouchableOpacity>
    );
  }, [board, flipped, sel, legal, lastMove, checkSq, canMove, SQ, onTap]);

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: bottomContentPad }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Game Result ── */}
      {resultLabel && (
        <View style={{
          marginHorizontal: 12, marginBottom: 10,
          backgroundColor: resultBanner.bg,
          borderWidth: 1, borderColor: resultBanner.border,
          borderRadius: 12, paddingVertical: 12, alignItems: "center",
        }}>
          <Text style={{ color: resultBanner.text, fontSize: 18, fontWeight: "800" }}>{resultLabel}</Text>
        </View>
      )}

      {/* ── Viewing history banner ── */}
      {isViewing && (
        <View style={{
          marginHorizontal: 12, marginBottom: 6,
          backgroundColor: historyBanner.bg,
          borderWidth: 1, borderColor: historyBanner.border,
          borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        }}>
          <Text style={{ color: historyBanner.text, fontSize: 12 }}>
            Move {viewIdx + 1} of {moves.length}
          </Text>
          <TouchableOpacity onPress={() => setViewIdx(null)}>
            <Text style={{ color: historyBanner.link, fontSize: 12, fontWeight: "700" }}>Back to Live</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Scheduled state controls ── */}
      {isScheduled && !gameOver && (
        <View
          style={{
            marginHorizontal: 12,
            marginBottom: 8,
            borderRadius: 10,
            padding: 10,
            backgroundColor: scheduledBanner.bg,
            borderWidth: 1,
            borderColor: scheduledBanner.border,
          }}
        >
          {isOwner ? (
            <TouchableOpacity
              onPress={onStartGame}
              disabled={isUpdating}
              style={{
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
                backgroundColor: startBtn.bg,
                borderWidth: 1,
                borderColor: startBtn.border,
                opacity: isUpdating ? 0.6 : 1,
                ...raised3d(startBtn.deep, UI.isDark),
              }}
            >
              <Text style={{ color: startBtn.text, fontSize: 13, fontWeight: "800" }}>▶ Start Match</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: scheduledBanner.waitText, fontSize: 12, textAlign: "center" }}>
              Waiting for coach to start this game
            </Text>
          )}
        </View>
      )}

      {/* ── Turn indicator ── */}
      {isLive && !gameOver && !resultLabel && !isViewing && (
        <View style={{
          marginHorizontal: 12, marginBottom: 6,
          borderRadius: 10, paddingVertical: 8, alignItems: "center",
          backgroundColor: canMove ? turnCanMove.bg : displayOnly ? turnCoach.bg : turnWait.bg,
          borderWidth: 1,
          borderColor: canMove ? turnCanMove.border : displayOnly ? turnCoach.border : turnWait.border,
        }}>
          {displayOnly ? (
            <Text style={{ color: turnCoach.text, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
              Coach view — {status.turn === "white" ? "White" : "Black"} to move
            </Text>
          ) : status.isCheck ? (
            <Text style={{ color: checkBanner.text, fontSize: 13, fontWeight: "700" }}>
              ⚠ Check! {status.turn === "white" ? "White" : "Black"} is in check
            </Text>
          ) : (
            <Text style={{ color: canMove ? turnCanMove.text : turnWait.text, fontSize: 13, fontWeight: "600" }}>
              {canMove
                ? `Your turn — move your ${userColor} pieces`
                : `${status.turn === "white" ? "White" : "Black"} to move…`}
            </Text>
          )}
        </View>
      )}

      {canRespondToDraw && (
        <View
          style={{
            marginHorizontal: 12,
            marginBottom: 8,
            borderRadius: 10,
            padding: 10,
            backgroundColor: drawOffer.bg,
            borderWidth: 1,
            borderColor: drawOffer.border,
          }}
        >
          <Text style={{ color: drawOffer.text, fontSize: 12, marginBottom: 8 }}>
            Opponent offered a draw.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
                backgroundColor: UI.isDark ? "#16A34A" : "#22C55E",
                borderWidth: 1,
                borderColor: UI.isDark ? "#22C55E" : "#16A34A",
                ...raised3d(UI.isDark ? "#14532D" : "#15803D", UI.isDark),
              }}
              onPress={() => onEvent?.("draw_accept", { color: userColor })}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 12 }}>Accept Draw</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
                backgroundColor: dangerBtn.bg,
                borderWidth: 1,
                borderColor: dangerBtn.border,
                ...raised3d(dangerBtn.deep, UI.isDark),
              }}
              onPress={() => onEvent?.("draw_decline", { color: userColor })}
            >
              <Text style={{ color: dangerBtn.text, fontWeight: "800", fontSize: 12 }}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Top Player ── */}
      <View style={{ paddingHorizontal: 8 }}>
        <PlayerStrip
          displayName={topPlayerDisplay}
          colorLabel={topColor}
          color={topColor}
          teamName={teamNameForColor(topColor, teamNames)}
          isActive={status.turn === topColor && isLive && !gameOver}
          captured={topCaptures}
          advantage={topAdv > 0 ? topAdv : 0}
          UI={UI}
        />
      </View>

      {/* ── Board ── */}
      <View
        style={{
          width: BOARD, alignSelf: "center",
          borderRadius: 4, overflow: "hidden",
          borderWidth: 2, borderColor: boardFrame,
          elevation: UI.isDark ? 8 : 3,
          shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
          shadowOpacity: UI.isDark ? 0.5 : 0.12, shadowRadius: 8,
        }}
      >
        {Array.from({ length: 8 }, (_, ri) => (
          <View key={ri} style={{ flexDirection: "row", height: SQ }}>
            {Array.from({ length: 8 }, (_, fi) => renderSq(ri, fi))}
          </View>
        ))}
      </View>

      {/* ── Bottom Player ── */}
      <View style={{ paddingHorizontal: 8 }}>
        <PlayerStrip
          displayName={bottomPlayerDisplay}
          colorLabel={bottomColor}
          color={bottomColor}
          teamName={teamNameForColor(bottomColor, teamNames)}
          isActive={status.turn === bottomColor && isLive && !gameOver}
          captured={bottomCaptures}
          advantage={bottomAdv > 0 ? bottomAdv : 0}
          UI={UI}
        />
      </View>

      {/* ── Navigation Controls ── */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 6, marginTop: 6, marginHorizontal: 12,
      }}>
        {[
          { icon: "play-skip-back",    onPress: () => setViewIdx(0),                            disabled: moves.length === 0 },
          { icon: "chevron-back",      onPress: () => setViewIdx(v => v === null ? moves.length - 2 : Math.max(0, v - 1)), disabled: moves.length === 0 },
          { icon: "chevron-forward",   onPress: () => setViewIdx(v => { if (v === null) return null; if (v >= moves.length - 1) return null; return v + 1; }), disabled: !isViewing },
          { icon: "play-skip-forward", onPress: () => setViewIdx(null),                         disabled: !isViewing },
        ].map((btn, i) => (
          <TouchableOpacity
            key={i}
            onPress={btn.disabled ? null : btn.onPress}
            style={{
              width: 40, height: 40, borderRadius: 10,
              backgroundColor: chipBg,
              borderWidth: 1, borderColor: chipBorder,
              alignItems: "center", justifyContent: "center",
              opacity: btn.disabled ? 0.35 : 1,
            }}
          >
            <Ionicons name={btn.icon} size={18} color={chipIcon} />
          </TouchableOpacity>
        ))}

        {/* Separator */}
        <View style={{ width: 1, height: 28, backgroundColor: chipBorder, marginHorizontal: 2 }} />

        {/* Flip board */}
        <TouchableOpacity
          onPress={() => setFlipped(f => !f)}
          style={{
            width: 40, height: 40, borderRadius: 10,
            backgroundColor: chipBg,
            borderWidth: 1, borderColor: chipBorder,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="sync-outline" size={18} color={chipIcon} />
        </TouchableOpacity>
      </View>

      {/* ── Move History ── */}
      <View style={{ marginHorizontal: 12, marginTop: 14 }}>
        <Text style={{ color: mutedText, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
          Move History
        </Text>
        <MoveList
          moves={moves}
          activeIdx={viewIdx !== null ? viewIdx : moves.length - 1}
          onMoveClick={idx => setViewIdx(idx)}
          UI={UI}
        />
      </View>

      {/* ── Game actions (single End Game; draw/resign for players only) ── */}
      {isLive && !gameOver && !resultLabel && (isOwner || !displayOnly) && (
        <View style={{ marginHorizontal: 12, marginTop: 16, gap: 10 }}>
          <TouchableOpacity
            onPress={onEndGame}
            disabled={isUpdating}
            style={{
              paddingVertical: 13,
              borderRadius: 12,
              backgroundColor: dangerBtn.bg,
              borderWidth: 1,
              borderColor: dangerBtn.border,
              alignItems: "center",
              opacity: isUpdating ? 0.5 : 1,
              ...raised3d(dangerBtn.deep, UI.isDark),
            }}
          >
            <Text style={{ color: dangerBtn.text, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 }}>End Game</Text>
          </TouchableOpacity>

          {!displayOnly && (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={offerDraw}
                disabled={isUpdating}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: drawBtn.bg,
                  borderWidth: 1,
                  borderColor: drawBtn.border,
                  alignItems: "center",
                  opacity: isUpdating ? 0.5 : 1,
                  ...raised3d(drawBtn.deep, UI.isDark),
                }}
              >
                <Text style={{ color: drawBtn.text, fontSize: 13, fontWeight: "800" }}>Offer Draw</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={resign}
                disabled={isUpdating}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: resignBtn.bg,
                  borderWidth: 1,
                  borderColor: resignBtn.border,
                  alignItems: "center",
                  opacity: isUpdating ? 0.5 : 1,
                  ...raised3d(resignBtn.deep, UI.isDark),
                }}
              >
                <Text style={{ color: resignBtn.text, fontSize: 13, fontWeight: "800" }}>Resign</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Promotion Modal */}
      <PromotionModal
        visible={!!promo}
        color={status.turn}
        UI={UI}
        onSelect={code => {
          if (promo) { doMove(promo.from, promo.to, code); setPromo(null); }
        }}
        onCancel={() => { setPromo(null); setSel(null); }}
      />
    </ScrollView>
  );
}

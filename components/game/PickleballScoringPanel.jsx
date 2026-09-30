import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import { fonts } from "@/constants/typography";

const PICKLEBALL_ICON_3D = require("@/assets/images/pickleball-3d.png");

function raisedScoreShadow(isDark) {
  return {
    shadowColor: isDark ? "#000000" : "#64748B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.35 : 0.2,
    shadowRadius: 3,
    elevation: 5,
  };
}

function RaisedBtn({
  onPress,
  disabled,
  palette,
  style,
  children,
  isDark,
  borderRadius = 12,
  testID,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      activeOpacity={0.7}
      style={{
        backgroundColor: palette.bg,
        borderRadius,
        borderWidth: 1,
        borderColor: palette.border,
        borderBottomWidth: 4,
        borderBottomColor: palette.deep,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        ...raisedScoreShadow(isDark),
        ...style,
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

/** Serving active keeps pickleball green; idle states adapt for light theme. */
function rallyPalette(isServing, UI) {
  if (isServing) {
    return {
      bg: "#01e19d",
      border: "#00c489",
      deep: "#009968",
      text: "#005e3f",
      sub: "#005e3f",
    };
  }
  if (UI.isDark) {
    return {
      bg: "rgba(255,255,255,0.05)",
      border: "rgba(255,255,255,0.15)",
      deep: "rgba(15,23,42,0.55)",
      text: "#dfe1f9",
      sub: "#6B7280",
    };
  }
  return {
    bg: "#6366F1",
    border: "#4F46E5",
    deep: "#4338CA",
    text: "#FFFFFF",
    sub: "#E0E7FF",
  };
}

const PICKLEBALL_FAULT_OPTIONS = [
  { eventType: "serve_fault", faultType: "serve", label: "Serve", icon: "radio-button-on" },
  { eventType: "kitchen_fault", faultType: "kitchen", label: "Kitchen", icon: "restaurant" },
  { eventType: "double_bounce_fault", faultType: "double_bounce", label: "2 Bounce", icon: "layers" },
  { eventType: "foot_fault", faultType: "foot", label: "Foot", icon: "footsteps" },
  { eventType: "out_fault", faultType: "out", label: "Out", icon: "arrow-redo" },
  { eventType: "net_fault", faultType: "net", label: "Net", icon: "remove" },
];

const getServingSide = (sport = {}) =>
  sport?.servingTeam || (sport?.servingPlayer === "player2" ? "away" : "home");

const getSideScore = (sport = {}, side) =>
  side === "home" ? (sport?.currentPointScore?.player1 || 0) : (sport?.currentPointScore?.player2 || 0);

const getScoreCall = (sport = {}) => {
  const servingSide = getServingSide(sport);
  const receivingSide = servingSide === "home" ? "away" : "home";
  return `${getSideScore(sport, servingSide)}-${getSideScore(sport, receivingSide)}-${sport?.serverNumber || 2}`;
};

function getPickleballGamesWon(gameScores = [], userIsHome) {
  return (gameScores || []).filter((g) => {
    const uPts = userIsHome ? g.player1Points : g.player2Points;
    const oPts = userIsHome ? g.player2Points : g.player1Points;
    return Number(uPts) > Number(oPts);
  }).length;
}

/** Black flip-card digits with silver binder rings. */
function PickleballFlipDigits({ value = 0, digitColor = "#FFFFFF", compact = false }) {
  const digits = String(Math.max(0, Math.min(99, Number(value) || 0))).padStart(2, "0").split("");
  const tileW = compact ? 34 : 42;
  const tileH = compact ? 48 : 60;
  const fontSize = compact ? 32 : 42;
  const ring = compact ? 8 : 10;

  return (
    <View style={{ flexDirection: "row", gap: compact ? 5 : 7 }}>
      {digits.map((d, i) => (
        <View key={`${i}-${d}`} style={{ alignItems: "center" }}>
          <View
            style={{
              flexDirection: "row",
              gap: tileW * 0.28,
              zIndex: 2,
              marginBottom: -ring * 0.55,
            }}
          >
            {[0, 1].map((r) => (
              <View
                key={r}
                style={{
                  width: ring,
                  height: ring,
                  borderRadius: ring / 2,
                  backgroundColor: "#E5E7EB",
                  borderWidth: 1.5,
                  borderColor: "#9CA3AF",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.3,
                  shadowRadius: 1,
                  elevation: 2,
                }}
              />
            ))}
          </View>
          <View
            style={{
              width: tileW,
              height: tileH,
              backgroundColor: "#111827",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#1F2937",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.35,
              shadowRadius: 3,
              elevation: 4,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.scoreDisplay,
                fontSize,
                lineHeight: fontSize + 2,
                color: digitColor,
                fontVariant: ["tabular-nums"],
                includeFontPadding: false,
                textAlign: "center",
              }}
            >
              {d}
            </Text>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 3,
                right: 3,
                top: "50%",
                height: 1,
                marginTop: -0.5,
                backgroundColor: "rgba(255,255,255,0.12)",
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Flip-tile scoreboard — lime left / white right (live rally points). */
export function PickleballScoreboardCard({
  currentGame,
  teamNames = { home: "Home", away: "Away" },
  gameTime,
  displayOnly = false,
  isUpdating,
  gameOver,
  isScheduled = false,
  isOwner = false,
  onPauseResume,
  onEndGame,
  onStartGame,
  userSide = "home",
  compact = false,
}) {
  const UI = useGameScoringTheme();
  const sport = currentGame?.sport;
  const base = currentGame?.base;
  const isLive = base?.status === "live";
  const userIsHome = userSide !== "away";

  const p1Score = sport?.currentPointScore?.player1 || 0;
  const p2Score = sport?.currentPointScore?.player2 || 0;
  const userScore = userIsHome ? p1Score : p2Score;
  const oppScore = userIsHome ? p2Score : p1Score;

  const servingSide = getServingSide(sport);
  const servingIsHome = servingSide === "home";
  const userIsServing = (userIsHome && servingIsHome) || (!userIsHome && !servingIsHome);
  const serverNumber = sport?.serverNumber || 2;
  const scoreCall = getScoreCall(sport);

  const gameScores = sport?.gameScores || [];
  const currentGameNumber = sport?.currentGame || 1;
  const userGames = getPickleballGamesWon(gameScores, userIsHome);
  const oppGames = getPickleballGamesWon(gameScores, !userIsHome);

  const userName = userIsHome ? (teamNames?.home || "Home") : (teamNames?.away || "Away");
  const oppName = userIsHome ? (teamNames?.away || "Away") : (teamNames?.home || "Home");

  const minutes = String(gameTime?.minutes || 0).padStart(2, "0");
  const seconds = String(gameTime?.seconds || 0).padStart(2, "0");
  const canControl = !displayOnly && isOwner;

  const nameStyle = {
    color: UI.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  };

  const serveChip = (isServing) => (
    <View
      style={{
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: isServing
          ? (UI.isDark ? "rgba(71,254,183,0.15)" : "rgba(5,150,105,0.12)")
          : (UI.isDark ? "rgba(255,255,255,0.06)" : UI.surfaceAlt),
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontWeight: "800",
          letterSpacing: 0.5,
          textTransform: "uppercase",
          color: isServing ? (UI.isDark ? "#47FEB7" : "#059669") : UI.muted,
        }}
      >
        {isServing ? `Serve #${serverNumber}` : "Receive"}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: UI.card,
        borderRadius: 16,
        marginHorizontal: compact ? 0 : 8,
        marginVertical: compact ? 0 : 8,
        paddingVertical: compact ? 12 : 16,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: UI.isDark ? UI.border : "#CBD5E1",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: UI.isDark ? 0.22 : 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={nameStyle} numberOfLines={1}>{userName}</Text>
          <PickleballFlipDigits value={userScore} digitColor="#D4FF00" compact={compact} />
          <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", marginTop: 8 }}>
            Games {userGames}
          </Text>
          {serveChip(userIsServing)}
        </View>

        <View style={{ alignItems: "center", paddingHorizontal: 8, minWidth: 72 }}>
          <Image
            source={PICKLEBALL_ICON_3D}
            style={{
              width: compact ? 34 : 44,
              height: compact ? 34 : 44,
              marginBottom: 4,
            }}
            resizeMode="contain"
          />
          <Text style={{ color: UI.muted, fontSize: 11, fontWeight: "800", marginBottom: 2 }}>
            Game {currentGameNumber}
          </Text>
          <Text
            style={{
              color: UI.isDark ? "#47FEB7" : "#059669",
              fontSize: 11,
              fontWeight: "900",
              letterSpacing: 1,
              marginBottom: 6,
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            }}
          >
            {scoreCall}
          </Text>
          <Text
            style={{
              color: UI.textMuted,
              fontSize: 10,
              fontWeight: "700",
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              marginBottom: 8,
            }}
          >
            {minutes}:{seconds}
          </Text>
          {isScheduled && canControl && onStartGame ? (
            <TouchableOpacity
              onPress={onStartGame}
              disabled={isUpdating}
              style={{
                backgroundColor: "#16A34A",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                borderBottomWidth: 3,
                borderBottomColor: "#166534",
                opacity: isUpdating ? 0.5 : 1,
                ...raisedScoreShadow(UI.isDark),
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>▶ Start</Text>
            </TouchableOpacity>
          ) : null}
          {isLive && canControl && !gameOver ? (
            <View style={{ flexDirection: "row", gap: 6 }}>
              {onPauseResume ? (
                <TouchableOpacity
                  onPress={onPauseResume}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: UI.warningBg,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: UI.warningBorder,
                    borderBottomWidth: 3,
                    borderBottomColor: UI.warningBorder,
                  }}
                >
                  <Ionicons name={gameTime?.isRunning ? "pause" : "play"} size={16} color={UI.warningStrong} />
                </TouchableOpacity>
              ) : null}
              {onEndGame ? (
                <TouchableOpacity
                  onPress={onEndGame}
                  style={{
                    paddingHorizontal: 10,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: UI.isDark ? "rgba(239,68,68,0.28)" : UI.dangerBg,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: UI.isDark ? "rgba(252,165,165,0.45)" : "#FECACA",
                    borderBottomWidth: 3,
                    borderBottomColor: UI.isDark ? "rgba(185,28,28,0.8)" : "#FECACA",
                  }}
                >
                  <Text style={{ color: UI.dangerText, fontWeight: "800", fontSize: 10 }}>END</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {!isOwner && isScheduled ? (
            <Text style={{ color: UI.muted, fontSize: 10 }}>Waiting</Text>
          ) : null}
        </View>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={nameStyle} numberOfLines={1}>{oppName}</Text>
          <PickleballFlipDigits value={oppScore} digitColor="#FFFFFF" compact={compact} />
          <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", marginTop: 8 }}>
            Games {oppGames}
          </Text>
          {serveChip(!userIsServing)}
        </View>
      </View>
    </View>
  );
}

function PickleballScoringPanelMobile({
  currentGame,
  players,
  teamNames = { home: "Home", away: "Away" },
  isUpdating,
  onScore,
  onUndo,
  gameOver,
  displayOnly = false,
  isScoringTab = false,
  userSide = "home",
  onEndGame,
  onStartGame,
  isScheduled = false,
  isOwner = false,
  onPauseResume,
}) {
  const [activeAction, setActiveAction] = useState(null);
  const [selectedFault, setSelectedFault] = useState(PICKLEBALL_FAULT_OPTIONS[0]);
  const UI = useGameScoringTheme();
  const accent = UI.isDark ? "#47FEB7" : "#059669";
  const accentSoft = UI.isDark ? "rgba(71,254,183,0.15)" : "rgba(5,150,105,0.12)";
  const accentBorder = UI.isDark ? "rgba(71,254,183,0.2)" : "rgba(5,150,105,0.28)";
  const labelCol = UI.isDark ? "#b8c3ff" : "#6366F1";
  const cardBg = UI.isDark ? "rgba(255,255,255,0.05)" : UI.card;
  const cardBorder = UI.isDark ? "rgba(255,255,255,0.1)" : UI.border;
  const softCardBg = UI.isDark ? "#171a2c" : UI.surfaceAlt;
  const primaryText = UI.isDark ? "#fff" : UI.text;
  const secondaryText = UI.isDark ? "#D1D5DB" : UI.textDim;
  const mutedText = UI.isDark ? "#9CA3AF" : UI.muted;
  const dimText = UI.isDark ? "#6B7280" : UI.textMuted;
  const overlayBg = UI.isDark ? "rgba(49,52,70,0.6)" : UI.card;
  const overlayBorder = UI.isDark ? "rgba(255,255,255,0.1)" : UI.border;
  const waitingBg = UI.isDark ? "#171a2c" : UI.card;
  const homeAccent = UI.isDark ? "#47feb7" : "#059669";
  const awayAccent = UI.isDark ? "#f87171" : "#DC2626";
  const winChip = {
    bg: UI.isDark ? "rgba(34,197,94,0.1)" : "rgba(5,150,105,0.1)",
    border: UI.isDark ? "rgba(34,197,94,0.3)" : "rgba(5,150,105,0.35)",
    text: homeAccent,
  };
  const loseChip = {
    bg: UI.isDark ? "rgba(239,68,68,0.1)" : "#FEF2F2",
    border: UI.isDark ? "rgba(239,68,68,0.3)" : "#FECACA",
    text: awayAccent,
  };
  const chooseUserPalette = {
    bg: UI.isDark ? "rgba(71,254,183,0.1)" : "rgba(5,150,105,0.1)",
    border: UI.isDark ? "rgba(71,254,183,0.3)" : "rgba(5,150,105,0.35)",
    deep: UI.isDark ? "rgba(22,163,74,0.5)" : "#16A34A",
    text: homeAccent,
  };
  const chooseOppPalette = {
    bg: UI.isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6",
    border: UI.isDark ? "rgba(255,255,255,0.15)" : "#E5E7EB",
    deep: UI.isDark ? "rgba(15,23,42,0.45)" : "#D1D5DB",
    text: primaryText,
  };
  const faultBtnPalette = UI.isDark
    ? { bg: "#26293b", border: "rgba(255,181,146,0.2)", deep: "#1a1c2a", text: "#dfe1f9", icon: "#ffb592" }
    : { bg: "#F97316", border: "#EA580C", deep: "#C2410C", text: "#FFFFFF", icon: "#FFFFFF" };
  const winnerBtnPalette = UI.isDark
    ? { bg: "#26293b", border: "rgba(71,254,183,0.2)", deep: "#1a1c2a", text: "#dfe1f9", icon: "#47feb7" }
    : { bg: "#22C55E", border: "#16A34A", deep: "#15803D", text: "#FFFFFF", icon: "#FFFFFF" };
  const undoBtnPalette = UI.isDark
    ? { bg: "rgba(239,68,68,0.22)", border: "rgba(239,68,68,0.45)", deep: "#7f1d1d", text: "#FCA5A5", icon: "#F87171" }
    : { bg: "#EF4444", border: "#DC2626", deep: "#B91C1C", text: "#FFFFFF", icon: "#FFFFFF" };
  const timeoutBtnPalette = UI.isDark
    ? { bg: "rgba(245,158,11,0.22)", border: "rgba(245,158,11,0.45)", deep: "#92400E", text: "#FCD34D", icon: "#FBBF24" }
    : { bg: "#F59E0B", border: "#D97706", deep: "#B45309", text: "#FFFFFF", icon: "#FFFFFF" };
  const timeoutActivePalette = UI.isDark
    ? { bg: "#D97706", border: "#F59E0B", deep: "#78350F", text: "#FFFFFF", icon: "#FFFFFF" }
    : { bg: "#D97706", border: "#B45309", deep: "#92400E", text: "#FFFFFF", icon: "#FFFFFF" };
  const sport = currentGame?.sport;
  const base = currentGame?.base;
  const isLive = base?.status === "live";
  const homeId = String(base?.teamId || "");

  const opponentSide = userSide === "home" ? "away" : "home";
  const userIsHome = userSide === "home";

  const currentGameNumber = sport?.currentGame || 1;
  const matchFormat = sport?.matchFormat || "best_of_3";
  const totalGames = matchFormat === "best_of_5" ? 5 : 3;
  const gameScores = sport?.gameScores || [];

  // Current point scores
  const p1Score = sport?.currentPointScore?.player1 || 0;
  const p2Score = sport?.currentPointScore?.player2 || 0;
  const userScore = userIsHome ? p1Score : p2Score;
  const opponentScore = userIsHome ? p2Score : p1Score;

  // ─── SERVE TRACKING ───
  // player1 = home team, player2 = away team
  const servingSide = getServingSide(sport);
  const servingIsHome = servingSide === "home";
  const userIsServing =
    (userIsHome && servingIsHome) || (!userIsHome && !servingIsHome);
  const serverNumber = sport?.serverNumber || 2;

  // Which side is serving?
  const scoreCall = getScoreCall(sport);
  const serverCourtSide = sport?.serveState?.serverCourtSide || (getSideScore(sport, servingSide) % 2 === 0 ? "right" : "left");

  // Games won
  const userGamesWon = gameScores.filter((g) => {
    const uPts = userIsHome ? g.player1Points : g.player2Points;
    const oPts = userIsHome ? g.player2Points : g.player1Points;
    return uPts > oPts;
  }).length;
  const opponentGamesWon = gameScores.filter((g) => {
    const uPts = userIsHome ? g.player1Points : g.player2Points;
    const oPts = userIsHome ? g.player2Points : g.player1Points;
    return oPts > uPts;
  }).length;

  // Events for current game
  const gameEvents = (sport?.events || [])
    .filter((e) => e && Number(e.gameNumber) === currentGameNumber)
    .slice(-10)
    .reverse();

  const disabled = gameOver;
  const userTeamName = userIsHome ? teamNames.home : teamNames.away;
  const opponentTeamName = userIsHome ? teamNames.away : teamNames.home;

  // ─── CORE RALLY HANDLER ───
  // Always awards a point directly to the winning team (rally scoring).
  // Serve rotation is derived server-side from the rally_won event.
  const handleRallyWinner = (winningSide) => {
    if (disabled) return;
    onScore("rally_won", winningSide);
  };

  // Handle fault/error: faulting team loses, opposite team wins
  const handleFault = (faultingSide, faultOption = selectedFault) => {
    if (disabled) return;
    onScore(faultOption.eventType, faultingSide, null, {
      faultType: faultOption.faultType,
      faultingTeamSide: faultingSide,
    });
  };

  // Badge map for events
  const badgeMap = {
    rally_won: { label: "●", bg: "#16a34a" },
    side_out: { label: "SO", bg: "#f59e0b" },
    winner: { label: "W", bg: "#16a34a" },
    serve: { label: "S", bg: "#2563eb" },
    serve_error: { label: "SE", bg: "#b91c1c" },
    fault: { label: "F", bg: "#ef4444" },
    serve_fault: { label: "SF", bg: "#b91c1c" },
    kitchen_fault: { label: "K", bg: "#ef4444" },
    double_bounce_fault: { label: "2B", bg: "#ef4444" },
    foot_fault: { label: "FF", bg: "#ef4444" },
    out_fault: { label: "OUT", bg: "#ef4444" },
    net_fault: { label: "NET", bg: "#ef4444" },
    unforced_error: { label: "UE", bg: "#ef4444" },
    forced_error: { label: "FE", bg: "#f97316" },
    timeout: { label: "TO", bg: "#ca8a04" },
    undo: { label: "↩", bg: "#6B7280" },
  };
  const getEventBadge = (type) =>
    badgeMap[type] || { label: "•", bg: "#4B5563" };

  // Win probability — weighted: games won (±30%), current points (±3%/pt, cap ±15%)
  const gamesNeeded = matchFormat === "best_of_5" ? 3 : 2;
  const gamesDelta = (userGamesWon - opponentGamesWon) / gamesNeeded;
  const ptsDelta = Math.max(-15, Math.min(15, (userScore - opponentScore) * 3));
  const winProb = Math.min(95, Math.max(5, Math.round(50 + gamesDelta * 30 + ptsDelta)));
  const userRallyPalette = rallyPalette(userIsServing, UI);
  const oppRallyPalette = rallyPalette(!userIsServing, UI);

  return (
    <View style={{ width: "100%" }}>

      {/* ═══ SCORECARD TAB — Team cards + game history + event log ═══ */}
      {!isScoringTab && (
        <>
          {/* User team card */}
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: cardBorder,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: mutedText,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: "700",
                }}
              >
                {userTeamName}
              </Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: userIsServing ? accentSoft : (UI.isDark ? "rgba(255,255,255,0.05)" : UI.surfaceAlt),
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: userIsServing ? accent : dimText,
                  }}
                >
                  {userIsServing ? `🏓 Server #${serverNumber}` : "Receiving"}
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{ fontSize: 48, fontWeight: "700", color: homeAccent }}
              >
                {userScore}
              </Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{ fontSize: 10, color: dimText, marginBottom: 2 }}
                >
                  Games Won
                </Text>
                <Text
                  style={{ fontSize: 24, fontWeight: "700", color: primaryText }}
                >
                  {userGamesWon}
                </Text>
              </View>
            </View>
          </View>

          {/* Opponent team card */}
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: cardBorder,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: mutedText,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: "700",
                }}
              >
                {opponentTeamName}
              </Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: !userIsServing ? accentSoft : (UI.isDark ? "rgba(255,255,255,0.05)" : UI.surfaceAlt),
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: !userIsServing ? accent : dimText,
                  }}
                >
                  {!userIsServing ? `🏓 Server #${serverNumber}` : "Receiving"}
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{ fontSize: 86, fontWeight: "700", color: awayAccent }}
              >
                {opponentScore}
              </Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{ fontSize: 10, color: dimText, marginBottom: 2 }}
                >
                  Games Won
                </Text>
                <Text
                  style={{ fontSize: 24, fontWeight: "700", color: primaryText }}
                >
                  {opponentGamesWon}
                </Text>
              </View>
            </View>
          </View>

          {/* Bento cards: Game History + Win Prob */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: softCardBg,
                borderRadius: 12,
                padding: 14,
                borderWidth: UI.isDark ? 0 : 1,
                borderColor: cardBorder,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: labelCol,
                  textTransform: "uppercase",
                  letterSpacing: 3,
                  marginBottom: 12,
                }}
              >
                Game History
              </Text>
              {gameScores.length === 0 ? (
                <View
                  style={{
                    paddingVertical: 3,
                    paddingHorizontal: 6,
                    borderRadius: 6,
                    backgroundColor: accentSoft,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: dimText, marginBottom: 2 }}>
                    G1 · In Progress
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: homeAccent }}>
                    {userScore}–{opponentScore}
                  </Text>
                </View>
              ) : (
                gameScores.map((g, i) => {
                  const uPts = userIsHome ? g.player1Points : g.player2Points;
                  const oPts = userIsHome ? g.player2Points : g.player1Points;
                  const won = uPts > oPts;
                  const chip = won ? winChip : loseChip;
                  return (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                        paddingVertical: 3,
                        paddingHorizontal: 6,
                        borderRadius: 6,
                        backgroundColor: chip.bg,
                        borderWidth: 1,
                        borderColor: chip.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: mutedText,
                        }}
                      >
                        G{i + 1}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "900",
                          color: chip.text,
                        }}
                      >
                        {uPts}–{oPts}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: softCardBg,
                borderRadius: 12,
                padding: 14,
                borderWidth: UI.isDark ? 0 : 1,
                borderColor: cardBorder,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: labelCol,
                  textTransform: "uppercase",
                  letterSpacing: 3,
                  marginBottom: 12,
                }}
              >
                Win Prob.
              </Text>
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: homeAccent, minWidth: 34 }}>{winProb}%</Text>
                  <View style={{ flex: 1, height: 5, backgroundColor: UI.isDark ? "#313446" : UI.border, borderRadius: 3, overflow: "hidden" }}>
                    <View style={{ width: `${winProb}%`, height: "100%", backgroundColor: homeAccent, borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: 9, color: dimText, fontWeight: "700", minWidth: 50, textAlign: "right" }} numberOfLines={1}>{userTeamName}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: awayAccent, minWidth: 34 }}>{100 - winProb}%</Text>
                  <View style={{ flex: 1, height: 5, backgroundColor: UI.isDark ? "#313446" : UI.border, borderRadius: 3, overflow: "hidden" }}>
                    <View style={{ width: `${100 - winProb}%`, height: "100%", backgroundColor: awayAccent, borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: 9, color: dimText, fontWeight: "700", minWidth: 50, textAlign: "right" }} numberOfLines={1}>{opponentTeamName}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Event log */}
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: cardBorder,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: mutedText,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: "700",
                }}
              >
                Game {currentGameNumber} · Event Log
              </Text>
              <Text style={{ fontSize: 10, color: dimText }}>Race to 11</Text>
            </View>
            {gameEvents.length === 0 ? (
              <Text
                style={{ color: dimText, fontSize: 11, fontStyle: "italic" }}
              >
                No events yet
              </Text>
            ) : (
              gameEvents.map((e, i) => {
                const badge = getEventBadge(e.eventType);
                const eIsHome = String(e.teamId) === homeId;
                const eIsUser = userIsHome ? eIsHome : !eIsHome;
                return (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 6,
                      borderBottomWidth: i < gameEvents.length - 1 ? 1 : 0,
                      borderBottomColor: UI.isDark ? "rgba(255,255,255,0.05)" : UI.border,
                    }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: badge.bg,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: eIsUser ? 1 : 0.5,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "700",
                          color: "#fff",
                        }}
                      >
                        {badge.label}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: eIsUser ? homeAccent : awayAccent,
                        }}
                      >
                        {e.playerName ||
                          (eIsUser ? userTeamName : opponentTeamName)}
                      </Text>
                      <Text style={{ fontSize: 10, color: dimText }}>
                        {e.eventType === "side_out"
                          ? "Side Out"
                          : (e.eventType || "").replace(/_/g, " ")}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: dimText }}>
                      {e.pointScore
                        ? `${e.pointScore.player1}–${e.pointScore.player2}`
                        : ""}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}

      {/* ═══ PRIMARY RALLY ACTION — "WHO WON THE RALLY?" ═══ */}
      {/* {!displayOnly && isScoringTab && (
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <View style={{ backgroundColor: "rgba(71,254,183,0.1)", borderWidth: 1, borderColor: "rgba(71,254,183,0.24)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, alignItems: "center" }}>
            <Text style={{ color: "#47feb7", fontSize: 18, fontWeight: "900", letterSpacing: 2 }}>{scoreCall}</Text>
            <Text style={{ color: "#9CA3AF", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
              Server #{serverNumber} - {servingSide === "home" ? teamNames.home : teamNames.away} - {serverCourtSide}
            </Text>
          </View>
        </View>
      )} */}

      {!displayOnly && isScoringTab && activeAction !== "fault" && activeAction !== "winner_shot" && (
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "900",
              color: UI.isDark ? "rgba(71,254,183,0.9)" : "#15803D",
              textTransform: "uppercase",
              letterSpacing: 5,
              textAlign: "center",
              marginBottom: 14,
            }}
          >
            Who won the rally?
          </Text>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <RaisedBtn
              onPress={() => handleRallyWinner(userSide)}
              disabled={disabled}
              palette={userRallyPalette}
              isDark={UI.isDark}
              borderRadius={16}
              style={{ flex: 1, height: 96 }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  fontSize: 18,
                  color: userRallyPalette.text,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
                numberOfLines={1}
              >
                {userTeamName}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: userRallyPalette.sub,
                  marginTop: 4,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                +1 Point
              </Text>
            </RaisedBtn>

            <RaisedBtn
              onPress={() => handleRallyWinner(opponentSide)}
              disabled={disabled}
              palette={oppRallyPalette}
              isDark={UI.isDark}
              borderRadius={16}
              style={{ flex: 1, height: 96 }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  fontSize: 18,
                  color: oppRallyPalette.text,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
                numberOfLines={1}
              >
                {opponentTeamName}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: oppRallyPalette.sub,
                  marginTop: 4,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                +1 Point
              </Text>
            </RaisedBtn>
          </View>
        </View>
      )}

      {/* ═══ FAULT / WINNER BUTTONS (always visible) ═══ */}
      {!displayOnly && isScoringTab && activeAction !== "fault" && activeAction !== "winner_shot" && (
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <RaisedBtn
            onPress={() => setActiveAction("fault")}
            disabled={disabled}
            palette={faultBtnPalette}
            isDark={UI.isDark}
            style={{ flex: 1, paddingVertical: 14 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="warning" size={16} color={faultBtnPalette.icon} />
              <Text style={{ fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2, color: faultBtnPalette.text }}>Fault</Text>
            </View>
          </RaisedBtn>
          <RaisedBtn
            onPress={() => setActiveAction("winner_shot")}
            disabled={disabled}
            palette={winnerBtnPalette}
            isDark={UI.isDark}
            style={{ flex: 1, paddingVertical: 14 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="ribbon" size={16} color={winnerBtnPalette.icon} />
              <Text style={{ fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2, color: winnerBtnPalette.text }}>Winner</Text>
            </View>
          </RaisedBtn>
        </View>
      )}

      {/* ═══ TEAM SELECTION PROMPT (after tapping Fault / Winner) ═══ */}
      {!displayOnly && isScoringTab && (activeAction === "fault" || activeAction === "winner_shot") && (
        <View
          style={{
            backgroundColor: overlayBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: overlayBorder,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: primaryText,
                textTransform: "uppercase",
                letterSpacing: 2,
                flex: 1,
              }}
            >
              {activeAction === "fault"
                ? "Which team committed the fault?"
                : "Which team hit the winner?"}
            </Text>
            <TouchableOpacity
              onPress={() => setActiveAction(null)}
              style={{ paddingLeft: 12 }}
            >
              <Ionicons name="close" size={20} color={dimText} />
            </TouchableOpacity>
          </View>

          {activeAction === "fault" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {PICKLEBALL_FAULT_OPTIONS.map((option) => {
                const selected = selectedFault.eventType === option.eventType;
                const chip = selected
                  ? {
                      bg: UI.isDark ? "rgba(239,68,68,0.18)" : "#FEF2F2",
                      border: UI.isDark ? "rgba(239,68,68,0.48)" : "#FECACA",
                      icon: awayAccent,
                      text: awayAccent,
                    }
                  : {
                      bg: UI.isDark ? "rgba(255,255,255,0.05)" : UI.surfaceAlt,
                      border: UI.isDark ? "rgba(255,255,255,0.1)" : UI.border,
                      icon: mutedText,
                      text: primaryText,
                    };
                return (
                  <TouchableOpacity
                    key={option.eventType}
                    onPress={() => setSelectedFault(option)}
                    style={{
                      width: "31%",
                      minHeight: 52,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                      backgroundColor: chip.bg,
                      borderWidth: 1,
                      borderColor: chip.border,
                    }}
                  >
                    <Ionicons name={option.icon} size={14} color={chip.icon} />
                    <Text style={{ color: chip.text, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 12 }}>
            <RaisedBtn
              onPress={() => {
                if (activeAction === "fault") {
                  handleFault(userSide, selectedFault);
                } else {
                  handleRallyWinner(userSide);
                }
                setActiveAction(null);
              }}
              palette={chooseUserPalette}
              isDark={UI.isDark}
              borderRadius={14}
              style={{ flex: 1, paddingVertical: 16 }}
            >
              <Text
                style={{ color: chooseUserPalette.text, fontWeight: "800", fontSize: 14 }}
                numberOfLines={1}
              >
                {userTeamName}
              </Text>
            </RaisedBtn>
            <RaisedBtn
              onPress={() => {
                if (activeAction === "fault") {
                  handleFault(opponentSide, selectedFault);
                } else {
                  handleRallyWinner(opponentSide);
                }
                setActiveAction(null);
              }}
              palette={chooseOppPalette}
              isDark={UI.isDark}
              borderRadius={14}
              style={{ flex: 1, paddingVertical: 16 }}
            >
              <Text
                style={{ color: chooseOppPalette.text, fontWeight: "800", fontSize: 14 }}
                numberOfLines={1}
              >
                {opponentTeamName}
              </Text>
            </RaisedBtn>
          </View>
        </View>
      )}



      {/* ═══ UTILITY BAR — Undo + Timeout ═══ */}
      {!displayOnly && isScoringTab && (
        <View style={{ marginBottom: 16 }}>
          {/* Timeout team selection — shown inline when active */}
          {activeAction === "timeout" && (
            <View
              style={{
                backgroundColor: overlayBg,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: overlayBorder,
                padding: 14,
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: primaryText, textTransform: "uppercase", letterSpacing: 2 }}>
                  Which team called timeout?
                </Text>
                <TouchableOpacity onPress={() => setActiveAction(null)}>
                  <Ionicons name="close" size={18} color={dimText} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <RaisedBtn
                  onPress={() => { onScore("timeout", userSide); setActiveAction(null); }}
                  palette={chooseUserPalette}
                  isDark={UI.isDark}
                  borderRadius={12}
                  style={{ flex: 1, paddingVertical: 12 }}
                >
                  <Text style={{ color: chooseUserPalette.text, fontWeight: "800", fontSize: 13 }} numberOfLines={1}>{userTeamName}</Text>
                </RaisedBtn>
                <RaisedBtn
                  onPress={() => { onScore("timeout", opponentSide); setActiveAction(null); }}
                  palette={chooseOppPalette}
                  isDark={UI.isDark}
                  borderRadius={12}
                  style={{ flex: 1, paddingVertical: 12 }}
                >
                  <Text style={{ color: chooseOppPalette.text, fontWeight: "800", fontSize: 13 }} numberOfLines={1}>{opponentTeamName}</Text>
                </RaisedBtn>
              </View>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <RaisedBtn
              onPress={() => { if (!disabled && onUndo) onUndo(); }}
              disabled={disabled}
              palette={undoBtnPalette}
              isDark={UI.isDark}
              borderRadius={14}
              style={{ flex: 1, paddingVertical: 14, flexDirection: "row", gap: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="arrow-undo" size={18} color={undoBtnPalette.icon} />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: undoBtnPalette.text,
                  }}
                >
                  Undo
                </Text>
              </View>
            </RaisedBtn>
            <RaisedBtn
              onPress={() => setActiveAction(activeAction === "timeout" ? null : "timeout")}
              disabled={disabled}
              palette={activeAction === "timeout" ? timeoutActivePalette : timeoutBtnPalette}
              isDark={UI.isDark}
              borderRadius={14}
              style={{ flex: 1, paddingVertical: 14, flexDirection: "row", gap: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons
                  name="timer-outline"
                  size={18}
                  color={(activeAction === "timeout" ? timeoutActivePalette : timeoutBtnPalette).icon}
                />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: (activeAction === "timeout" ? timeoutActivePalette : timeoutBtnPalette).text,
                  }}
                >
                  Timeout
                </Text>
              </View>
            </RaisedBtn>
          </View>
        </View>
      )}

      {/* ═══ NOT LIVE ═══ */}
      {isScoringTab && !isLive && !gameOver && (
        <View
          style={{
            alignItems: "center",
            paddingVertical: 32,
            backgroundColor: waitingBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.isDark ? "rgba(59,74,65,0.2)" : UI.border,
          }}
        >
          <Text style={{ fontSize: 28, marginBottom: 8 }}>🏓</Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 3,
              color: labelCol,
            }}
          >
            Waiting for Match to Start
          </Text>
          <Text
            style={{
              color: mutedText,
              fontSize: 11,
              marginTop: 8,
              opacity: 0.8,
              textAlign: "center",
              paddingHorizontal: 16,
            }}
          >
            Scoring controls will be activated once the game is live.
          </Text>
          {isOwner && onStartGame && (
            <TouchableOpacity
              onPress={() => onStartGame()}
              disabled={isUpdating}
              style={{
                marginTop: 16,
                backgroundColor: "#16a34a",
                paddingHorizontal: 32,
                paddingVertical: 12,
                borderRadius: 12,
                borderBottomWidth: 3,
                borderBottomColor: "#166534",
                opacity: isUpdating ? 0.5 : 1,
              }}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>▶ Start Game</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ═══ GAME OVER ═══ */}
      {isScoringTab && gameOver && (() => {
        // Completed games from the model
        const hasCompletedGames = gameScores.length > 0;
        // Was there an in-progress game when it ended?
        const hasPartialGame = userScore > 0 || opponentScore > 0;
        // Winner label
        const userWon = userGamesWon > opponentGamesWon ||
          (!hasCompletedGames && userScore > opponentScore);
        const isTied = !hasCompletedGames && userScore === opponentScore;

        return (
          <View style={{ backgroundColor: "#171a2c", borderRadius: 16, borderWidth: 1, borderColor: "rgba(55,65,81,0.3)", overflow: "hidden" }}>
            {/* Trophy header */}
            <View style={{ alignItems: "center", paddingTop: 28, paddingBottom: 20, paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 36, marginBottom: 6 }}>🏆</Text>
              <Text style={{ fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 3, color: "#9CA3AF" }}>
                Match Ended
              </Text>
            </View>

            {/* Main result — shows games won if any full game completed, else shows point score */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20, marginBottom: 16 }}>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#47feb7", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }} numberOfLines={1}>
                  {userTeamName}
                </Text>
                <Text style={{ fontSize: 48, fontWeight: "900", lineHeight: 52, color: userWon && !isTied ? "#47feb7" : "#dfe1f9" }}>
                  {hasCompletedGames ? userGamesWon : userScore}
                </Text>
                <Text style={{ fontSize: 9, color: "#6B7280", fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }}>
                  {hasCompletedGames ? "games won" : "points"}
                </Text>
              </View>

              <Text style={{ fontSize: 24, color: "#374151", fontWeight: "900", marginBottom: 12 }}>—</Text>

              <View style={{ flex: 1, alignItems: "flex-start" }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#f87171", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }} numberOfLines={1}>
                  {opponentTeamName}
                </Text>
                <Text style={{ fontSize: 48, fontWeight: "900", lineHeight: 52, color: !userWon && !isTied ? "#f87171" : "#dfe1f9" }}>
                  {hasCompletedGames ? opponentGamesWon : opponentScore}
                </Text>
                <Text style={{ fontSize: 9, color: "#6B7280", fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }}>
                  {hasCompletedGames ? "games won" : "points"}
                </Text>
              </View>
            </View>

            {/* Game-by-game breakdown */}
            {(hasCompletedGames || hasPartialGame) && (
              <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", paddingVertical: 14, paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: "#6B7280", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10, textAlign: "center" }}>
                  Score Breakdown
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {gameScores.map((g, i) => {
                    const uPts = userIsHome ? g.player1Points : g.player2Points;
                    const oPts = userIsHome ? g.player2Points : g.player1Points;
                    const gWon = uPts > oPts;
                    return (
                      <View key={i} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: gWon ? "rgba(71,254,183,0.1)" : "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: gWon ? "rgba(71,254,183,0.2)" : "rgba(239,68,68,0.15)" }}>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: "#6B7280", textAlign: "center", marginBottom: 2 }}>G{i + 1}</Text>
                        <Text style={{ fontSize: 14, fontWeight: "900", color: gWon ? "#47feb7" : "#f87171" }}>
                          {uPts}–{oPts}
                        </Text>
                      </View>
                    );
                  })}
                  {/* Show the in-progress/final partial game if points were scored */}
                  {hasPartialGame && (
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                      <Text style={{ fontSize: 9, fontWeight: "700", color: "#6B7280", textAlign: "center", marginBottom: 2 }}>
                        G{gameScores.length + 1} {hasCompletedGames ? "(final)" : ""}
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: "900", color: "#dfe1f9" }}>
                        {userScore}–{opponentScore}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        );
      })()}
    </View>
  );
}

export default PickleballScoringPanelMobile;

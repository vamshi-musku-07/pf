import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

/** Exact face colors — 3D depth only adds darker rims, not new fills. */
const TT_BTN = {
  userScore: { bg: "#01e19d", border: "#00c489", deep: "#009968", text: "#005e3f" },
  oppScore: { bg: "#313446", border: "#3d4158", deep: "#1f2230", text: "#dfe1f9" },
  action: { bg: "#26293b", border: "#32364c", deep: "#1a1c2a", text: "#b8c3ff", errorText: "#ffdacb" },
  utility: { bg: "#171a2c", border: "#22263a", deep: "#0f111c" },
};

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
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: palette.bg,
        borderRadius,
        borderWidth: 1,
        borderColor: palette.border,
        borderBottomWidth: 4,
        borderBottomColor: palette.deep,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
        ...raisedScoreShadow(isDark),
        ...style,
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

function TableTennisScoreboardCard({
  currentGame,
  teamNames = { home: "Home", away: "Away" },
  isUpdating,
  gameOver,
  displayOnly = false,
  userSide = "home",
  onEndGame,
  onPauseResume,
  onStartGame,
  isScheduled = false,
  isOwner = false,
  gameTime,
}) {
  const UI = useGameScoringTheme();
  const accent = UI.isDark ? "#47FEB7" : "#059669";
  const accentSoft = UI.isDark ? "rgba(71,254,183,0.15)" : "rgba(5,150,105,0.12)";
  const labelCol = UI.isDark ? "#b8c3ff" : "#6366F1";
  const primaryText = UI.isDark ? "#dfe1f9" : UI.text;
  const secondaryText = UI.isDark ? "#bacbbf" : UI.muted;
  const dashCol = UI.isDark ? "#84958a" : "#94A3B8";
  const cardBg = UI.isDark ? "#313446" : UI.card;
  const divider = UI.isDark ? "rgba(59,74,65,0.3)" : UI.border;
  const topRule = UI.isDark ? "rgba(255,255,255,0.08)" : UI.border;

  const sport = currentGame?.sport;
  const opponentSide = userSide === "home" ? "away" : "home";
  const userIsHome = userSide === "home";

  const pointScore = sport?.currentPointScore || { player1: 0, player2: 0 };
  const matchScore = sport?.score || { home: 0, away: 0 };
  const servingTeam = sport?.servingTeam || "home";
  const matchFormat = sport?.matchFormat || "best_of_5";
  const timeouts = sport?.timeouts || {};
  const matchFormatLabel =
    matchFormat === "best_of_7"
      ? "Best of 7"
      : matchFormat === "best_of_3"
        ? "Best of 3"
        : "Best of 5";

  const u = {
    gamesWon: userIsHome ? matchScore.home : matchScore.away,
    points: userIsHome ? pointScore.player1 : pointScore.player2,
    pointsPadded: String(
      userIsHome ? pointScore.player1 : pointScore.player2,
    ).padStart(2, "0"),
    serving: servingTeam === userSide,
    name: userIsHome ? teamNames.home : teamNames.away,
  };
  const o = {
    gamesWon: userIsHome ? matchScore.away : matchScore.home,
    points: userIsHome ? pointScore.player2 : pointScore.player1,
    pointsPadded: String(
      userIsHome ? pointScore.player2 : pointScore.player1,
    ).padStart(2, "0"),
    serving: servingTeam === opponentSide,
    name: userIsHome ? teamNames.away : teamNames.home,
  };

  const isDeuce = u.points >= 10 && o.points >= 10 && u.points === o.points;
  const userTimeoutRemaining = userIsHome
    ? timeouts?.player1?.remaining ?? 1
    : timeouts?.player2?.remaining ?? 1;
  const opponentTimeoutRemaining = userIsHome
    ? timeouts?.player2?.remaining ?? 1
    : timeouts?.player1?.remaining ?? 1;

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderLeftWidth: 4,
        borderLeftColor: accent,
        borderWidth: UI.isDark ? 0 : 1,
        borderColor: UI.isDark ? "transparent" : UI.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 4,
              color: labelCol,
            }}
          >
            GAMES WON
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text style={{ fontSize: 36, fontWeight: "900", color: primaryText }}>
              {u.gamesWon}
            </Text>
            <Text style={{ fontSize: 18, color: dashCol, fontWeight: "700" }}>
              -
            </Text>
            <Text style={{ fontSize: 36, fontWeight: "900", color: secondaryText }}>
              {o.gamesWon}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 4,
              color: labelCol,
            }}
          >
            {matchFormatLabel.toUpperCase()}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingVertical: 6,
        }}
      >
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text
            style={{
              fontSize: 52,
              fontWeight: "900",
              color: u.serving ? accent : primaryText,
              letterSpacing: -2,
              lineHeight: 56,
            }}
          >
            {u.pointsPadded}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "900",
              textTransform: "uppercase",
              letterSpacing: 3,
              color: primaryText,
              marginTop: 8,
            }}
            numberOfLines={1}
          >
            {u.name}
          </Text>
          {u.serving && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, backgroundColor: accentSoft, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, gap: 4 }}>
              <Ionicons name="radio-button-on" size={8} color={accent} />
              <Text style={{ fontSize: 9, fontWeight: "900", color: accent, letterSpacing: 2 }}>SERVING</Text>
            </View>
          )}
        </View>
        <View style={{ height: 46, width: 1, backgroundColor: divider }} />
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text
            style={{
              fontSize: 52,
              fontWeight: "900",
              color: o.serving ? accent : (UI.isDark ? "rgba(186,203,191,0.5)" : UI.textMuted),
              letterSpacing: -2,
              lineHeight: 56,
            }}
          >
            {o.pointsPadded}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "900",
              textTransform: "uppercase",
              letterSpacing: 3,
              color: secondaryText,
              marginTop: 8,
            }}
            numberOfLines={1}
          >
            {o.name}
          </Text>
          {o.serving && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, backgroundColor: accentSoft, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, gap: 4 }}>
              <Ionicons name="radio-button-on" size={8} color={accent} />
              <Text style={{ fontSize: 9, fontWeight: "900", color: accent, letterSpacing: 2 }}>SERVING</Text>
            </View>
          )}
        </View>
      </View>
      {isDeuce && (
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <View
            style={{
              backgroundColor: UI.isDark ? "rgba(249,115,22,0.1)" : "#FFEDD5",
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "900", color: UI.isDark ? "#fb923c" : "#C2410C" }}>
              DEUCE
            </Text>
          </View>
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: 16,
          marginBottom: 4,
        }}
      >
        <Text style={{ color: primaryText, fontSize: 11, fontWeight: "700" }}>
          {u.name} TO: {userTimeoutRemaining}
        </Text>
        <Text style={{ color: secondaryText, fontSize: 11, fontWeight: "700" }}>
          {o.name} TO: {opponentTimeoutRemaining}
        </Text>
      </View>
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: topRule,
          marginTop: 4,
          paddingTop: 8,
          alignItems: "center",
        }}
      >
        {isScheduled && isOwner && (
          <TouchableOpacity
            onPress={onStartGame}
            disabled={isUpdating}
            style={{
              backgroundColor: "#16a34a",
              paddingHorizontal: 24,
              paddingVertical: 10,
              borderRadius: 10,
              borderBottomWidth: 3,
              borderBottomColor: "#166534",
              opacity: isUpdating ? 0.5 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
              Start Game
            </Text>
          </TouchableOpacity>
        )}

        {!isScheduled && !displayOnly && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={onPauseResume}
              disabled={gameOver || isUpdating}
              style={{
                backgroundColor: "#eab308",
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 10,
                borderBottomWidth: 3,
                borderBottomColor: "#A16207",
                opacity: gameOver || isUpdating ? 0.5 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                {gameTime?.isRunning ? "Pause" : "Resume"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onEndGame}
              disabled={gameOver}
              style={{
                backgroundColor: "#ef4444",
                paddingHorizontal: 24,
                paddingVertical: 10,
                borderRadius: 10,
                borderBottomWidth: 3,
                borderBottomColor: "#B91C1C",
                opacity: gameOver ? 0.5 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                End Game
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function TableTennisScoringPanelMobile({
  currentGame,
  teamNames = { home: "Home", away: "Away" },
  isUpdating,
  onScore,
  gameOver,
  displayOnly = false,
  userSide = "home",
  onEndGame,
  onPauseResume,
  onStartGame,
  isScheduled = false,
  isOwner = false,
  gameTime,
  hideScoreboard = false,
  players,
}) {
  const UI = useGameScoringTheme();
  const accent = UI.isDark ? "#47FEB7" : "#059669";
  const accentSoft = UI.isDark ? "rgba(71,254,183,0.08)" : "rgba(5,150,105,0.1)";
  const accentBorder = UI.isDark ? "rgba(71,254,183,0.2)" : "rgba(5,150,105,0.28)";
  const labelCol = UI.isDark ? "#b8c3ff" : "#6366F1";
  const chipBg = UI.isDark ? "rgba(184,195,255,0.1)" : "rgba(99,102,241,0.1)";
  const waitingBg = UI.isDark ? "#171a2c" : UI.card;
  const historyBg = UI.isDark ? "rgba(255,255,255,0.03)" : UI.card;
  const historyBorder = UI.isDark ? "rgba(255,255,255,0.1)" : UI.border;
  const modalBg = UI.isDark ? "#1f2237" : "#FFFFFF";
  const modalText = UI.isDark ? "#dfe1f9" : UI.text;
  const optionBg = UI.isDark ? "rgba(255,255,255,0.05)" : UI.surfaceAlt;
  const optionBorder = UI.isDark ? "rgba(255,255,255,0.08)" : UI.border;

  const sport = currentGame?.sport;
  const isLive = currentGame?.base?.status === "live";
  const opponentSide = userSide === "home" ? "away" : "home";
  const userIsHome = userSide === "home";
  const [timeoutNow, setTimeoutNow] = useState(Date.now());
  const lastTapRef = useRef(0);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);

  const pointScore = sport?.currentPointScore || { player1: 0, player2: 0 };
  const matchScore = sport?.score || { home: 0, away: 0 };
  const servingTeam = sport?.servingTeam || "home";
  const gameScores = sport?.gameScores || [];
  const isMatchFinal = sport?.matchStatus === "final";
  const activeTimeout = sport?.activeTimeout || null;
  const activeTimeoutEndsAtMs = activeTimeout?.endsAt ? new Date(activeTimeout.endsAt).getTime() : 0;
  const isTimeoutActive = !!(activeTimeout?.isActive && activeTimeoutEndsAtMs > timeoutNow);

  const u = {
    gamesWon: userIsHome ? matchScore.home : matchScore.away,
    points: userIsHome ? pointScore.player1 : pointScore.player2,
    pointsPadded: String(
      userIsHome ? pointScore.player1 : pointScore.player2,
    ).padStart(2, "0"),
    serving: servingTeam === userSide,
    name: userIsHome ? teamNames.home : teamNames.away,
  };
  const o = {
    gamesWon: userIsHome ? matchScore.away : matchScore.home,
    points: userIsHome ? pointScore.player2 : pointScore.player1,
    pointsPadded: String(
      userIsHome ? pointScore.player2 : pointScore.player1,
    ).padStart(2, "0"),
    serving: servingTeam === opponentSide,
    name: userIsHome ? teamNames.away : teamNames.home,
  };

  const userTimeoutRemaining = userIsHome
    ? sport?.timeouts?.player1?.remaining ?? 1
    : sport?.timeouts?.player2?.remaining ?? 1;
  const timeoutRemainingSeconds = isTimeoutActive
    ? Math.max(0, Math.ceil((activeTimeoutEndsAtMs - timeoutNow) / 1000))
    : 0;
  const timeoutCalledByName = activeTimeout?.calledBy === userSide ? u.name : o.name;
  const disabled = isUpdating || gameOver || isMatchFinal || isTimeoutActive;
  const timeoutDisabled = disabled || userTimeoutRemaining <= 0 || isTimeoutActive;

  useEffect(() => {
    if (!isTimeoutActive) return undefined;

    setTimeoutNow(Date.now());
    const intervalId = setInterval(() => {
      setTimeoutNow(Date.now());
    }, 500);

    return () => clearInterval(intervalId);
  }, [isTimeoutActive, activeTimeout?.endsAt]);

  const displayGames = gameScores.map((g) => ({
    userPoints: userIsHome ? g.player1Points : g.player2Points,
    oppPoints: userIsHome ? g.player2Points : g.player1Points,
    userWon: userIsHome ? g.winner === "player1" : g.winner === "player2",
  }));

  const debouncedScore = useCallback((eventType, side) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) return;
    lastTapRef.current = now;
    onScore(eventType, side, selectedPlayer);
  }, [onScore, selectedPlayer]);

  const matchFormat = sport?.matchFormat || "best_of_5";
  const totalGames = matchFormat === "best_of_7" ? 7 : matchFormat === "best_of_3" ? 3 : 5;
  const currentGameNumber = sport?.currentGame || 1;

  const userPlayers = useMemo(() => (players?.[userSide] || []).filter(Boolean), [players, userSide]);
  const isDoubles = userPlayers.length > 1;

  const winChip = {
    bg: UI.isDark ? "rgba(71,254,183,0.1)" : "rgba(5,150,105,0.1)",
    border: UI.isDark ? "rgba(71,254,183,0.3)" : "rgba(5,150,105,0.35)",
    text: accent,
  };
  const loseChip = {
    bg: UI.isDark ? "rgba(239,68,68,0.1)" : "#FEF2F2",
    border: UI.isDark ? "rgba(239,68,68,0.3)" : "#FECACA",
    text: UI.isDark ? "#f87171" : "#DC2626",
  };

  return (
    <View style={{ width: "100%" }}>
      {!hideScoreboard && (
        <View style={{ marginBottom: 16 }}>
          <TableTennisScoreboardCard
            currentGame={currentGame}
            teamNames={teamNames}
            isUpdating={isUpdating}
            gameOver={gameOver}
            displayOnly={displayOnly}
            userSide={userSide}
            onEndGame={onEndGame}
            onPauseResume={onPauseResume}
            onStartGame={onStartGame}
            isScheduled={isScheduled}
            isOwner={isOwner}
            gameTime={gameTime}
          />
        </View>
      )}

      {!displayOnly && isLive && (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingHorizontal: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="radio-button-on" size={8} color={accent} />
              <Text style={{ fontSize: 11, fontWeight: "800", color: accent }}>
                {u.serving ? u.name : o.name} serving
              </Text>
            </View>
            <View style={{ backgroundColor: chipBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: labelCol, letterSpacing: 1 }}>
                Game {currentGameNumber} of {totalGames}
              </Text>
            </View>
          </View>

          {isDoubles && (
            <TouchableOpacity
              onPress={() => setShowPlayerPicker(true)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 12, paddingVertical: 8, backgroundColor: accentSoft, borderRadius: 10, borderWidth: 1, borderColor: accentBorder }}
            >
              <Ionicons name="person" size={12} color={accent} style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: accent }}>
                {selectedPlayer ? `Scorer: ${selectedPlayer.firstName || ""} ${selectedPlayer.lastName || ""}`.trim() : "Tap to select scorer"}
              </Text>
              <Ionicons name="chevron-down" size={12} color={accent} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}

          {isTimeoutActive && (
            <View
              style={{
                marginBottom: 18,
                paddingHorizontal: 18,
                paddingVertical: 16,
                borderRadius: 14,
                backgroundColor: UI.isDark ? "rgba(234,179,8,0.14)" : "#FEF3C7",
                borderWidth: 1,
                borderColor: UI.isDark ? "rgba(234,179,8,0.35)" : "#F59E0B",
                alignItems: "center",
              }}
            >
              <Text style={{ color: UI.isDark ? "#facc15" : "#B45309", fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" }}>
                ⏸ Timeout Called by {timeoutCalledByName}
              </Text>
              <Text style={{ color: UI.isDark ? "#fff" : UI.text, fontSize: 28, fontWeight: "900", marginTop: 6 }}>
                {String(Math.floor(timeoutRemainingSeconds / 60)).padStart(2, "0")}:{String(timeoutRemainingSeconds % 60).padStart(2, "0")}
              </Text>
              <Text style={{ color: UI.isDark ? "#FDE68A" : "#92400E", fontSize: 11, marginTop: 6 }}>
                Scoring disabled. Resumes at {activeTimeoutEndsAtMs ? new Date(activeTimeoutEndsAtMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 16, marginBottom: 24 }}>
            <View style={{ flex: 1, gap: 12 }}>
              <RaisedBtn
                disabled={disabled}
                onPress={() => !disabled && debouncedScore("pointWon", userSide)}
                palette={TT_BTN.userScore}
                isDark={UI.isDark}
                style={{ height: 192 }}
              >
                <Text style={{ fontSize: 48, fontWeight: "900", color: TT_BTN.userScore.text }}>
                  +1
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 4,
                    color: TT_BTN.userScore.text,
                    marginTop: 8,
                    opacity: 0.8,
                  }}
                >
                  SCORE POINT
                </Text>
              </RaisedBtn>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <RaisedBtn
                  onPress={() => !disabled && debouncedScore("serve_ace", userSide)}
                  disabled={disabled}
                  palette={TT_BTN.action}
                  isDark={UI.isDark}
                  borderRadius={10}
                  style={{ flex: 1, paddingVertical: 12 }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      color: TT_BTN.action.text,
                    }}
                  >
                    ACE
                  </Text>
                </RaisedBtn>
                <RaisedBtn
                  onPress={() => !disabled && debouncedScore("forehand_smash", userSide)}
                  disabled={disabled}
                  palette={TT_BTN.action}
                  isDark={UI.isDark}
                  borderRadius={10}
                  style={{ flex: 1, paddingVertical: 12 }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      color: TT_BTN.action.text,
                    }}
                  >
                    WINNER
                  </Text>
                </RaisedBtn>
              </View>
              <RaisedBtn
                onPress={() => !disabled && debouncedScore("unforced_error", opponentSide)}
                disabled={disabled}
                palette={TT_BTN.action}
                isDark={UI.isDark}
                borderRadius={10}
                style={{ paddingVertical: 12, width: "100%" }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: TT_BTN.action.errorText,
                  }}
                >
                  OPP ERROR
                </Text>
              </RaisedBtn>
            </View>
            <View style={{ flex: 1, gap: 12 }}>
              <RaisedBtn
                disabled={disabled}
                onPress={() => !disabled && debouncedScore("pointWon", opponentSide)}
                palette={TT_BTN.oppScore}
                isDark={UI.isDark}
                style={{ height: 192 }}
              >
                <Text style={{ fontSize: 48, fontWeight: "900", color: TT_BTN.oppScore.text }}>
                  +1
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 4,
                    color: TT_BTN.oppScore.text,
                    marginTop: 8,
                    opacity: 0.6,
                  }}
                >
                  SCORE POINT
                </Text>
              </RaisedBtn>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <RaisedBtn
                  onPress={() => !disabled && debouncedScore("serve_ace", opponentSide)}
                  disabled={disabled}
                  palette={TT_BTN.action}
                  isDark={UI.isDark}
                  borderRadius={10}
                  style={{ flex: 1, paddingVertical: 12 }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      color: TT_BTN.action.text,
                    }}
                  >
                    ACE
                  </Text>
                </RaisedBtn>
                <RaisedBtn
                  onPress={() => !disabled && debouncedScore("forehand_smash", opponentSide)}
                  disabled={disabled}
                  palette={TT_BTN.action}
                  isDark={UI.isDark}
                  borderRadius={10}
                  style={{ flex: 1, paddingVertical: 12 }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      color: TT_BTN.action.text,
                    }}
                  >
                    WINNER
                  </Text>
                </RaisedBtn>
              </View>
              <RaisedBtn
                onPress={() => !disabled && debouncedScore("unforced_error", userSide)}
                disabled={disabled}
                palette={TT_BTN.action}
                isDark={UI.isDark}
                borderRadius={10}
                style={{ paddingVertical: 12, width: "100%" }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: TT_BTN.action.errorText,
                  }}
                >
                  OPP ERROR
                </Text>
              </RaisedBtn>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            {[
              { type: "timeout", label: "Timeout", color: TT_BTN.action.errorText },
              { type: "let", label: "Let", color: UI.isDark ? "#bacbbf" : "#64748B" },
            ].map((btn) => (
              <RaisedBtn
                key={btn.type}
                onPress={() => !((btn.type === "timeout" ? timeoutDisabled : disabled)) && debouncedScore(btn.type, userSide)}
                disabled={btn.type === "timeout" ? timeoutDisabled : disabled}
                palette={TT_BTN.utility}
                isDark={UI.isDark}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: btn.color,
                  }}
                >
                  {btn.type === "timeout" ? `Timeout (${userTimeoutRemaining})` : btn.label}
                </Text>
              </RaisedBtn>
            ))}
          </View>
        </>
      )}

      {!displayOnly && !isLive && !gameOver && (
        <View
          style={{
            alignItems: "center",
            paddingVertical: 32,
            backgroundColor: waitingBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.isDark ? "rgba(59,74,65,0.2)" : UI.border,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 28, marginBottom: 8 }}>🏓</Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 4,
              color: labelCol,
            }}
          >
            Waiting for Match to Start
          </Text>
          <Text
            style={{
              color: UI.muted,
              fontSize: 11,
              marginTop: 8,
              opacity: 0.8,
              textAlign: "center",
              paddingHorizontal: 16,
            }}
          >
            Scoring controls will be activated once the game is live.
          </Text>
        </View>
      )}

      {displayGames.length > 0 && (
        <View
          style={{
            backgroundColor: historyBg,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: historyBorder,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: UI.textMuted,
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: "600",
              marginBottom: 8,
            }}
          >
            Game History
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {displayGames.map((g, idx) => {
              const chip = g.userWon ? winChip : loseChip;
              return (
                <View
                  key={idx}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 8,
                    borderWidth: 1,
                    backgroundColor: chip.bg,
                    borderColor: chip.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: chip.text,
                    }}
                  >
                    G{idx + 1}: {g.userPoints}–{g.oppPoints}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <Modal
        visible={showPlayerPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlayerPicker(false)}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: UI.overlay }}>
          <View style={{ backgroundColor: modalBg, borderRadius: 16, padding: 20, width: "80%", maxWidth: 320, borderWidth: UI.isDark ? 0 : 1, borderColor: UI.border }}>
            <Text style={{ color: modalText, fontSize: 14, fontWeight: "800", marginBottom: 16, textAlign: "center" }}>Select Scorer</Text>
            {userPlayers.map((p) => {
              const name = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Player";
              const isSelected = selectedPlayer && (selectedPlayer._id || selectedPlayer.id) === (p._id || p.id);
              return (
                <TouchableOpacity
                  key={p._id || p.id}
                  onPress={() => { setSelectedPlayer(p); setShowPlayerPicker(false); }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    marginBottom: 8,
                    backgroundColor: isSelected ? accentSoft : optionBg,
                    borderWidth: 1,
                    borderColor: isSelected ? accentBorder : optionBorder,
                  }}
                >
                  <Text style={{ color: isSelected ? accent : modalText, fontSize: 13, fontWeight: "700" }}>{name}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => { setSelectedPlayer(null); setShowPlayerPicker(false); }}
              style={{ paddingVertical: 10, alignItems: "center", marginTop: 4 }}
            >
              <Text style={{ color: UI.textMuted, fontSize: 12, fontWeight: "600" }}>Clear Selection (Team)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}


export default TableTennisScoringPanelMobile;
export { TableTennisScoreboardCard };

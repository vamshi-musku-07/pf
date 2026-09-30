import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import { fonts } from "@/constants/typography";

const BADMINTON_SHUTTLE_3D = require("@/assets/images/badminton-shuttlecock-3d-v2.png");

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

/** Active serve keeps original green; idle states adapt for light theme. */
function rallyPalette(active, hasServe, UI) {
  if (active) {
    return { bg: "#16a34a", border: "#4ade80", deep: "#166534", text: "#fff", sub: "#dcfce7" };
  }
  if (!hasServe) {
    return {
      bg: UI.isDark ? "rgba(34,197,94,0.2)" : "#DCFCE7",
      border: UI.isDark ? "rgba(34,197,94,0.3)" : "#86EFAC",
      deep: UI.isDark ? "rgba(22,163,74,0.5)" : "#22C55E",
      text: UI.isDark ? "#4ade80" : "#15803D",
      sub: UI.isDark ? "#dcfce7" : "#166534",
    };
  }
  return {
    bg: UI.isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6",
    border: UI.isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB",
    deep: UI.isDark ? "rgba(15,23,42,0.55)" : "#D1D5DB",
    text: UI.isDark ? "#9CA3AF" : "#6B7280",
    sub: UI.isDark ? "#6B7280" : "#9CA3AF",
  };
}

const BADMINTON_EVENT_LABELS = {
  pointWon: "Point won",
  ace: "Ace",
  smash: "Smash winner",
  drop: "Drop winner",
  clear: "Clear winner",
  net_shot: "Net shot winner",
  lift: "Lift winner",
  drive: "Drive winner",
  push: "Push winner",
  flick: "Flick winner",
  flick_serve: "Flick serve winner",
  fault: "Fault",
  service_fault: "Service fault",
  let: "Let",
  undo: "Correction",
};

function getBadmintonEventLabel(eventType) {
  return BADMINTON_EVENT_LABELS[eventType] || String(eventType || "Rally").replace(/_/g, " ");
}

function getBadmintonTeamSide(event, homeId) {
  if (!event) return null;
  return String(event.teamId || "") === String(homeId || "") ? "home" : "away";
}

function resolveBadmintonPlayerName(allPlayers, playerId) {
  if (!playerId) return "Team";
  const normalizedId = String(playerId);
  if (normalizedId.startsWith("team_")) return "Team";
  const player = (allPlayers || []).find((entry) => {
    const ids = [entry?._id, entry?.id, entry?.userId, entry?.playerId]
      .filter(Boolean)
      .map((v) => String(v));
    return ids.includes(normalizedId);
  });
  if (!player) return "Player";
  const fromParts = `${player.firstName || ""} ${player.lastName || ""}`.trim();
  if (fromParts) return fromParts;
  const alt = String(
    player.playerName || player.name || player.displayName || player.username || "",
  ).trim();
  return alt || "Player";
}

function badmintonDisplayName(resolvedName, fallbackTeamName) {
  if (!resolvedName || resolvedName === "Team" || resolvedName === "Player") {
    return fallbackTeamName || "Team";
  }
  return resolvedName;
}

function buildBadmintonTimeline(events, currentGameNumber, homeId, teamNames, allPlayers) {
  return (events || [])
    .filter((event) => event && Number(event.gameNumber || currentGameNumber) === currentGameNumber)
    .slice(-5)
    .reverse()
    .map((event, index) => {
      const teamSide = getBadmintonTeamSide(event, homeId);
      const teamLabel = teamSide === "home" ? teamNames.home : teamNames.away;
      const actorName = resolveBadmintonPlayerName(allPlayers, event.playerId);
      const actionLabel = getBadmintonEventLabel(event.eventType);
      const actorLabel = badmintonDisplayName(actorName, teamLabel);
      const detail = event.eventType === "let"
        ? `${actorLabel} called a let. Rally replayed.`
        : event.eventType === "service_fault"
          ? `${actorLabel} committed a service fault. Serve changes.`
          : event.eventType === "fault"
            ? `${actorLabel} committed a fault. Point to ${teamSide === "home" ? teamNames.away : teamNames.home}.`
            : `${actorLabel} won the rally for ${teamLabel}.`;

      return {
        id: event._id || `${event.eventType || "event"}-${index}`,
        actionLabel,
        teamLabel,
        detail,
        teamSide,
      };
    });
}

function buildBadmintonStats(events, homeId) {
  const rallyEvents = (events || []).filter((event) => event && event.eventType !== "undo");
  let currentRunSide = null;
  let currentRunLength = 0;
  let longestRun = { side: null, length: 0 };
  let servicePointsWon = 0;
  let servicePointsLost = 0;
  let faultsCommitted = 0;
  let serviceFaultsCommitted = 0;
  const winnerCounts = { smash: 0, ace: 0, drop: 0, clear: 0, net_shot: 0, drive: 0, push: 0, flick: 0, flick_serve: 0 };

  rallyEvents.forEach((event) => {
    const teamSide = getBadmintonTeamSide(event, homeId);
    if (event.eventType === "let") return;

    let scoringSide = teamSide;
    if (event.eventType === "fault" || event.eventType === "service_fault") {
      scoringSide = teamSide === "home" ? "away" : "home";
      faultsCommitted += event.eventType === "fault" ? 1 : 0;
      serviceFaultsCommitted += event.eventType === "service_fault" ? 1 : 0;
    } else if (winnerCounts[event.eventType] !== undefined) {
      winnerCounts[event.eventType] += 1;
    }

    if (event.servingTeam && event.servingTeam === scoringSide) servicePointsWon += 1;
    if (event.servingTeam && event.servingTeam !== scoringSide) servicePointsLost += 1;

    if (currentRunSide === scoringSide) {
      currentRunLength += 1;
    } else {
      currentRunSide = scoringSide;
      currentRunLength = 1;
    }

    if (currentRunLength > longestRun.length) {
      longestRun = { side: scoringSide, length: currentRunLength };
    }
  });

  return {
    rallyCount: rallyEvents.length,
    correctionCount: (events || []).filter((event) => event?.eventType === "undo").length,
    servicePointsWon,
    servicePointsLost,
    faultsCommitted,
    serviceFaultsCommitted,
    longestRun,
    winnerCounts,
  };
}

function BadmintonScoringPanelMobile({
  currentGame,
  teamNames = { home: "Home", away: "Away" },
  players = { home: [], away: [] },
  isUpdating,
  onScore,
  gameOver,
  displayOnly = false,
  isScoringTab = false,
  userSide = "home",
  onEndGame,
}) {
  const UI = useGameScoringTheme();
  const homeAccent = UI.isDark ? "#4ade80" : "#15803D";
  const awayAccent = UI.isDark ? "#f87171" : "#DC2626";
  const warnAccent = UI.isDark ? "#facc15" : "#B45309";
  const warnSoft = UI.isDark ? "#FDE68A" : "#92400E";
  const cardBg = UI.isDark ? "rgba(255,255,255,0.05)" : UI.card;
  const cardBorder = UI.isDark ? "rgba(255,255,255,0.1)" : UI.border;
  const softCardBg = UI.isDark ? "rgba(255,255,255,0.04)" : UI.surfaceAlt;
  const softCardBorder = UI.isDark ? "rgba(255,255,255,0.08)" : UI.border;
  const primaryText = UI.isDark ? "#fff" : UI.text;
  const secondaryText = UI.isDark ? "#D1D5DB" : UI.textDim;
  const mutedText = UI.isDark ? "#9CA3AF" : UI.muted;
  const dimText = UI.isDark ? "#6B7280" : UI.textMuted;
  const accentMint = UI.isDark ? "#47FEB7" : "#059669";
  const accentMintSoft = UI.isDark ? "rgba(71,254,183,0.08)" : "rgba(5,150,105,0.1)";
  const accentMintBorder = UI.isDark ? "rgba(71,254,183,0.22)" : "rgba(5,150,105,0.28)";
  const panelBorder = UI.isDark ? "rgba(255, 255, 255, 0.116)" : UI.border;
  const panelRule = UI.isDark ? "rgba(255,255,255,0.1)" : UI.border;
  const [activeMistake, setActiveMistake] = useState(null);
  const [breakNow, setBreakNow] = useState(Date.now());
  const [selectedPlayers, setSelectedPlayers] = useState({ home: null, away: null });
  const [pickerSide, setPickerSide] = useState(null);
  const sport = currentGame?.sport;
  const base = currentGame?.base;
  const homeId = String(base?.teamId || "");

  const opponentSide = userSide === "home" ? "away" : "home";
  const userIsHome = userSide === "home";
  const homePlayers = useMemo(() => (players?.home || []).filter(Boolean), [players]);
  const awayPlayers = useMemo(() => (players?.away || []).filter(Boolean), [players]);
  const allPlayers = useMemo(() => [...homePlayers, ...awayPlayers], [homePlayers, awayPlayers]);

  const currentGameNumber = sport?.currentGameNumber || 1;
  const totalGames = 3; // Best of 3
  const games = sport?.games || [];
  const score = sport?.score || { home: 0, away: 0 };
  const serveState = sport?.serveState || null;
  const activeBreak = sport?.activeBreak || null;
  const matchStatus = sport?.matchStatus || base?.status || "scheduled";

  const userGameScore = userIsHome ? score.home : score.away;
  const opponentGameScore = userIsHome ? score.away : score.home;

  // Past games won
  const userGameWins = sport?.result
    ? userIsHome
      ? sport.result.homeGamesWon
      : sport.result.awayGamesWon
    : 0;
  const opponentGameWins = sport?.result
    ? userIsHome
      ? sport.result.awayGamesWon
      : sport.result.homeGamesWon
    : 0;

  // Serving team
  const servingTeam = sport?.servingTeam || null;
  const userServing = servingTeam === userSide;
  const serviceCourt = serveState?.serviceCourt || null;
  const activeBreakEndsAtMs = activeBreak?.endsAt ? new Date(activeBreak.endsAt).getTime() : 0;
  const isBreakActive = !!(activeBreak?.isActive && activeBreakEndsAtMs > breakNow);
  const breakRemainingSeconds = isBreakActive ? Math.max(0, Math.ceil((activeBreakEndsAtMs - breakNow) / 1000)) : 0;
  const breakReasonLabel = activeBreak?.breakType === "between_games" ? "Between games interval" : "11-point interval";

  // Recent events for this game
  const gameEvents = (sport?.events || [])
    .filter((e) => e && Number(e.gameNumber) === currentGameNumber)
    .slice(-8)
    .reverse();

  const disabled = isUpdating || gameOver || sport?.matchStatus === "final" || isBreakActive;
  const userTeamName = userIsHome ? teamNames.home : teamNames.away;
  const opponentTeamName = userIsHome ? teamNames.away : teamNames.home;
  const isDoubles = sport?.matchType === "doubles" || homePlayers.length > 1 || awayPlayers.length > 1;
  const pickerPlayers = pickerSide === "away" ? awayPlayers : homePlayers;

  const getPlayerNameById = useCallback((playerId) => resolveBadmintonPlayerName(allPlayers, playerId), [allPlayers]);

  const getSideFallbackPlayerName = useCallback((side) => {
    const sidePlayers = side === "home" ? homePlayers : awayPlayers;
    if (sidePlayers.length === 1) {
      return resolveBadmintonPlayerName(sidePlayers, sidePlayers[0]?._id || sidePlayers[0]?.id);
    }
    return "Team";
  }, [awayPlayers, homePlayers]);

  const matchEvents = useMemo(() => (sport?.events || []).filter(Boolean), [sport?.events]);
  const rallyTimeline = useMemo(
    () => buildBadmintonTimeline(matchEvents, currentGameNumber, homeId, teamNames, allPlayers),
    [matchEvents, currentGameNumber, homeId, teamNames, allPlayers],
  );
  const matchStats = useMemo(() => buildBadmintonStats(matchEvents, homeId), [matchEvents, homeId]);

  const getSelectedPlayerForSide = useCallback((side) => {
    const chosen = selectedPlayers[side];
    if (chosen) return chosen;
    const sidePlayers = side === "home" ? homePlayers : awayPlayers;
    return sidePlayers.length === 1 ? sidePlayers[0] : null;
  }, [awayPlayers, homePlayers, selectedPlayers]);

  const getExpectedPlayerForSide = useCallback((side) => {
    const explicitSelection = getSelectedPlayerForSide(side);
    if (explicitSelection) return explicitSelection;
    const targetPlayerId = side === servingTeam ? serveState?.servingPlayerId : serveState?.receivingPlayerId;
    if (!targetPlayerId) return null;
    const sidePlayers = side === "home" ? homePlayers : awayPlayers;
    return sidePlayers.find((player) => String(player._id || player.id) === String(targetPlayerId)) || null;
  }, [awayPlayers, getSelectedPlayerForSide, homePlayers, serveState?.receivingPlayerId, serveState?.servingPlayerId, servingTeam]);

  const submitScore = useCallback((eventType, side) => {
    if (disabled) return;
    onScore(eventType, side, getExpectedPlayerForSide(side));
  }, [disabled, getExpectedPlayerForSide, onScore]);

  const currentServerName = getPlayerNameById(serveState?.servingPlayerId);
  const currentReceiverName = getPlayerNameById(serveState?.receivingPlayerId);
  const homeLeftName = getPlayerNameById(serveState?.home?.leftPlayerId);
  const homeRightName = getPlayerNameById(serveState?.home?.rightPlayerId);
  const awayLeftName = getPlayerNameById(serveState?.away?.leftPlayerId);
  const awayRightName = getPlayerNameById(serveState?.away?.rightPlayerId);
  const servingTeamName = servingTeam === "home" ? teamNames.home : servingTeam === "away" ? teamNames.away : "Service pending";
  const receivingTeamName = servingTeam === "home" ? teamNames.away : servingTeam === "away" ? teamNames.home : "Waiting for first rally";
  const receivingSide = servingTeam === "home" ? "away" : servingTeam === "away" ? "home" : null;
  const serverDisplayName = badmintonDisplayName(
    currentServerName !== "Player" ? currentServerName : getSideFallbackPlayerName(servingTeam),
    servingTeamName,
  );
  const receiverDisplayName = badmintonDisplayName(
    currentReceiverName !== "Player" ? currentReceiverName : getSideFallbackPlayerName(receivingSide),
    receivingTeamName,
  );
  const serviceCourtLabel = serviceCourt ? `${serviceCourt.toUpperCase()} service court` : "Service court pending";
  const lockReason = isBreakActive
    ? `${breakReasonLabel} active. Scoring resumes automatically.`
    : matchStatus === "final" || gameOver
      ? "Match is final. Scoring is locked."
      : null;
  const nextServePreview = servingTeam
    ? `${servingTeamName}: ${serverDisplayName} to ${receiverDisplayName}${serviceCourt ? ` from the ${serviceCourt} court` : ""}`
    : "First rally decides the opening serve.";
  const userExpectedPlayer = getExpectedPlayerForSide(userSide);
  const opponentExpectedPlayer = getExpectedPlayerForSide(opponentSide);
  const winningSummary = matchStatus === "final"
    ? sport?.result?.winner === "home"
      ? teamNames.home
      : sport?.result?.winner === "away"
        ? teamNames.away
        : "Draw"
    : null;

  const badgeMap = {
    pointWon: { label: "●", bg: "#16a34a" },
    ace: { label: "A", bg: "#eab308" },
    smash: { label: "S", bg: "#f97316" },
    flick_serve: { label: "FS", bg: "#2563eb" },
    service_fault: { label: "SF", bg: "#b91c1c" },
    fault: { label: "F", bg: "#ef4444" },
    let: { label: "L", bg: "#ca8a04" },
  };
  const getEventBadge = (type) =>
    badgeMap[type] || { label: "•", bg: "#4B5563" };

  useEffect(() => {
    if (!isBreakActive) return undefined;
    setBreakNow(Date.now());
    const intervalId = setInterval(() => {
      setBreakNow(Date.now());
    }, 500);
    return () => clearInterval(intervalId);
  }, [isBreakActive, activeBreak?.endsAt]);

  return (
    <View style={{ width: "100%" }} testID="badminton-panel-root">
      {isBreakActive && !displayOnly && (
        <View
          testID="badminton-break-banner"
          style={{
            marginBottom: 12,
            paddingHorizontal: 18,
            paddingVertical: 16,
            borderRadius: 14,
            backgroundColor: UI.isDark ? "rgba(234,179,8,0.14)" : "#FEF3C7",
            borderWidth: 1,
            borderColor: UI.isDark ? "rgba(234,179,8,0.35)" : "#F59E0B",
            alignItems: "center",
          }}
        >
          <Text style={{ color: warnAccent, fontSize: 11, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" }}>
            {activeBreak?.breakType === "between_games" ? "Between Games Interval" : "Mid-game Interval"}
          </Text>
          <Text style={{ color: primaryText, fontSize: 28, fontWeight: "900", marginTop: 6 }}>
            {String(Math.floor(breakRemainingSeconds / 60)).padStart(2, "0")}:{String(breakRemainingSeconds % 60).padStart(2, "0")}
          </Text>
          <Text className="text-center" style={{ color: warnSoft, fontSize: 11, marginTop: 6 }}>
            {lockReason}
          </Text>
          <Text className="text-center" style={{ color: primaryText, fontSize: 11, marginTop: 8, fontWeight: "700" }}>
            Restart: {nextServePreview}
          </Text>
        </View>
      )}
      {lockReason && !isBreakActive && !displayOnly && (
        <View
          testID="badminton-lock-banner"
          style={{
            marginBottom: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          <Text style={{ color: secondaryText, fontSize: 11, textAlign: "center", fontWeight: "700" }}>{lockReason}</Text>
        </View>
      )}
      <View
        testID="badminton-service-status"
        style={{
          marginBottom: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: servingTeam
            ? (UI.isDark ? "rgba(250,204,21,0.1)" : "#FEF3C7")
            : softCardBg,
          borderWidth: 1,
          borderColor: servingTeam
            ? (UI.isDark ? "rgba(250,204,21,0.28)" : "#F59E0B")
            : softCardBorder,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: warnSoft, fontSize: 10, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase" }}>
            Service Status
          </Text>
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: servingTeam
              ? (UI.isDark ? "rgba(250,204,21,0.16)" : "#FDE68A")
              : (UI.isDark ? "rgba(255,255,255,0.06)" : UI.surfaceAlt),
          }}>
            <Text style={{ color: servingTeam ? warnAccent : mutedText, fontSize: 10, fontWeight: "800" }}>
              {serviceCourtLabel}
            </Text>
          </View>
        </View>
        <Text style={{ color: primaryText, fontSize: 15, fontWeight: "800", marginTop: 8 }} numberOfLines={1}>
          {servingTeamName}
          {servingTeam ? " serving" : " to serve"}
        </Text>
        <Text style={{ color: warnSoft, fontSize: 11, marginTop: 4 }} numberOfLines={2}>
          Server: {serverDisplayName}
        </Text>
        <Text style={{ color: secondaryText, fontSize: 11, marginTop: 2 }} numberOfLines={2}>
          Receiver: {receiverDisplayName}
        </Text>
        <Text style={{ color: mutedText, fontSize: 11, marginTop: 8 }} numberOfLines={2}>
          Next rally setup: {nextServePreview}
        </Text>
      </View>
      {!displayOnly && isDoubles && (
        <View style={{ gap: 10, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { side: "home", label: teamNames.home, player: getSelectedPlayerForSide("home") },
              { side: "away", label: teamNames.away, player: getSelectedPlayerForSide("away") },
            ].map((entry) => (
              <TouchableOpacity
                key={entry.side}
                onPress={() => setPickerSide(entry.side)}
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: accentMintSoft, borderWidth: 1, borderColor: accentMintBorder }}
              >
                <Text style={{ color: mutedText, fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5 }}>{entry.label}</Text>
                <Text style={{ color: accentMint, fontSize: 12, fontWeight: "700", marginTop: 3 }} numberOfLines={1}>
                  {entry.player ? `${entry.player.firstName || ""} ${entry.player.lastName || ""}`.trim() : "Select player"}
                </Text>
                <Text style={{ color: mutedText, fontSize: 10, marginTop: 3 }} numberOfLines={2}>
                  Auto: {entry.side === "home"
                    ? (userSide === "home" ? (userExpectedPlayer ? `${userExpectedPlayer.firstName || ""} ${userExpectedPlayer.lastName || ""}`.trim() : "Team") : (opponentExpectedPlayer ? `${opponentExpectedPlayer.firstName || ""} ${opponentExpectedPlayer.lastName || ""}`.trim() : "Team"))
                    : (entry.side === opponentSide ? (opponentExpectedPlayer ? `${opponentExpectedPlayer.firstName || ""} ${opponentExpectedPlayer.lastName || ""}`.trim() : "Team") : (userExpectedPlayer ? `${userExpectedPlayer.firstName || ""} ${userExpectedPlayer.lastName || ""}`.trim() : "Team"))}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: softCardBg, borderWidth: 1, borderColor: softCardBorder }}>
            <Text style={{ color: mutedText, fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Doubles Rotation</Text>
            <Text style={{ color: warnSoft, fontSize: 11, fontWeight: "700" }} numberOfLines={2}>
              Server: {serverDisplayName} · Receiver: {receiverDisplayName} {serviceCourt ? `· ${serviceCourt.toUpperCase()} court` : ""}
            </Text>
            <Text style={{ color: mutedText, fontSize: 11, marginTop: 6 }} numberOfLines={2}>
              Score tap auto-assigns the current server or receiver unless you override it here.
            </Text>
            <Text style={{ color: UI.isDark ? "#dfe1f9" : UI.text, fontSize: 11, marginTop: 6 }} numberOfLines={2}>
              {teamNames.home}: L {homeLeftName} | R {homeRightName}
            </Text>
            <Text style={{ color: UI.isDark ? "#dfe1f9" : UI.text, fontSize: 11, marginTop: 2 }} numberOfLines={2}>
              {teamNames.away}: L {awayLeftName} | R {awayRightName}
            </Text>
          </View>
        </View>
      )}
      {/* ═══ YOUR TEAM ═══ */}
      {!isScoringTab && (
        <View
          testID="badminton-scoreboard-user"
          style={{
            backgroundColor: cardBg,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: cardBorder,
            marginBottom: 12,
            minHeight: 140,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: mutedText,
                textTransform: "uppercase",
                letterSpacing: 2,
                fontWeight: "600",
              }}
            >
              {userTeamName}
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: userServing
                  ? (UI.isDark ? "rgba(234,179,8,0.2)" : "#FEF3C7")
                  : softCardBg,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: userServing ? warnAccent : dimText,
                }}
              >
                {userServing
                  ? `Serving${serviceCourt ? ` · ${serviceCourt}` : ""}`
                  : "Receiving"}
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
            <Text style={{ fontSize: 48, fontWeight: "700", color: homeAccent }}>
              {userGameScore}
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 10, color: dimText, marginBottom: 2 }}>
                Games Won
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "700", color: primaryText }}>
                {userGameWins}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ═══ OPPONENT TEAM ═══ */}
      {!isScoringTab && (
        <View
          testID="badminton-scoreboard-opponent"
          style={{
            backgroundColor: cardBg,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: cardBorder,
            marginBottom: 12,
            minHeight: 140,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: mutedText,
                textTransform: "uppercase",
                letterSpacing: 2,
                fontWeight: "600",
              }}
            >
              {opponentTeamName}
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor:
                  !userServing && servingTeam
                    ? (UI.isDark ? "rgba(234,179,8,0.2)" : "#FEF3C7")
                    : softCardBg,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: !userServing && servingTeam ? warnAccent : dimText,
                }}
              >
                {!userServing && servingTeam
                  ? `Serving${serviceCourt ? ` · ${serviceCourt}` : ""}`
                  : "Receiving"}
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
            <Text style={{ fontSize: 36, fontWeight: "700", color: awayAccent }}>
              {opponentGameScore}
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 10, color: dimText, marginBottom: 2 }}>
                Games Won
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "700", color: primaryText }}>
                {opponentGameWins}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ═══ THIS GAME — Recent Rallies strip ═══ */}
      {!isScoringTab && (
        <View
          testID="badminton-rally-strip"
          style={{
            backgroundColor: cardBg,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: cardBorder,
            marginBottom: 12,
            height: 88,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: mutedText,
                textTransform: "uppercase",
                letterSpacing: 2,
                fontWeight: "600",
              }}
            >
              Game {currentGameNumber} · Rally Log
            </Text>
            <Text style={{ fontSize: 10, color: dimText }}>
              {currentGameNumber === totalGames
                ? "Deciding Game"
                : "Race to 21"}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              height: 32,
              alignItems: "center",
            }}
          >
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
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: badge.bg,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: eIsUser ? 1 : 0.5,
                      ...(!eIsUser
                        ? {
                            borderWidth: 1,
                            borderColor: cardBorder,
                          }
                        : {}),
                    }}
                  >
                    <Text
                      style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}
                    >
                      {badge.label}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}

      {!isScoringTab && (
        <View
          testID="badminton-rally-timeline"
          style={{
            backgroundColor: UI.isDark ? "rgba(255,255,255,0.03)" : UI.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: softCardBorder,
            marginBottom: 12,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 10, color: mutedText, textTransform: "uppercase", letterSpacing: 2, fontWeight: "600" }}>
            Rally Timeline
          </Text>
          {rallyTimeline.length === 0 ? (
            <Text style={{ color: dimText, fontSize: 11 }}>No rallies recorded yet.</Text>
          ) : (
            rallyTimeline.map((entry, index) => (
              <View key={entry.id || index} style={{ paddingBottom: index === rallyTimeline.length - 1 ? 0 : 8, borderBottomWidth: index === rallyTimeline.length - 1 ? 0 : 1, borderBottomColor: UI.isDark ? "rgba(255,255,255,0.06)" : UI.border }}>
                <Text style={{ color: entry.teamSide === "home" ? homeAccent : awayAccent, fontSize: 11, fontWeight: "800" }}>
                  {entry.actionLabel} · {entry.teamLabel}
                </Text>
                <Text style={{ color: secondaryText, fontSize: 11, marginTop: 3 }}>{entry.detail}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {!isScoringTab && (
        <View
          testID="badminton-stats-summary"
          style={{
            backgroundColor: UI.isDark ? "rgba(255,255,255,0.03)" : UI.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: softCardBorder,
            marginBottom: 12,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 10, color: mutedText, textTransform: "uppercase", letterSpacing: 2, fontWeight: "600" }}>
            Match Summary
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              { label: "Rallies", value: matchStats.rallyCount },
              { label: "Service Points Won", value: matchStats.servicePointsWon },
              { label: "Service Points Lost", value: matchStats.servicePointsLost },
              { label: "Faults", value: matchStats.faultsCommitted },
              { label: "Serve Faults", value: matchStats.serviceFaultsCommitted },
              { label: "Corrections", value: matchStats.correctionCount },
            ].map((item) => (
              <View key={item.label} style={{ minWidth: "31%", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: softCardBg, borderWidth: 1, borderColor: softCardBorder }}>
                <Text style={{ color: mutedText, fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2 }}>{item.label}</Text>
                <Text style={{ color: primaryText, fontSize: 18, fontWeight: "800", marginTop: 4 }}>{item.value}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: secondaryText, fontSize: 11 }}>
            Longest run: {matchStats.longestRun.length > 0 ? `${matchStats.longestRun.side === "home" ? teamNames.home : teamNames.away} won ${matchStats.longestRun.length} straight rallies` : "No streak yet"}
          </Text>
          <Text style={{ color: secondaryText, fontSize: 11 }}>
            Winners: Smash {matchStats.winnerCounts.smash} · Ace {matchStats.winnerCounts.ace} · Drop {matchStats.winnerCounts.drop} · Net {matchStats.winnerCounts.net_shot}
          </Text>
        </View>
      )}

      {/* ═══ UNIFIED LIVE SCORING PANEL ═══ */}
      {!displayOnly && (() => {
        const userRally = rallyPalette(!!userServing, !!servingTeam, UI);
        const oppRally = rallyPalette(!userServing && !!servingTeam, !!servingTeam, UI);
        const faultPalette = { bg: "#d81111", border: "#b91c1c", deep: "#7f0a0a", text: "#d4b2b2" };
        const serveFaultPalette = { bg: "#b35508", border: "#9a4a07", deep: "#7c3a05", text: "#f4e8de" };
        const chooseSidePalette = {
          bg: UI.isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6",
          border: UI.isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB",
          deep: UI.isDark ? "rgba(15,23,42,0.45)" : "#D1D5DB",
        };
        const letPalette = {
          bg: UI.isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6",
          border: UI.isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB",
          deep: UI.isDark ? "rgba(15,23,42,0.45)" : "#D1D5DB",
          text: UI.isDark ? "#D1D5DB" : UI.textDim,
        };
        return (
        <>
        <View
          testID="badminton-scoring-controls"
          style={{
            backgroundColor: UI.isDark ? "transparent" : UI.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: panelBorder,
            marginBottom: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: UI.isDark ? 0.1 : 0.06,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: UI.isDark ? "rgba(74,222,128,0.8)" : "#15803D",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 4,
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            Which team won the rally?
          </Text>

          <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
            <RaisedBtn
              onPress={() => !disabled && submitScore("pointWon", userSide)}
              disabled={disabled}
              testID="badminton-score-user"
              palette={userRally}
              isDark={UI.isDark}
              borderRadius={10}
              style={{ flex: 1, paddingVertical: 20, paddingHorizontal: 8 }}
            >
              <Text style={{ fontSize: 30, fontWeight: "900", marginBottom: 4, color: userRally.text }}>
                +1
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  color: userRally.sub,
                }}
                numberOfLines={1}
              >
                {userTeamName}
              </Text>
            </RaisedBtn>

            <RaisedBtn
              onPress={() => !disabled && submitScore("pointWon", opponentSide)}
              disabled={disabled}
              testID="badminton-score-opponent"
              palette={oppRally}
              isDark={UI.isDark}
              borderRadius={10}
              style={{ flex: 1, paddingVertical: 20, paddingHorizontal: 8 }}
            >
              <Text style={{ fontSize: 30, fontWeight: "900", marginBottom: 4, color: oppRally.text }}>
                +1
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  color: oppRally.sub,
                }}
                numberOfLines={1}
              >
                {opponentTeamName}
              </Text>
            </RaisedBtn>
          </View>

          <View style={{ height: 1, backgroundColor: panelRule, marginBottom: 20 }} />

          <Text
            style={{
              fontSize: 10,
              color: dimText,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 2,
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            Mistakes & Errors
          </Text>

          {activeMistake ? (
            <View
              style={{
                backgroundColor: UI.isDark ? "rgba(239,68,68,0.05)" : "#FEF2F2",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: UI.isDark ? "rgba(239,68,68,0.2)" : "#FECACA",
                padding: 16,
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
                    fontWeight: "700",
                    color: secondaryText,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    flex: 1,
                  }}
                >
                  {activeMistake === "let"
                        ? "Which team requested the let?"
                        : `Which team committed the ${activeMistake.replace("_", " ")}?`}
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveMistake(null)}
                  style={{ paddingHorizontal: 8 }}
                >
                  <Text style={{ color: dimText, fontWeight: "700", fontSize: 18 }}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <RaisedBtn
                  onPress={() => {
                    submitScore(activeMistake, userSide);
                    setActiveMistake(null);
                  }}
                  palette={chooseSidePalette}
                  isDark={UI.isDark}
                  style={{ flex: 1, paddingVertical: 12 }}
                >
                  <Text style={{ color: primaryText, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>
                    {userTeamName}
                  </Text>
                </RaisedBtn>
                <RaisedBtn
                  onPress={() => {
                    submitScore(activeMistake, opponentSide);
                    setActiveMistake(null);
                  }}
                  palette={chooseSidePalette}
                  isDark={UI.isDark}
                  style={{ flex: 1, paddingVertical: 12 }}
                >
                  <Text style={{ color: primaryText, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>
                    {opponentTeamName}
                  </Text>
                </RaisedBtn>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <RaisedBtn
                onPress={() => setActiveMistake("fault")}
                disabled={disabled}
                testID="badminton-fault-button"
                palette={faultPalette}
                isDark={UI.isDark}
                style={{ flex: 1, paddingVertical: 16 }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: faultPalette.text, letterSpacing: 3 }}>
                  FAULT
                </Text>
              </RaisedBtn>
              <RaisedBtn
                onPress={() => setActiveMistake("service_fault")}
                disabled={disabled}
                testID="badminton-service-fault-button"
                palette={serveFaultPalette}
                isDark={UI.isDark}
                style={{ flex: 1, paddingVertical: 16 }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: serveFaultPalette.text, letterSpacing: 3 }}>
                  SERVE FAULT
                </Text>
              </RaisedBtn>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <RaisedBtn
            onPress={() => submitScore("let", servingTeam || userSide)}
            disabled={disabled || activeMistake === "let"}
            testID="badminton-let-button"
            palette={letPalette}
            isDark={UI.isDark}
            style={{ flex: 1, paddingVertical: 12 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="swap-horizontal-outline" size={14} color={letPalette.text} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: letPalette.text }}>
                Let
              </Text>
            </View>
          </RaisedBtn>
        </View>
        </>
        );
      })()}

      {/* ═══ GAME HISTORY ═══ */}
      {!isScoringTab && games.length > 0 && (
        <View
          testID="badminton-game-history"
          style={{
            backgroundColor: UI.isDark ? "rgba(255,255,255,0.03)" : UI.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: cardBorder,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: mutedText,
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: "600",
              marginBottom: 8,
            }}
          >
            Game History
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {games.map((g, idx) => {
              const uScore = userIsHome ? g.homeScore : g.awayScore;
              const oScore = userIsHome ? g.awayScore : g.homeScore;
              const uWon = uScore > oScore;
              return (
                <View
                  key={idx}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1,
                    backgroundColor: uWon
                      ? (UI.isDark ? "rgba(34,197,94,0.1)" : "#F0FDF4")
                      : (UI.isDark ? "rgba(239,68,68,0.1)" : "#FEF2F2"),
                    borderColor: uWon
                      ? (UI.isDark ? "rgba(34,197,94,0.3)" : "#86EFAC")
                      : (UI.isDark ? "rgba(239,68,68,0.3)" : "#FECACA"),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: uWon ? homeAccent : awayAccent,
                    }}
                  >
                    Game {idx + 1}: {uScore}–{oScore}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {!isScoringTab && matchStatus === "final" && (
        <View
          testID="badminton-match-final-summary"
          style={{
            backgroundColor: UI.isDark ? "rgba(34,197,94,0.08)" : "#F0FDF4",
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: UI.isDark ? "rgba(74,222,128,0.24)" : "#86EFAC",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: homeAccent, fontSize: 10, textTransform: "uppercase", letterSpacing: 2, fontWeight: "800" }}>
            Match Final
          </Text>
          <Text style={{ color: primaryText, fontSize: 18, fontWeight: "900", marginTop: 6 }}>
            Winner: {winningSummary}
          </Text>
          <Text style={{ color: secondaryText, fontSize: 11, marginTop: 6 }}>
            Games: {games.map((game) => `${game.homeScore}-${game.awayScore}`).join(" · ") || `${score.home}-${score.away}`}
          </Text>
          <Text style={{ color: secondaryText, fontSize: 11, marginTop: 4 }}>
            Corrections used: {matchStats.correctionCount}
          </Text>
        </View>
      )}

      {/* ═══ END GAME ═══ */}
      {!displayOnly && (
        <View style={{ alignItems: "center", marginTop: 4 }}>
          {/* <TouchableOpacity
            onPress={onEndGame}
            style={{
              backgroundColor: "#ef4444",
              paddingHorizontal: 24,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
              End Game
            </Text>
          </TouchableOpacity> */}
        </View>
      )}

      <Modal visible={!!pickerSide} transparent animationType="fade" onRequestClose={() => setPickerSide(null)}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: UI.overlay }}>
          <View style={{ backgroundColor: UI.isDark ? "#1f2237" : "#FFFFFF", borderRadius: 16, padding: 20, width: "80%", maxWidth: 320, borderWidth: UI.isDark ? 0 : 1, borderColor: UI.border }}>
            <Text style={{ color: UI.isDark ? "#dfe1f9" : UI.text, fontSize: 14, fontWeight: "800", marginBottom: 16, textAlign: "center" }}>
              Select {pickerSide === "away" ? teamNames.away : teamNames.home} Player
            </Text>
            {pickerPlayers.map((player) => {
              const playerId = player._id || player.id;
              const selectedPlayer = selectedPlayers[pickerSide || "home"];
              const isSelected = selectedPlayer && (selectedPlayer._id || selectedPlayer.id) === playerId;
              const name = `${player.firstName || ""} ${player.lastName || ""}`.trim() || "Player";
              return (
                <TouchableOpacity
                  key={playerId}
                  onPress={() => {
                    setSelectedPlayers((prev) => ({ ...prev, [pickerSide]: player }));
                    setPickerSide(null);
                  }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    marginBottom: 8,
                    backgroundColor: isSelected ? accentMintSoft : softCardBg,
                    borderWidth: 1,
                    borderColor: isSelected ? accentMintBorder : softCardBorder,
                  }}
                >
                  <Text style={{ color: isSelected ? accentMint : (UI.isDark ? "#dfe1f9" : UI.text), fontSize: 13, fontWeight: "700" }}>{name}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => {
                setSelectedPlayers((prev) => ({ ...prev, [pickerSide]: null }));
                setPickerSide(null);
              }}
              style={{ paddingVertical: 10, alignItems: "center", marginTop: 4 }}
            >
              <Text style={{ color: mutedText, fontSize: 12, fontWeight: "600" }}>Clear Selection (Team)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}


/** Black flip-card digits with silver binder rings. */
function BadmintonFlipDigits({ value = 0, digitColor = "#FFFFFF", compact = false }) {
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

function getBadmintonGamesWonCount(sport, isHome) {
  if (sport?.result) {
    return isHome
      ? Number(sport.result.homeGamesWon || 0)
      : Number(sport.result.awayGamesWon || 0);
  }
  return (sport?.games || []).filter((g) =>
    isHome
      ? g?.winner === "home" || Number(g?.homeScore) > Number(g?.awayScore)
      : g?.winner === "away" || Number(g?.awayScore) > Number(g?.homeScore),
  ).length;
}

/** Flip-tile scoreboard — lime left / white right (live game points). */
export function BadmintonScoreboardCard({
  sport = {},
  teamNames = { home: "Home", away: "Away" },
  userSide = "home",
  gameTime,
  isLive = false,
  isScheduled = false,
  gameOver = false,
  isOwner = false,
  isUpdating = false,
  onPauseResume,
  onStartGame,
  onEndGame,
  compact = false,
  periodLabel = "Game 1",
}) {
  const UI = useGameScoringTheme();
  const userIsHome = userSide !== "away";
  const userScore = userIsHome
    ? Number(sport?.score?.home || 0)
    : Number(sport?.score?.away || 0);
  const oppScore = userIsHome
    ? Number(sport?.score?.away || 0)
    : Number(sport?.score?.home || 0);
  const userGames = getBadmintonGamesWonCount(sport, userIsHome);
  const oppGames = getBadmintonGamesWonCount(sport, !userIsHome);
  const userName = userIsHome ? (teamNames?.home || "Home") : (teamNames?.away || "Away");
  const oppName = userIsHome ? (teamNames?.away || "Away") : (teamNames?.home || "Home");
  const nameStyle = {
    color: UI.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  };

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
          <BadmintonFlipDigits value={userScore} digitColor="#D4FF00" compact={compact} />
          <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", marginTop: 8 }}>
            Games {userGames}
          </Text>
        </View>

        <View style={{ alignItems: "center", paddingHorizontal: 8, minWidth: 72 }}>
          <Image
            source={BADMINTON_SHUTTLE_3D}
            style={{
              width: compact ? 34 : 44,
              height: compact ? 34 : 44,
              marginBottom: 4,
            }}
            resizeMode="contain"
          />
          <Text style={{ color: UI.muted, fontSize: 11, fontWeight: "800", marginBottom: 8 }}>
            {periodLabel}
          </Text>
          {isScheduled && isOwner && onStartGame ? (
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
          {isLive && isOwner && !gameOver ? (
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
          <BadmintonFlipDigits value={oppScore} digitColor="#FFFFFF" compact={compact} />
          <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", marginTop: 8 }}>
            Games {oppGames}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default BadmintonScoringPanelMobile;

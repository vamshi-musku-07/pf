import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import VolleyballCourtView from "./volleyball/VolleyballCourtView";
import VolleyballLineupSetup from "./volleyball/VolleyballLineupSetup";
import { VolleyballSubstitutionModal, VolleyballLiberoModal } from "./volleyball/VolleyballSubstitution";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import { fonts } from "@/constants/typography";

// ─── Helpers ───
const pName = (p) => {
  if (!p) return "";
  const f = (p.firstName || p.playerName || "").trim();
  const l = (p.lastName || "").trim();
  return l ? `${f} ${l}` : f || "Player";
};

const EVENT_BADGES = {
  point: { label: "●", bg: "#16a34a" }, serve_ace: { label: "A", bg: "#eab308" },
  service_ace: { label: "A", bg: "#eab308" }, attack_kill: { label: "K", bg: "#f97316" },
  kill: { label: "K", bg: "#f97316" }, block_point: { label: "B", bg: "#2563eb" },
  serve_error: { label: "SE", bg: "#b91c1c" }, attack_error: { label: "AE", bg: "#dc2626" },
  fault: { label: "F", bg: "#ef4444" }, side_out: { label: "SO", bg: "#9333ea" },
  timeout: { label: "T", bg: "#ca8a04" }, substitution: { label: "↔", bg: "#4f46e5" },
  challenge: { label: "?", bg: "#7c3aed" }, challenge_won: { label: "✓", bg: "#16a34a" },
  challenge_lost: { label: "✗", bg: "#dc2626" },
};

function raisedScoreShadow(isDark) {
  return {
    shadowColor: isDark ? "#000000" : "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.42 : 0.28,
    shadowRadius: 4,
    elevation: 6,
  };
}

/** Solid cricket/football-style raised button palettes. */
const RALLY_3D = {
  home: { bg: "#16A34A", border: "#15803D", deep: "#166534", text: "#FFFFFF" },
  away: { bg: "#DC2626", border: "#B91C1C", deep: "#991B1B", text: "#FFFFFF" },
};

const TAG_3D = {
  kill: { bg: "#EA580C", border: "#C2410C", deep: "#9A3412" },
  ace: { bg: "#CA8A04", border: "#A16207", deep: "#854D0E" },
  block: { bg: "#2563EB", border: "#1D4ED8", deep: "#1E40AF" },
  error: { bg: "#DC2626", border: "#B91C1C", deep: "#991B1B" },
};

const ACTION_3D = {
  timeout: { bg: "#D97706", border: "#B45309", deep: "#92400E" },
  sub: { bg: "#4F46E5", border: "#4338CA", deep: "#3730A3" },
  libero: { bg: "#7E22CE", border: "#6B21A8", deep: "#581C87" },
  challenge: { bg: "#475569", border: "#334155", deep: "#1E293B" },
  lineup: { bg: "#0F766E", border: "#0D9488", deep: "#115E59" },
  oppLineup: { bg: "#BE123C", border: "#9F1239", deep: "#881337" },
  setupMine: { bg: "#EAB308", border: "#CA8A04", deep: "#A16207", text: "#111827" },
  setupOpp: { bg: "#DC2626", border: "#B91C1C", deep: "#991B1B", text: "#FFFFFF" },
};

function RaisedBtn({
  onPress,
  disabled,
  palette,
  style,
  children,
  isDark,
  serving = false,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: palette.bg,
        borderRadius: 12,
        borderWidth: serving ? 2 : 1,
        borderColor: serving ? "#FACC15" : palette.border,
        borderBottomWidth: 5,
        borderBottomColor: palette.deep,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
        ...raisedScoreShadow(isDark),
        ...style,
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

// ─── SCORING TAG CHIP (3D) ───
function TagChip({ label, tone = "kill", onPress, disabled, small, isDark }) {
  const palette = TAG_3D[tone] || TAG_3D.kill;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: palette.bg,
        borderRadius: 10,
        paddingVertical: small ? 8 : 11,
        paddingHorizontal: small ? 6 : 10,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        flex: 1,
        borderWidth: 1,
        borderColor: palette.border,
        borderBottomWidth: 4,
        borderBottomColor: palette.deep,
        ...raisedScoreShadow(isDark),
      }}
    >
      <Text style={{ color: "#fff", fontSize: small ? 10 : 11, fontWeight: "800", textAlign: "center", letterSpacing: 0.3 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
function VolleyballScoringPanelMobile({
  currentGame,
  players = { home: [], away: [] },
  teamNames = { home: "Home", away: "Away" },
  isUpdating,
  onScore,
  onSubstitution,
  onLiberoSwap,
  onSetupLineup,
  onTimeout,
  onChallenge,
  gameOver,
  displayOnly = false,
  userSide = "home",
  isSelfOwnedOpponent = false,
  onEndGame,
}) {
  const UI = useGameScoringTheme();
  const homeAccent = UI.isDark ? "#4ade80" : "#15803D";
  const awayAccent = UI.isDark ? "#f87171" : "#DC2626";
  const warnAccent = UI.isDark ? "#facc15" : "#B45309";
  const softCard = UI.isDark ? "rgba(255,255,255,0.03)" : UI.cardElevated;
  const softBorder = UI.isDark ? "rgba(255,255,255,0.06)" : UI.border;
  const modalSheet = UI.isDark ? "#1a1d2e" : UI.card;
  const sportData = currentGame?.sport || {};
  const base = currentGame?.base || {};
  const homeId = String(base?.teamId || "");
  const awayId = String(base?.opponentTeamId || "");
  const userIsHome = userSide === "home";
  const opponentSide = userIsHome ? "away" : "home";
  const userTeamId = userIsHome ? homeId : awayId;
  const opponentTeamId = userIsHome ? awayId : homeId;

  // ── Scores ──
  const currentSet = sportData?.currentSet || 1;
  const totalSets = sportData?.totalSets || 5;
  const sets = sportData?.sets || [];
  const currentSetD = sets[currentSet - 1] || {};
  const homeSetScore = currentSetD.homeScore ?? 0;
  const awaySetScore = currentSetD.awayScore ?? 0;
  const userSetScore = userIsHome ? homeSetScore : awaySetScore;
  const opponentSetScore = userIsHome ? awaySetScore : homeSetScore;

  // Set wins
  const pastSets = sets.filter((s) => s.winner);
  const userSetWins = pastSets.filter((s) => (userIsHome ? s.homeScore : s.awayScore) > (userIsHome ? s.awayScore : s.homeScore)).length;
  const opponentSetWins = pastSets.filter((s) => (userIsHome ? s.awayScore : s.homeScore) > (userIsHome ? s.homeScore : s.awayScore)).length;

  // ── Serving ──
  const servingTeamId = sportData?.servingTeam;
  const servingTeam = servingTeamId ? (String(servingTeamId) === homeId ? "home" : "away") : null;
  const userServing = servingTeam === userSide;

  // ── Rotations ──
  const homeRotation = sportData?.homeRotation || 1;
  const awayRotation = sportData?.awayRotation || 1;
  const userRotation = userIsHome ? homeRotation : awayRotation;
  const opponentRotation = userIsHome ? awayRotation : homeRotation;

  // ── Modals ──
  const [showLineupSetup, setShowLineupSetup] = useState(false);
  const [lineupSide, setLineupSide] = useState("home");
  const [showSubModal, setShowSubModal] = useState(false);
  const [showLiberoModal, setShowLiberoModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(null); // "home" | "away" | null → after point, ask why
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeSide, setChallengeSide] = useState(null);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [showTimeoutPicker, setShowTimeoutPicker] = useState(false);

  // ── Lineups ──
  const homeRosterById = useMemo(
    () => new Map((players.home || []).map((player) => [String(player?._id || player?.id), player])),
    [players.home],
  );
  const awayRosterById = useMemo(
    () => new Map((players.away || []).map((player) => [String(player?._id || player?.id), player])),
    [players.away],
  );
  const resolveLineupNames = useCallback((lineup = [], rosterById) => {
    return (lineup || []).map((entry) => {
      const rosterPlayer = rosterById.get(String(entry?.playerId || ""));
      return {
        ...entry,
        playerName: rosterPlayer ? pName(rosterPlayer) : entry?.playerName || null,
      };
    });
  }, []);

  // Cross-check: detect if lineup slots are swapped (playerIds belong to wrong roster)
  const { homeLineup, awayLineup } = useMemo(() => {
    const rawHome = sportData?.homeLineup || [];
    const rawAway = sportData?.awayLineup || [];

    // Count how many homeLineup IDs belong to home vs away roster
    const homeInHome = rawHome.filter((p) => p?.playerId && homeRosterById.has(String(p.playerId))).length;
    const homeInAway = rawHome.filter((p) => p?.playerId && awayRosterById.has(String(p.playerId))).length;

    // If homeLineup IDs mostly belong to away roster, the data is swapped
    const swapped = rawHome.length > 0 && homeInAway > homeInHome;

    const effectiveHome = swapped ? rawAway : rawHome;
    const effectiveAway = swapped ? rawHome : rawAway;

    return {
      homeLineup: resolveLineupNames(effectiveHome, homeRosterById),
      awayLineup: resolveLineupNames(effectiveAway, awayRosterById),
    };
  }, [sportData?.homeLineup, sportData?.awayLineup, homeRosterById, awayRosterById, resolveLineupNames]);

  const userLineup = userIsHome ? homeLineup : awayLineup;
  const opponentLineup = userIsHome ? awayLineup : homeLineup;
  const selectedLineup = lineupSide === "home" ? homeLineup : awayLineup;
  const hasUserLineup = userLineup.length >= 6;
  const hasOpponentLineup = opponentLineup.length >= 6;
  const canManageSide = useCallback(
    (side) => !displayOnly && (side === userSide || isSelfOwnedOpponent),
    [displayOnly, isSelfOwnedOpponent, userSide],
  );
  // Live scorers always need both +1 / rally buttons (home & away).
  const canScoreBothTeams = !displayOnly;
  const canManageOpponentSide = canManageSide(opponentSide);
  const lineupsBySide = useMemo(() => ({ home: homeLineup, away: awayLineup }), [homeLineup, awayLineup]);
  const teamNamesBySide = useMemo(() => ({ home: teamNames?.home, away: teamNames?.away }), [teamNames?.home, teamNames?.away]);
  const availableSubstitutionSides = useMemo(
    () => (canManageOpponentSide ? ["home", "away"] : [userSide]),
    [canManageOpponentSide, userSide],
  );

  // ── Libero state ──
  const userLibero = useMemo(() => {
    const lib = userLineup.find((p) => p.isLibero);
    if (lib) return lib;
    // Check libero from sportData
    const libReplacements = sportData?.liberoReplacements || [];
    const lastLib = libReplacements.filter((r) => {
      const isUserTeam = userIsHome ? String(r.teamId) === homeId : String(r.teamId) !== homeId;
      return isUserTeam;
    }).slice(-1)[0];
    return lastLib ? { playerId: lastLib.liberoIn, playerName: "Libero" } : null;
  }, [userLineup, sportData?.liberoReplacements, userIsHome, homeId]);

  // ── Timeouts this set ──
  const timeouts = sportData?.timeouts || [];
  const userTimeoutsThisSet = timeouts.filter(
    (t) => String(t.teamId) === userTeamId && Number(t.setNumber) === currentSet,
  ).length;
  const oppTimeoutsThisSet = timeouts.filter(
    (t) => String(t.teamId) === opponentTeamId && Number(t.setNumber) === currentSet,
  ).length;

  // ── Subs this set ──
  const substitutions = sportData?.substitutions || [];
  const userSubsThisSet = substitutions.filter((s) => {
    const isUserTeam = userIsHome ? String(s.teamId) === homeId : String(s.teamId) !== homeId;
    return isUserTeam && s.setNumber === currentSet;
  }).length;
  const oppSubsThisSet = substitutions.filter((s) => {
    const isOppTeam = userIsHome ? String(s.teamId) !== homeId : String(s.teamId) === homeId;
    return isOppTeam && s.setNumber === currentSet;
  }).length;
  const subsThisSetBySide = useMemo(() => ({
    home: userIsHome ? userSubsThisSet : oppSubsThisSet,
    away: userIsHome ? oppSubsThisSet : userSubsThisSet,
  }), [userIsHome, userSubsThisSet, oppSubsThisSet]);

  // ── Bench players ──
  const benchPlayersBySide = useMemo(() => {
    const homeOnCourtIds = new Set(homeLineup.map((p) => String(p.playerId)));
    const awayOnCourtIds = new Set(awayLineup.map((p) => String(p.playerId)));
    return {
      home: (players.home || []).filter((player) => !homeOnCourtIds.has(String(player._id || player.id))),
      away: (players.away || []).filter((player) => !awayOnCourtIds.has(String(player._id || player.id))),
    };
  }, [players.home, players.away, homeLineup, awayLineup]);

  // ── Names ──
  const userTeamName = userIsHome ? teamNames?.home : teamNames?.away;
  const opponentTeamName = userIsHome ? teamNames?.away : teamNames?.home;
  const disabled = isUpdating || gameOver;

  // ── Rally events (recent) ──
  const setEvents = useMemo(() => {
    return (sportData?.events || []).filter(Boolean).filter((e) => Number(e.setNumber) === currentSet).slice(-12).reverse();
  }, [sportData?.events, currentSet]);
  const compactQuickTags = canScoreBothTeams;
  const compactRallyButtons = canScoreBothTeams;
  const rallyButtonPadV = compactRallyButtons ? 16 : 22;
  const rallyPlusFontSize = compactRallyButtons ? 24 : 28;
  const rallyNameFontSize = compactRallyButtons ? 9 : 11;

  // ── Side-out efficiency ──
  const sideOutEff = useMemo(() => {
    const allEvents = (sportData?.events || []).filter(Boolean).filter((e) => Number(e.setNumber) === currentSet);
    const SCORING = ["point", "serve_ace", "service_ace", "attack_kill", "kill", "block_point"];
    let userSideOuts = 0, userSideOutWins = 0;
    for (const e of allEvents) {
      if (!SCORING.includes(e.eventType)) continue;
      const eIsHome = String(e.teamId) === homeId;
      const scoringSide = eIsHome ? "home" : "away";
      const servingSide = e.servingTeam ? (String(e.servingTeam) === homeId ? "home" : "away") : null;
      if (servingSide && scoringSide === userSide && servingSide !== userSide) {
        userSideOuts++;
        userSideOutWins++;
      } else if (servingSide && scoringSide !== userSide && servingSide === userSide) {
        userSideOuts++;
      }
    }
    return userSideOuts > 0 ? Math.round((userSideOutWins / userSideOuts) * 100) : null;
  }, [sportData?.events, currentSet, userSide, homeId]);

  // ── Pressure mode detection ──
  const minPts = currentSet >= totalSets ? 15 : 25;
  const isPressure = (userSetScore >= minPts - 3 || opponentSetScore >= minPts - 3) && (userSetScore >= minPts - 5 && opponentSetScore >= minPts - 5);
  const isSetPoint = (userSetScore >= minPts - 1 && userSetScore > opponentSetScore) || (opponentSetScore >= minPts - 1 && opponentSetScore > userSetScore);
  const isMatchPoint = isSetPoint && (
    (userSetWins >= Math.ceil(totalSets / 2) - 1 && userSetScore > opponentSetScore) ||
    (opponentSetWins >= Math.ceil(totalSets / 2) - 1 && opponentSetScore > userSetScore)
  );

  // ── Current server ──
  const currentServer = useMemo(() => {
    if (!servingTeam) return null;
    const lineup = servingTeam === "home" ? homeLineup : awayLineup;
    const rot = servingTeam === "home" ? homeRotation : awayRotation;
    if (lineup.length < 6) return null;
    const server = lineup.find((player) => Number(player?.rotation || 1) === Number(rot)) || null;
    return server?.playerName ? {
      name: server.playerName,
      teamName: servingTeam === "home" ? teamNames?.home : teamNames?.away,
      side: servingTeam,
    } : null;
  }, [servingTeam, homeLineup, awayLineup, homeRotation, awayRotation]);

  // ── Next serving team after a side-out ──
  const nextServeInfo = useMemo(() => {
    if (!servingTeam) return null;
    const otherSide = servingTeam === "home" ? "away" : "home";
    return {
      teamName: otherSide === "home" ? teamNames?.home : teamNames?.away,
      side: otherSide,
    };
  }, [servingTeam, homeLineup, awayLineup, homeRotation, awayRotation]);

  // ── One-tap scoring: tap +1, optionally tag within 3 seconds ──
  const handleRallyWon = useCallback((winningSide) => {
    // Score immediately as a "point"
    onScore?.("point", winningSide);
    // Show tag modal for 3 seconds
    setShowTagModal(winningSide);
    setTimeout(() => setShowTagModal(null), 4000);
  }, [onScore]);

  const handleTag = useCallback((eventType, side) => {
    // This will re-tag the last rally event. For now, send as a follow-up tag.
    onScore?.(eventType, side, { isTag: true });
    setShowTagModal(null);
  }, [onScore]);

  // ── Lineup setup needs detection ──
  // Only block the scoring panel before any match activity; once there are
  // points/events, coaches must keep scoring (lineup can be edited from court).
  const hasMatchActivity =
    userSetScore > 0 ||
    opponentSetScore > 0 ||
    pastSets.length > 0 ||
    (sportData?.events || []).some(
      (event) => event && event.eventType && event.eventType !== "undo",
    );
  const needsLineupSetup =
    !gameOver &&
    !displayOnly &&
    !hasMatchActivity &&
    (!hasUserLineup || (isSelfOwnedOpponent && !hasOpponentLineup));

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  // ── Lineup setup prompt ──
  if (needsLineupSetup) {
    return (
      <View style={{ gap: 12 }}>
        <View style={{ backgroundColor: UI.warningBg, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: UI.warningBorder, alignItems: "center" }}>
          <Ionicons name="people-outline" size={36} color={warnAccent} />
          <Text style={{ color: UI.text, fontSize: 16, fontWeight: "800", marginTop: 8, marginBottom: 4 }}>
            Set Up Starting Lineups
          </Text>
          <Text style={{ color: UI.muted, fontSize: 12, textAlign: "center", marginBottom: 16 }}>
            Choose 6 starters, assign positions, pick first server, and optionally set a libero for each team.
          </Text>

          {/* My Team Lineup */}
          <RaisedBtn
            onPress={() => { setLineupSide(userSide); setShowLineupSetup(true); }}
            palette={ACTION_3D.setupMine}
            isDark={UI.isDark}
            style={{ paddingHorizontal: 24, paddingVertical: 14, width: "100%", flexDirection: "row", gap: 8 }}
          >
            <Text style={{ color: ACTION_3D.setupMine.text, fontSize: 14, fontWeight: "900" }}>SET UP MY LINEUP</Text>
            {hasUserLineup && <Ionicons name="checkmark-circle" size={18} color="#16a34a" />}
          </RaisedBtn>

          {/* Opponent Team Lineup */}
          {canManageSide(opponentSide) && (
            <RaisedBtn
              onPress={() => { setLineupSide(opponentSide); setShowLineupSetup(true); }}
              palette={ACTION_3D.setupOpp}
              isDark={UI.isDark}
              style={{ paddingHorizontal: 24, paddingVertical: 14, marginTop: 10, width: "100%", flexDirection: "row", gap: 8 }}
            >
              <Text style={{ color: ACTION_3D.setupOpp.text, fontSize: 14, fontWeight: "900" }}>SET UP OPPONENT LINEUP</Text>
              {hasOpponentLineup && <Ionicons name="checkmark-circle" size={18} color="#22c55e" />}
            </RaisedBtn>
          )}

          {/* Skip option */}
          <TouchableOpacity
            onPress={() => onScore?.("point", userSide)}
            style={{ marginTop: 12, paddingVertical: 8 }}
          >
            <Text style={{ color: UI.muted, fontSize: 11 }}>Skip → score without lineup</Text>
          </TouchableOpacity>
        </View>

        {/* Lineup Setup Modal */}
        <VolleyballLineupSetup
          players={players[lineupSide] || []}
          existingLineup={selectedLineup}
          teamName={lineupSide === userSide ? userTeamName : opponentTeamName}
          side={lineupSide}
          visible={showLineupSetup}
          onCancel={() => setShowLineupSetup(false)}
          onConfirm={(data) => {
            setShowLineupSetup(false);
            onSetupLineup?.(data);
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 10, width: "100%", alignSelf: "stretch" }}>
      {/* ═══ PRESSURE MODE BANNER ═══ */}
      {isPressure && !displayOnly && (
        <View style={{
          backgroundColor: isMatchPoint ? "rgba(239,68,68,0.15)" : isSetPoint ? "rgba(234,179,8,0.12)" : "rgba(147,51,234,0.1)",
          borderRadius: 8, padding: 8, alignItems: "center",
          borderWidth: 1,
          borderColor: isMatchPoint ? "rgba(239,68,68,0.4)" : isSetPoint ? "rgba(234,179,8,0.3)" : "rgba(147,51,234,0.2)",
        }}>
          <Text style={{
            fontSize: 12, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase",
            color: isMatchPoint ? awayAccent : isSetPoint ? warnAccent : (UI.isDark ? "#c084fc" : "#7E22CE"),
          }}>
            {isMatchPoint ? "🔥 MATCH POINT" : isSetPoint ? "⚡ SET POINT" : "💪 PRESSURE"}
          </Text>
        </View>
      )}

      {/* ═══ MATCH META ═══ */}
      <View style={{ backgroundColor: softCard, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: softBorder }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: UI.muted, fontSize: 10 }}>Set {currentSet}/{totalSets}</Text>
            <Text style={{ color: UI.textMuted, fontSize: 10 }}>·</Text>
            <Text style={{ color: UI.muted, fontSize: 10 }}>
              {currentSet >= totalSets ? "to 15" : "to 25"}
            </Text>
            <Text style={{ color: UI.textMuted, fontSize: 10 }}>·</Text>
            <Text style={{ color: UI.muted, fontSize: 10 }}>{userTeamName} {userSetWins} - {opponentSetWins} {opponentTeamName}</Text>
          </View>
          {sideOutEff != null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ color: UI.muted, fontSize: 10 }}>SO Eff:</Text>
              <Text style={{ color: sideOutEff >= 50 ? "#4ade80" : "#f87171", fontSize: 10, fontWeight: "700" }}>
                {sideOutEff}%
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ═══ SERVER INFO ═══ */}
      {(currentServer || nextServeInfo) && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {currentServer && (
            <View style={{ flex: 1, backgroundColor: UI.warningBg, borderRadius: 8, padding: 8, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: UI.warningBorder }}>
              <Text style={{ fontSize: 12 }}>🏐</Text>
              <View>
                <Text style={{ color: UI.muted, fontSize: 8, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>Current Server</Text>
                <Text style={{ color: warnAccent, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{currentServer.name}</Text>
                <Text style={{ color: UI.muted, fontSize: 9 }} numberOfLines={1}>{currentServer.teamName}</Text>
              </View>
            </View>
          )}
          {nextServeInfo && (
            <View style={{ flex: 1, backgroundColor: softCard, borderRadius: 8, padding: 8, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: softBorder }}>
              <Text style={{ fontSize: 12, opacity: 0.5 }}>🏐</Text>
              <View>
                <Text style={{ color: UI.textMuted, fontSize: 8, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>Next On Side-Out</Text>
                <Text style={{ color: UI.muted, fontSize: 11, fontWeight: "600" }} numberOfLines={1}>{nextServeInfo.teamName}</Text>
                <Text style={{ color: UI.muted, fontSize: 9 }} numberOfLines={1}>Will rotate and serve</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ═══ COURT VIEWS ═══ */}
      {(hasUserLineup || hasOpponentLineup) && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          {hasUserLineup && (
            <View style={{ flex: 1 }}>
              <Text style={{ color: homeAccent, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }} numberOfLines={1}>
                {userTeamName} · R{userRotation}
              </Text>
              <VolleyballCourtView
                lineup={userLineup}
                rotation={userRotation}
                servingTeam={userServing}
                teamColor={homeAccent}
                compact
                libero={userLibero}
              />
            </View>
          )}
          {hasOpponentLineup && (
            <View style={{ flex: 1 }}>
              <Text style={{ color: awayAccent, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }} numberOfLines={1}>
                {opponentTeamName} · R{opponentRotation}
              </Text>
              <VolleyballCourtView
                lineup={opponentLineup}
                rotation={opponentRotation}
                servingTeam={!userServing && !!servingTeam}
                teamColor={awayAccent}
                compact
              />
            </View>
          )}
        </View>
      )}

      {/* ═══ TIMEOUT + SUBS STATUS BAR ═══ */}
      <View style={{ flexDirection: "row", gap: 6 }}>
        <View style={{ flex: 1, backgroundColor: softCard, borderRadius: 8, padding: 8, flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: softBorder }}>
          <Text style={{ color: UI.muted, fontSize: 10 }}>Timeouts</Text>
          <Text style={{ color: userTimeoutsThisSet >= 2 ? awayAccent : UI.text, fontSize: 10, fontWeight: "700" }}>
            {userTimeoutsThisSet}/2
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: softCard, borderRadius: 8, padding: 8, flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: softBorder }}>
          <Text style={{ color: UI.muted, fontSize: 10 }}>Subs</Text>
          <Text style={{ color: userSubsThisSet >= 6 ? awayAccent : UI.text, fontSize: 10, fontWeight: "700" }}>
            {userSubsThisSet}/6
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: softCard, borderRadius: 8, padding: 8, flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: softBorder }}>
          <Text style={{ color: UI.muted, fontSize: 10 }}>Opp TO</Text>
          <Text style={{ color: oppTimeoutsThisSet >= 2 ? awayAccent : UI.text, fontSize: 10, fontWeight: "700" }}>
            {oppTimeoutsThisSet}/2
          </Text>
        </View>
      </View>

      {/* ═══ RALLY LOG ═══ */}
      <View style={{ backgroundColor: softCard, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: softBorder }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text style={{ fontSize: 9, fontWeight: "700", color: UI.muted, textTransform: "uppercase", letterSpacing: 1 }}>
            Set {currentSet} · Rally Log
          </Text>
          <Text style={{ fontSize: 9, color: UI.muted }}>
            {sportData?.rallyCount || 0} rallies
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, minHeight: 28 }}>
          {setEvents.length === 0 ? (
            <Text style={{ color: UI.textMuted, fontSize: 10, fontStyle: "italic" }}>No events yet</Text>
          ) : (
            setEvents.filter(Boolean).map((e, i) => {
              const badge = EVENT_BADGES[e.eventType] || { label: "•", bg: "#4B5563" };
              const eIsHome = String(e.teamId) === homeId;
              const eIsUser = userIsHome ? eIsHome : !eIsHome;
              return (
                <View key={i} style={{
                  width: 26, height: 26, borderRadius: 13, backgroundColor: badge.bg,
                  alignItems: "center", justifyContent: "center",
                  opacity: eIsUser ? 1 : 0.5,
                  borderWidth: eIsUser ? 0 : 1, borderColor: softBorder,
                }}>
                  <Text style={{ color: "#fff", fontSize: 8, fontWeight: "800" }}>{badge.label}</Text>
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* ═══ MAIN SCORING ═══ */}
      {!displayOnly && (
        <View style={{ width: "100%", borderRadius: 12, padding: 8 }}>
          <Text style={{ textAlign: "center", fontSize: 10, fontWeight: "800", color: homeAccent, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
            Which team won the rally?
          </Text>

          {/* +1 rally buttons — equal width, 3D raised */}
          <View style={{ width: "100%", flexDirection: "row", gap: 8, marginBottom: 10 }}>
            <RaisedBtn
              onPress={() => handleRallyWon(userSide)}
              disabled={disabled}
              palette={RALLY_3D.home}
              isDark={UI.isDark}
              serving={userServing}
              style={{
                flex: 1,
                minWidth: 0,
                paddingVertical: rallyButtonPadV,
                paddingHorizontal: 2,
              }}
            >
              {userServing ? (
                <Text style={{ fontSize: 9, fontWeight: "900", color: "#FACC15", letterSpacing: 1, marginBottom: 2 }}>SERVING</Text>
              ) : null}
              <Text style={{ fontSize: rallyPlusFontSize, fontWeight: "900", color: RALLY_3D.home.text, marginBottom: 2 }}>+1</Text>
              <Text
                style={{ width: "100%", fontSize: rallyNameFontSize, fontWeight: "800", color: RALLY_3D.home.text, textTransform: "uppercase", textAlign: "center" }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {userTeamName}
              </Text>
            </RaisedBtn>

            {canScoreBothTeams && (
              <RaisedBtn
                onPress={() => handleRallyWon(opponentSide)}
                disabled={disabled}
                palette={RALLY_3D.away}
                isDark={UI.isDark}
                serving={!userServing && !!servingTeam}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingVertical: rallyButtonPadV,
                  paddingHorizontal: 2,
                }}
              >
                {!userServing && servingTeam ? (
                  <Text style={{ fontSize: 9, fontWeight: "900", color: "#FACC15", letterSpacing: 1, marginBottom: 2 }}>SERVING</Text>
                ) : null}
                <Text style={{ fontSize: rallyPlusFontSize, fontWeight: "900", color: RALLY_3D.away.text, marginBottom: 2 }}>+1</Text>
                <Text
                  style={{ width: "100%", fontSize: rallyNameFontSize, fontWeight: "800", color: RALLY_3D.away.text, textTransform: "uppercase", textAlign: "center" }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {opponentTeamName}
                </Text>
              </RaisedBtn>
            )}
          </View>

          {/* Quick-tag: 4 actions per team, side by side when scoring both teams */}
          <View style={{ width: "100%", flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={{ color: homeAccent, fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", marginBottom: 2 }} numberOfLines={1}>
                {userTeamName}
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TagChip label="KILL" tone="kill" onPress={() => onScore?.("attack_kill", userSide)} disabled={disabled} small={compactQuickTags} isDark={UI.isDark} />
                <TagChip label="ACE" tone="ace" onPress={() => onScore?.("serve_ace", userSide)} disabled={disabled} small={compactQuickTags} isDark={UI.isDark} />
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TagChip label="BLOCK" tone="block" onPress={() => onScore?.("block_point", userSide)} disabled={disabled} small={compactQuickTags} isDark={UI.isDark} />
                <TagChip label="ERROR" tone="error" onPress={() => onScore?.("attack_error", userSide)} disabled={disabled} small={compactQuickTags} isDark={UI.isDark} />
              </View>
            </View>
            {canScoreBothTeams && (
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Text style={{ color: awayAccent, fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", marginBottom: 2 }} numberOfLines={1}>
                  {opponentTeamName}
                </Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TagChip label="KILL" tone="kill" onPress={() => onScore?.("attack_kill", opponentSide)} disabled={disabled} small isDark={UI.isDark} />
                  <TagChip label="ACE" tone="ace" onPress={() => onScore?.("serve_ace", opponentSide)} disabled={disabled} small isDark={UI.isDark} />
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TagChip label="BLOCK" tone="block" onPress={() => onScore?.("block_point", opponentSide)} disabled={disabled} small isDark={UI.isDark} />
                  <TagChip label="ERROR" tone="error" onPress={() => onScore?.("attack_error", opponentSide)} disabled={disabled} small isDark={UI.isDark} />
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ═══ TAG MODAL (post-rally) ═══ */}
      {showTagModal && !displayOnly && (
        <View style={{
          backgroundColor: showTagModal === userSide ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
          borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: showTagModal === userSide ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
        }}>
          <Text style={{ color: showTagModal === userSide ? homeAccent : awayAccent, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, textAlign: "center" }}>
            How did {showTagModal === userSide ? userTeamName : opponentTeamName} score?
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TagChip label="Kill" tone="kill" onPress={() => handleTag("attack_kill", showTagModal)} disabled={disabled} isDark={UI.isDark} />
            <TagChip label="Ace" tone="ace" onPress={() => handleTag("serve_ace", showTagModal)} disabled={disabled} isDark={UI.isDark} />
            <TagChip label="Block" tone="block" onPress={() => handleTag("block_point", showTagModal)} disabled={disabled} isDark={UI.isDark} />
            {canScoreBothTeams && (
              <TagChip label="Opp Err" tone="error" onPress={() => handleTag("attack_error", showTagModal === userSide ? opponentSide : userSide)} disabled={disabled} isDark={UI.isDark} />
            )}
          </View>
        </View>
      )}

      {/* ═══ MANAGEMENT ACTIONS ═══ */}
      {!displayOnly && (
        <View style={{ gap: 8 }}>
          {/* Row 1: Timeout, Sub, Libero */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <RaisedBtn
              onPress={() => {
                if (canScoreBothTeams) {
                  setShowTimeoutPicker(true);
                  return;
                }
                onTimeout?.(userSide);
              }}
              disabled={disabled}
              palette={ACTION_3D.timeout}
              isDark={UI.isDark}
              style={{ flex: 1, paddingVertical: 12 }}
            >
              <Ionicons name="hand-left-outline" size={16} color="#FFFFFF" />
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF", marginTop: 3 }}>Timeout</Text>
            </RaisedBtn>

            <RaisedBtn
              onPress={() => setShowSubModal(true)}
              disabled={disabled}
              palette={ACTION_3D.sub}
              isDark={UI.isDark}
              style={{ flex: 1, paddingVertical: 12 }}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color="#FFFFFF" />
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF", marginTop: 3 }}>Sub</Text>
            </RaisedBtn>

            {userLibero && (
              <RaisedBtn
                onPress={() => setShowLiberoModal(true)}
                disabled={disabled}
                palette={ACTION_3D.libero}
                isDark={UI.isDark}
                style={{ flex: 1, paddingVertical: 12 }}
              >
                <Text style={{ fontSize: 14, fontWeight: "900", color: "#FFFFFF" }}>L</Text>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF", marginTop: 3 }}>Libero</Text>
              </RaisedBtn>
            )}
          </View>

          {/* Row 2: Challenge, Lineup */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <RaisedBtn
              onPress={() => {
                setChallengeSide(canManageOpponentSide ? null : userSide);
                setShowChallengeModal(true);
              }}
              disabled={disabled}
              palette={ACTION_3D.challenge}
              isDark={UI.isDark}
              style={{ flex: 1, paddingVertical: 12 }}
            >
              <Ionicons name="flag-outline" size={16} color="#FFFFFF" />
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF", marginTop: 3 }}>Challenge</Text>
            </RaisedBtn>

            <RaisedBtn
              onPress={() => { setLineupSide(userSide); setShowLineupSetup(true); }}
              disabled={disabled}
              palette={ACTION_3D.lineup}
              isDark={UI.isDark}
              style={{ flex: 1, paddingVertical: 12 }}
            >
              <Ionicons name="people-outline" size={16} color="#FFFFFF" />
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF", marginTop: 3 }}>My Lineup</Text>
            </RaisedBtn>

            {canManageSide(opponentSide) && (
              <RaisedBtn
                onPress={() => { setLineupSide(opponentSide); setShowLineupSetup(true); }}
                disabled={disabled}
                palette={ACTION_3D.oppLineup}
                isDark={UI.isDark}
                style={{ flex: 1, paddingVertical: 12 }}
              >
                <Ionicons name="people-outline" size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF", marginTop: 3 }}>Opp Lineup</Text>
              </RaisedBtn>
            )}
          </View>
        </View>
      )}

      {/* ═══ SET HISTORY ═══ */}
      {pastSets.length > 0 && (
        <View style={{ backgroundColor: softCard, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: softBorder }}>
          <Text style={{ fontSize: 9, fontWeight: "700", color: UI.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            Set History
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {pastSets.map((s, idx) => {
              const uScore = userIsHome ? s.homeScore : s.awayScore;
              const oScore = userIsHome ? s.awayScore : s.homeScore;
              const userWon = uScore > oScore;
              return (
                <View key={idx} style={{
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
                  backgroundColor: userWon ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  borderWidth: 1, borderColor: userWon ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
                }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: userWon ? "#4ade80" : "#f87171" }}>
                    S{idx + 1}: {uScore}–{oScore}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Lineup Setup */}
      <VolleyballLineupSetup
        players={players[lineupSide] || []}
        existingLineup={selectedLineup}
        teamName={lineupSide === userSide ? userTeamName : opponentTeamName}
        side={lineupSide}
        visible={showLineupSetup}
        onCancel={() => setShowLineupSetup(false)}
        onConfirm={(data) => {
          setShowLineupSetup(false);
          onSetupLineup?.(data);
        }}
      />

      {/* Substitution */}
      <VolleyballSubstitutionModal
        visible={showSubModal}
        onClose={() => setShowSubModal(false)}
        lineups={lineupsBySide}
        benchPlayersBySide={benchPlayersBySide}
        teamNames={teamNamesBySide}
        initialSide={userSide}
        availableSides={availableSubstitutionSides}
        subsThisSetBySide={subsThisSetBySide}
        maxSubs={6}
        onConfirm={(data) => {
          setShowSubModal(false);
          onSubstitution?.(data);
        }}
      />

      {/* Libero */}
      <VolleyballLiberoModal
        visible={showLiberoModal}
        onClose={() => setShowLiberoModal(false)}
        lineup={userLineup}
        libero={userLibero}
        liberoIsIn={false}
        teamName={userTeamName}
        side={userSide}
        onConfirm={(data) => {
          setShowLiberoModal(false);
          onLiberoSwap?.(data);
        }}
      />

      {/* Timeout picker */}
      <Modal
        visible={showTimeoutPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowTimeoutPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTimeoutPicker(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: modalSheet, borderRadius: 16, padding: 20, width: "80%", maxWidth: 320 }}>
                <Text style={{ color: UI.text, fontSize: 15, fontWeight: "800", textAlign: "center", marginBottom: 16 }}>
                  Which team called timeout?
                </Text>
                <View style={{ gap: 10 }}>
                  <RaisedBtn
                    onPress={() => { setShowTimeoutPicker(false); onTimeout?.(userSide); }}
                    disabled={disabled || userTimeoutsThisSet >= 2}
                    palette={RALLY_3D.home}
                    isDark={UI.isDark}
                    style={{ paddingVertical: 14, width: "100%" }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>
                      {userTeamName} ({userTimeoutsThisSet}/2)
                    </Text>
                  </RaisedBtn>
                  {canScoreBothTeams && (
                    <RaisedBtn
                      onPress={() => { setShowTimeoutPicker(false); onTimeout?.(opponentSide); }}
                      disabled={disabled || oppTimeoutsThisSet >= 2}
                      palette={RALLY_3D.away}
                      isDark={UI.isDark}
                      style={{ paddingVertical: 14, width: "100%" }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>
                        {opponentTeamName} ({oppTimeoutsThisSet}/2)
                      </Text>
                    </RaisedBtn>
                  )}
                </View>
                <TouchableOpacity onPress={() => setShowTimeoutPicker(false)} style={{ marginTop: 12, alignItems: "center" }}>
                  <Text style={{ color: UI.muted, fontSize: 12 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Challenge flow */}
      <Modal visible={showChallengeModal} animationType="fade" transparent>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" }}
          activeOpacity={1}
          onPress={() => setShowChallengeModal(false)}
        >
          <View style={{ backgroundColor: modalSheet, borderRadius: 16, padding: 20, width: "85%", maxWidth: 340 }}>
            {!challengeSide ? (
              <>
                <Text style={{ color: UI.text, fontSize: 15, fontWeight: "800", textAlign: "center", marginBottom: 16 }}>
                  Which team challenged?
                </Text>
                <View style={{ gap: 10 }}>
                  <RaisedBtn
                    onPress={() => setChallengeSide(userSide)}
                    palette={RALLY_3D.home}
                    isDark={UI.isDark}
                    style={{ paddingVertical: 14, width: "100%" }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{userTeamName}</Text>
                  </RaisedBtn>
                  {canManageOpponentSide && (
                    <RaisedBtn
                      onPress={() => setChallengeSide(opponentSide)}
                      palette={RALLY_3D.away}
                      isDark={UI.isDark}
                      style={{ paddingVertical: 14, width: "100%" }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{opponentTeamName}</Text>
                    </RaisedBtn>
                  )}
                </View>
              </>
            ) : (
              <>
                <Text style={{ color: UI.text, fontSize: 15, fontWeight: "800", textAlign: "center", marginBottom: 16 }}>
                  Challenge Result
                </Text>
                <View style={{ gap: 10 }}>
                  <RaisedBtn
                    onPress={() => { setShowChallengeModal(false); onChallenge?.(challengeSide, "challenge_won"); setChallengeSide(null); }}
                    palette={RALLY_3D.home}
                    isDark={UI.isDark}
                    style={{ paddingVertical: 14, width: "100%" }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>✓ Challenge Won</Text>
                  </RaisedBtn>
                  <RaisedBtn
                    onPress={() => { setShowChallengeModal(false); onChallenge?.(challengeSide, "challenge_lost"); setChallengeSide(null); }}
                    palette={RALLY_3D.away}
                    isDark={UI.isDark}
                    style={{ paddingVertical: 14, width: "100%" }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>✗ Challenge Lost</Text>
                  </RaisedBtn>
                </View>
              </>
            )}
            <TouchableOpacity onPress={() => { setShowChallengeModal(false); setChallengeSide(null); }} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: UI.muted, fontSize: 12 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default VolleyballScoringPanelMobile;

/** Black flip-card digits with silver binder rings (manual tally board). */
function VolleyballFlipDigits({ value = 0, digitColor = "#FFFFFF", compact = false }) {
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

function getVolleyballCurrentSetScore(sport, isHome) {
  if (!sport) return 0;
  const setNumber = Math.max(1, Number(sport.currentSet || 1));
  const setEntry = (sport.sets || [])[setNumber - 1] || {};
  return isHome
    ? Number(setEntry.homeScore ?? 0)
    : Number(setEntry.awayScore ?? 0);
}

function getVolleyballSetsWon(sport, isHome) {
  return (sport?.sets || [])
    .filter((st) => st?.winner)
    .filter((st) =>
      isHome
        ? Number(st.homeScore) > Number(st.awayScore)
        : Number(st.awayScore) > Number(st.homeScore),
    ).length;
}

/** Flip-tile scoreboard — lime left / white right on black cards. */
export function VolleyballScoreboardCard({
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
  periodLabel = "Set 1",
}) {
  const UI = useGameScoringTheme();
  const userIsHome = userSide !== "away";
  const userScore = getVolleyballCurrentSetScore(sport, userIsHome);
  const oppScore = getVolleyballCurrentSetScore(sport, !userIsHome);
  const userSets = getVolleyballSetsWon(sport, userIsHome);
  const oppSets = getVolleyballSetsWon(sport, !userIsHome);
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
          <VolleyballFlipDigits value={userScore} digitColor="#D4FF00" compact={compact} />
          <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", marginTop: 8 }}>
            Sets {userSets}
          </Text>
        </View>

        <View style={{ alignItems: "center", paddingHorizontal: 8, minWidth: 72 }}>
          <Text style={{ fontSize: compact ? 22 : 26, marginBottom: 2 }}>🏐</Text>
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
          <VolleyballFlipDigits value={oppScore} digitColor="#FFFFFF" compact={compact} />
          <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", marginTop: 8 }}>
            Sets {oppSets}
          </Text>
        </View>
      </View>
    </View>
  );
}

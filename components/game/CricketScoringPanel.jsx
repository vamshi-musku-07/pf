import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCricketInningsStatsFromEvents, getCricketFreeHit, getCricketMatchResult, getInningsLimits, isSuperOverInnings } from "./hooks/cricketState";
import { normalizeTeamId } from "@/lib/playerRoster";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

function SetupCompleteTick({ size = 24 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#000000",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="checkmark" size={Math.max(12, Math.round(size * 0.58))} color="#FFFFFF" />
    </View>
  );
}

function BowlerSelectModal({
  visible,
  teamName,
  bowlingTeamPlayers,
  selectedBowlerId,
  onClose,
  onSelect,
  busy = false,
}) {
  const T = useGameScoringTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: T.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            maxHeight: "85%",
            borderWidth: 1,
            borderColor: T.border,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: T.border }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: T.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" }}>
                Select Bowler
              </Text>
              <Text style={{ color: T.text, fontSize: 18, fontWeight: "900", marginTop: 2 }}>
                {teamName || "Bowling team"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={busy}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: T.cardElevated,
                alignItems: "center",
                justifyContent: "center",
                opacity: busy ? 0.4 : 1,
              }}
            >
              <Ionicons name="close" size={20} color={T.textDim} />
            </TouchableOpacity>
          </View>
          {busy ? (
            <View style={{ paddingVertical: 56, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="large" color="#4ade80" />
              <Text style={{ color: T.text, fontWeight: "700", fontSize: 15, marginTop: 14 }}>
                Selecting bowler…
              </Text>
              <Text style={{ color: T.textDim, fontSize: 12, marginTop: 6 }}>Please wait</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 8 }}>
                {bowlingTeamPlayers.map((p) =>
                  renderBowlerOption(p, selectedBowlerId, (playerId) => {
                    onSelect(playerId);
                  }, T),
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function renderBowlerOption(p, selectedBowlerId, onSelect, T) {
  const playerId = String(p._id || p.id);
  const isSelected = Boolean(selectedBowlerId) && playerId === selectedBowlerId;
  return (
    <TouchableOpacity
      key={playerId}
      onPress={() => onSelect(playerId)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isSelected ? "rgba(34,197,94,0.14)" : T.cardElevated,
        borderWidth: 1,
        borderColor: isSelected ? "rgba(34,197,94,0.45)" : T.border,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        width: "48%",
        gap: 6,
      }}
    >
      <Text
        style={{
          color: isSelected ? "#16A34A" : T.text,
          fontWeight: "600",
          fontSize: 11,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}
        {p.firstName} {p.lastName?.[0]}.
      </Text>
      {isSelected ? <SetupCompleteTick size={20} /> : null}
    </TouchableOpacity>
  );
}

function CricketScoringPanelMobile({
  currentGame,
  players = { home: [], away: [] },
  teamNames = { home: "Home", away: "Away" },
  gameTime,
  isUpdating,
  isCricketSyncing = false,
  onScore,
  onWicket,
  onSwapStrike,
  onChangeBowler,
  onSetBattingOrder,
  gameOver,
  displayOnly = false,
  userSide = "home",
  onPauseResume,
  onEndGame,
  onStartSecondInnings,
  onStartSuperOver,
}) {
  const T = useGameScoringTheme();
  const [showWicketFlow, setShowWicketFlow] = useState(false);
  const [wicketStep, setWicketStep] = useState("type"); // type | dismissed | fielder | runout_runs
  const [wicketType, setWicketType] = useState(null);
  const [dismissedPlayerId, setDismissedPlayerId] = useState(null);
  const [wicketFielderId, setWicketFielderId] = useState(null);
  const [showBowlerSelect, setShowBowlerSelect] = useState(false);
  const [showBattingOrderModal, setShowBattingOrderModal] = useState(false);
  const [showFullBattingQueue, setShowFullBattingQueue] = useState(false);
  const [localBattingOrder, setLocalBattingOrder] = useState([]);
  const [extrasModal, setExtrasModal] = useState({ visible: false, type: null });
  const [setupHold, setSetupHold] = useState(false);
  const [bowlerSaving, setBowlerSaving] = useState(false);
  const [battingSaving, setBattingSaving] = useState(false);

  useEffect(() => {
    if (setupHold && !isUpdating && !isCricketSyncing) {
      setSetupHold(false);
    }
  }, [setupHold, isUpdating, isCricketSyncing]);

  useEffect(() => {
    if (bowlerSaving && !isCricketSyncing && !isUpdating) {
      setBowlerSaving(false);
      setShowBowlerSelect(false);
    }
  }, [bowlerSaving, isCricketSyncing, isUpdating]);

  useEffect(() => {
    if (battingSaving && !isUpdating) {
      setBattingSaving(false);
      setShowBattingOrderModal(false);
      setLocalBattingOrder([]);
    }
  }, [battingSaving, isUpdating]);

  if (!currentGame) return null;

  const sportData = currentGame?.sport || {};
  const base = currentGame?.base;
  const homeTeamId = normalizeTeamId(base?.teamId) || "";
  const currentInningsNumber = sportData?.currentInnings || 1;
  const isSuperOver = isSuperOverInnings(sportData, currentInningsNumber);
  const inningsLimits = getInningsLimits(sportData, currentInningsNumber);
  const isSecondInnings = currentInningsNumber >= 2;
  const isChaseInnings =
    currentInningsNumber === 2 || (currentInningsNumber >= 4 && currentInningsNumber % 2 === 0);
  const matchResult = getCricketMatchResult(currentGame);

  // Get current batsmen from backend state
  const backendBatsmen = (sportData?.currentBatsmen || []).filter(Boolean);

  // Innings data (needed early for batsmen validation)
  const currentInningsIdx = (sportData?.currentInnings || 1) - 1;
  const inningsData = sportData?.innings?.[currentInningsIdx];
  const currentBattingTeamId = normalizeTeamId(
    inningsData?.battingTeamId || sportData?.battingTeamId || base?.teamId,
  ) || "";
  const currentBattingTeamSide = currentBattingTeamId === homeTeamId ? "home" : "away";

  // Only filter batsmen in 2nd innings to catch stale data from innings switch
  let validBatsmen = backendBatsmen;
  if (isSecondInnings && backendBatsmen.length > 0) {
    const battingPlayerIds = new Set(
      (players?.[currentBattingTeamSide] || [])
        .filter((p) => p && p.role !== "manager")
        .map((p) => String(p._id || p.id))
    );
    validBatsmen = backendBatsmen.filter((b) =>
      b?.playerId && battingPlayerIds.has(String(b.playerId))
    );
  }
  const striker = validBatsmen.find((b) => b?.striker);
  const nonStriker = validBatsmen.find((b) => b && !b.striker);
  const bowlerData = sportData?.currentBowler || null;

  const hasBatsmen = !!(striker && nonStriker);
  const hasBowler = !!bowlerData?.playerId;
  const currentBowlerId = String(bowlerData?.playerId || "");

  const allPlayers = [
    ...(players?.home || []),
    ...(players?.away || []),
  ].filter(Boolean);
  const getPlayerName = (playerId) => {
    if (!playerId) return "TBD";
    const p = allPlayers.find(
      (pl) => pl && String(pl._id || pl.id) === String(playerId),
    );
    if (!p) return "TBD";
    const first = (p.firstName || "").trim();
    const last = (p.lastName || "").trim();
    return last ? `${first} ${last}` : first || "TBD";
  };

  const battingOrderState = currentBattingTeamSide === "home"
    ? sportData?.homeBattingOrder || []
    : sportData?.awayBattingOrder || [];
  const hasBattingOrderSet = battingOrderState.length > 0 || hasBatsmen;
  const isPlayerOut = (playerId) => {
    if (!playerId) return false;

    const pid = String(playerId);
    const wicketTypes = [
      "wicket",
      "bowled",
      "caught",
      "lbw",
      "run_out",
      "stumped",
      "hit_wicket",
    ];

    if (
      (sportData?.events || []).some(
        (event) =>
          event?.innings === currentInningsNumber &&
          (String(event.dismissedPlayerId || "") === pid ||
            String(event.playerId || "") === pid) &&
          wicketTypes.includes(event.eventType),
      )
    ) {
      return true;
    }

    if (
      battingOrderState.some(
        (player) => String(player.playerId) === pid && player.isOut,
      )
    ) {
      return true;
    }

    return (sportData?.playerStats || []).some(
      (stat) =>
        String(stat.playerId) === pid &&
        String(stat.teamId) === currentBattingTeamId &&
        stat.currentInnings?.isOut,
    );
  };

  const getBatterInningsStats = (playerId) => {
    if (!playerId) return { runs: 0, balls: 0 };

    const pid = String(playerId);
    const currentBatter = (sportData?.currentBatsmen || []).find(
      (batter) => String(batter.playerId) === pid,
    );
    if (currentBatter) {
      return {
        runs: currentBatter.runs || 0,
        balls: currentBatter.balls || 0,
      };
    }

    const battingOrderPlayer = battingOrderState.find(
      (player) => String(player.playerId) === pid,
    );
    if (battingOrderPlayer) {
      return {
        runs: battingOrderPlayer.runs || 0,
        balls: battingOrderPlayer.balls || 0,
      };
    }

    const playerStats = (sportData?.playerStats || []).find(
      (stat) =>
        String(stat.playerId) === pid &&
        String(stat.teamId) === currentBattingTeamId,
    );

    return {
      runs: playerStats?.currentInnings?.runs || 0,
      balls: playerStats?.currentInnings?.balls || 0,
    };
  };

  // Bowler figures
  const getBowlerFigures = () => {
    if (!bowlerData?.playerId) return null;
    const stats = (sportData?.playerStats || []).find(
      (s) => s && s.playerId === bowlerData?.playerId,
    );
    if (!stats)
      return { overs: "0", maidens: 0, runs: 0, wickets: 0, economy: "0.0" };
    const completedOvers = Math.floor((stats.balls_bowled || 0) / 6);
    const remainingBalls = (stats.balls_bowled || 0) % 6;
    return {
      overs:
        remainingBalls > 0
          ? `${completedOvers}.${remainingBalls}`
          : `${completedOvers}`,
      maidens: stats.maidens || 0,
      runs: stats.runs_conceded || 0,
      wickets: stats.wickets || 0,
      economy:
        stats.balls_bowled > 0
          ? ((stats.runs_conceded / stats.balls_bowled) * 6).toFixed(1)
          : "0.0",
    };
  };

  // This over's balls
  const getThisOverBalls = () => {
    const events = (sportData?.events || []).filter((e) => e != null);
    const currentInnings = sportData?.currentInnings || 1;
    const currentOver = sportData?.currentOver ?? 0;
    const DELIVERY_TYPES = [
      "dot_ball",
      "single",
      "double",
      "triple",
      "boundary_4",
      "boundary_6",
      "ball",
      "wide",
      "no_ball",
      "bye",
      "leg_bye",
      "wicket",
      "bowled",
      "caught",
      "lbw",
      "run_out",
      "stumped",
      "hit_wicket",
    ];
    return events.filter(
      (e) =>
        e &&
        e.innings === currentInnings &&
        DELIVERY_TYPES.includes(e.eventType) &&
        e.overNumber === currentOver,
    );
  };

  const getBallDisplay = (event) => {
    switch (event.eventType) {
      case "dot_ball":
      case "ball":
        return event.runs > 0 ? String(event.runs) : "•";
      case "single":
        return "1";
      case "double":
        return "2";
      case "triple":
        return "3";
      case "boundary_4":
        return "4";
      case "boundary_6":
        return "6";
      case "wide":
        return "Wd";
      case "no_ball":
        return "Nb";
      case "bye":
        return "B";
      case "leg_bye":
        return "Lb";
      case "wicket":
      case "bowled":
      case "caught":
      case "lbw":
      case "run_out":
      case "stumped":
      case "hit_wicket":
        return "W";
      default:
        return "•";
    }
  };

  const getBallColor = (event) => {
    // Runs off the bat: solid fill in light mode, translucent in dark mode.
    const runScored = T.isDark
      ? { bg: "rgba(255,255,255,0.2)", text: "#FFFFFF", border: "transparent" }
      : { bg: "#475569", text: "#FFFFFF", border: "#334155" };
    const noRun = T.isDark
      ? { bg: T.cardElevated, text: T.textDim, border: "transparent" }
      : { bg: "#FFFFFF", text: "#475569", border: "#94A3B8" };

    switch (event.eventType) {
      case "boundary_4":
        return { bg: "#0EA5E9", text: "#FFFFFF", border: "#0284C7" };
      case "boundary_6":
        return { bg: "#22C55E", text: "#FFFFFF", border: "#16A34A" };
      case "single":
      case "double":
      case "triple":
        return runScored;
      case "dot_ball":
      case "ball":
        return event.runs > 0 ? runScored : noRun;
      case "wide":
        return { bg: "#EAB308", text: "#1F2937", border: "#CA8A04" };
      case "no_ball":
        return { bg: "#F87171", text: "#FFFFFF", border: "#EF4444" };
      case "bye":
      case "leg_bye":
        return { bg: "#14B8A6", text: "#FFFFFF", border: "#0D9488" };
      case "wicket":
      case "bowled":
      case "caught":
      case "lbw":
      case "run_out":
      case "stumped":
      case "hit_wicket":
        return { bg: "#DC2626", text: "#FFFFFF", border: "#B91C1C" };
      default:
        return noRun;
    }
  };

  // Innings scoring data — derive from the event log (same source as "this over")
  // so undo/poll cannot leave total_runs out of sync with the ball chips.
  const inningsStatsFromEvents = getCricketInningsStatsFromEvents(
    sportData,
    currentInningsNumber,
  );
  const totalRuns = inningsStatsFromEvents.totalRuns;
  const wickets = inningsStatsFromEvents.wickets;
  const oversCompleted = inningsStatsFromEvents.oversCompleted;
  const ballsInOver = inningsStatsFromEvents.ballsCompleted % 6;
  const oversDisplay =
    ballsInOver > 0 ? `${oversCompleted}.${ballsInOver}` : `${oversCompleted}`;
  const totalOvers = isSuperOver ? inningsLimits.maxOvers : (sportData?.totalOvers || 20);

  // Target info for chase innings (2nd main or Super Over chase)
  const chaseSourceInnings =
    currentInningsNumber === 2
      ? sportData?.innings?.[0]
      : isChaseInnings && currentInningsNumber >= 4
        ? sportData?.innings?.[currentInningsNumber - 2]
        : null;
  const target = isChaseInnings && chaseSourceInnings
    ? (chaseSourceInnings?.total_runs || 0) + 1
    : null;
  const runsNeeded = target ? target - totalRuns : null;
  const ballsRemaining = isChaseInnings
    ? totalOvers * 6 - (inningsData?.balls_completed || 0)
    : null;

  // Current partnership (runs since last wicket in this innings)
  const getCurrentPartnership = () => {
    const events = (sportData?.events || []).filter((e) => e != null);
    const currentInnings = sportData?.currentInnings || 1;
    const inningsEvents = events.filter((e) => e.innings === currentInnings);

    const WICKET_TYPES = ["wicket", "bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket"];
    const RUN_EVENTS = ["dot_ball", "single", "double", "triple", "boundary_4", "boundary_6", "ball", "wide", "no_ball", "bye", "leg_bye"];

    // Find last wicket index
    let lastWicketIdx = -1;
    for (let i = inningsEvents.length - 1; i >= 0; i--) {
      if (WICKET_TYPES.includes(inningsEvents[i].eventType)) {
        lastWicketIdx = i;
        break;
      }
    }

    // Events since last wicket
    const partnershipEvents = inningsEvents.slice(lastWicketIdx + 1);
    let runs = 0;
    let balls = 0;
    let fours = 0;
    let sixes = 0;
    for (const ev of partnershipEvents) {
      if (!RUN_EVENTS.includes(ev.eventType)) continue;
      runs += ev.runs || 0;
      const isLegal = !["wide", "no_ball"].includes(ev.eventType);
      if (isLegal) balls += 1;
      if (ev.eventType === "boundary_4" || ev.runs === 4) fours += 1;
      if (ev.eventType === "boundary_6" || ev.runs === 6) sixes += 1;
    }

    const runRate = balls > 0 ? ((runs / balls) * 6).toFixed(2) : "0.00";
    return { runs, balls, fours, sixes, runRate };
  };

  const partnership = getCurrentPartnership();

  const bowlerFigures = getBowlerFigures();
  const thisOverBalls = getThisOverBalls();
  const isFreeHit = getCricketFreeHit(sportData);
  const scoringDisabled = isUpdating || gameOver;
  const protectedDisabled = isUpdating || isCricketSyncing || gameOver;
  const raisedButtonShadow = {
    shadowColor: T.isDark ? "#000000" : "#64748B",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: T.isDark ? 0.42 : 0.3,
    shadowRadius: 5,
    elevation: 7,
  };

  // Batting team side for batting order
  const battingTeamSide = currentBattingTeamSide;
  const bowlingTeamSide = battingTeamSide === "home" ? "away" : "home";
  const bowlingTeamPlayers = (players?.[bowlingTeamSide] || []).filter(
    (p) => p && p.role !== "manager",
  );
  const battingTeamPlayers = (players?.[battingTeamSide] || []).filter(
    (p) => p && p.role !== "manager",
  );
  const battingLineup = (battingOrderState.length > 0
    ? battingOrderState.map((player, index) => {
        const fullPlayer = battingTeamPlayers.find(
          (candidate) => String(candidate._id || candidate.id) === String(player.playerId),
        );
        return {
          playerId: player.playerId,
          battingOrder: player.battingOrder || index + 1,
          firstName: fullPlayer?.firstName || "",
          lastName: fullPlayer?.lastName || "",
          jerseyNumber: fullPlayer?.jerseyNumber,
        };
      })
    : battingTeamPlayers.map((player, index) => ({
        playerId: player._id || player.id,
        battingOrder: index + 1,
        firstName: player.firstName || "",
        lastName: player.lastName || "",
        jerseyNumber: player.jerseyNumber,
      })))
    .sort((a, b) => (a.battingOrder || 99) - (b.battingOrder || 99));
  const activeBatsmenIds = new Set(
    (sportData?.currentBatsmen || []).map((batter) => String(batter.playerId)),
  );
  const upcomingBatters = battingLineup.filter(
    (player) =>
      !activeBatsmenIds.has(String(player.playerId)) && !isPlayerOut(player.playerId),
  );
  const dismissedBatters = battingLineup.filter(
    (player) =>
      !activeBatsmenIds.has(String(player.playerId)) && isPlayerOut(player.playerId),
  );
  const visibleUpcomingBatters = showFullBattingQueue ? upcomingBatters : upcomingBatters.slice(0, 4);
  const visibleDismissedBatters = showFullBattingQueue ? dismissedBatters : dismissedBatters.slice(0, 4);

  // WICKET TYPES
  const WICKET_TYPES = [
    { type: "bowled", label: "Bowled", icon: " " },
    { type: "caught", label: "Caught", icon: "🤲" },
    { type: "lbw", label: "LBW", icon: "🦵" },
    { type: "run_out", label: "Run Out", icon: "🏃" },
    { type: "stumped", label: "Stumped", icon: "🧤" },
    { type: "hit_wicket", label: "Hit Wicket", icon: "💥" },
  ];
  const NEEDS_FIELDER = ["caught", "run_out", "stumped"];

  const handleWicketTypeSelect = (type) => {
    setWicketType(type);
    setWicketStep("dismissed");
  };

  const handleDismissedSelect = (playerId) => {
    setDismissedPlayerId(playerId);
    if (NEEDS_FIELDER.includes(wicketType)) {
      setWicketStep("fielder");
    } else {
      onWicket(wicketType, playerId, null, 0);
      resetWicketFlow();
    }
  };

  const handleFielderSelect = (fielderId) => {
    if (wicketType === "run_out") {
      // For run-outs, ask how many runs were completed
      setWicketStep("runout_runs");
      setDismissedPlayerId(dismissedPlayerId); // keep
      // store fielderId temporarily
      setWicketFielderId(fielderId);
    } else {
      onWicket(wicketType, dismissedPlayerId, fielderId, 0);
      resetWicketFlow();
    }
  };

  const handleRunOutRuns = (runs) => {
    onWicket(wicketType, dismissedPlayerId, wicketFielderId, runs);
    resetWicketFlow();
  };

  const resetWicketFlow = () => {
    setShowWicketFlow(false);
    setWicketStep("type");
    setWicketType(null);
    setDismissedPlayerId(null);
    setWicketFielderId(null);
  };

  // ── SETUP SCREEN (No openers / no bowler) ──
  // Keep setup mounted while saving so the loading overlay can show (do not gate on !isUpdating).
  if (!displayOnly && ((!hasBatsmen || !hasBowler) || setupHold)) {
    const setupSyncing = isUpdating || isCricketSyncing || setupHold || bowlerSaving;
    return (
      <View style={{ alignItems: "center", paddingVertical: 32 }}>
        {/* Loading overlay while saving batting order or bowler */}
        {setupSyncing && (
          <View
            style={{
              position: "absolute",
              inset: 0,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.75)",
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
              paddingVertical: 48,
            }}
          >
            <ActivityIndicator size="large" color="#4ade80" />
            <Text
              style={{
                color: "white",
                fontWeight: "600",
                fontSize: 15,
                marginTop: 14,
              }}
            >
              {hasBatsmen || bowlerSaving ? "Selecting bowler…" : "Saving batting order…"}
            </Text>
            <Text style={{ color: T.textDim, fontSize: 12, marginTop: 6 }}>
              Please wait
            </Text>
          </View>
        )}
        <Text style={{ fontSize: 48, marginBottom: 16 }}> </Text>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: T.text,
            marginBottom: 16,
          }}
        >
          Complete Match Setup
        </Text>
        <View style={{ width: "100%", maxWidth: 280, gap: 12 }}>
          <TouchableOpacity
            disabled={setupSyncing}
            onPress={() => {
              setLocalBattingOrder([...battingTeamPlayers]);
              setShowBattingOrderModal(true);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: hasBattingOrderSet ? "rgba(34,197,94,0.14)" : "#16a34a",
              borderWidth: 1,
              borderColor: hasBattingOrderSet ? "rgba(34,197,94,0.35)" : "transparent",
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 12,
              opacity: setupSyncing ? 0.5 : 1,
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: hasBattingOrderSet ? T.text : "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
                {hasBattingOrderSet ? "Batting Order Set" : "Set Batting Order"}
              </Text>
              <Text style={{ color: hasBattingOrderSet ? "#16A34A" : "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2 }}>
                {hasBattingOrderSet ? "Tap to change order" : "Assign openers and batting queue"}
              </Text>
            </View>
            {hasBattingOrderSet ? <SetupCompleteTick /> : null}
          </TouchableOpacity>
          <TouchableOpacity
            disabled={setupSyncing}
            onPress={() => setShowBowlerSelect(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: hasBowler ? "rgba(34,197,94,0.14)" : "#2563eb",
              borderWidth: 1,
              borderColor: hasBowler ? "rgba(34,197,94,0.35)" : "transparent",
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 12,
              opacity: setupSyncing ? 0.5 : 1,
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: hasBowler ? T.text : "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
                {hasBowler ? "Opening Bowler Selected" : "Select Opening Bowler"}
              </Text>
              <Text style={{ color: hasBowler ? "#16A34A" : "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                {hasBowler ? getPlayerName(bowlerData?.playerId) : "Choose who bowls the first over"}
              </Text>
            </View>
            {hasBowler ? <SetupCompleteTick /> : null}
          </TouchableOpacity>
          <Text
            style={{
              color: T.textMuted,
              fontSize: 13,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            {!hasBattingOrderSet && !hasBowler
              ? "Complete both steps to start scoring"
              : !hasBattingOrderSet
                ? "Set the batting order to assign openers"
                : !hasBowler
                  ? "Select a bowler to start scoring"
                  : "Ready to score"}
          </Text>
        </View>

        <BowlerSelectModal
          visible={showBowlerSelect}
          teamName={teamNames?.[bowlingTeamSide]}
          bowlingTeamPlayers={bowlingTeamPlayers}
          selectedBowlerId={currentBowlerId}
          busy={bowlerSaving || isCricketSyncing}
          onClose={() => {
            if (bowlerSaving || isCricketSyncing) return;
            setShowBowlerSelect(false);
          }}
          onSelect={(playerId) => {
            setSetupHold(true);
            setBowlerSaving(true);
            onChangeBowler?.(playerId);
          }}
        />

        {/* Batting Order Modal — must be here too since this is an early return */}
        <Modal
          visible={showBattingOrderModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (isUpdating) return;
            setShowBattingOrderModal(false);
            setLocalBattingOrder([]);
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.85)",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <View
              style={{
                backgroundColor: T.card,
                borderRadius: 16,
                padding: 20,
                maxHeight: "85%",
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
                <View>
                  <Text
                    style={{ color: T.text, fontSize: 18, fontWeight: "bold" }}
                  >
                    Batting Order
                  </Text>
                  <Text style={{ color: T.textDim, fontSize: 12 }}>
                    {teamNames[battingTeamSide]}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowBattingOrderModal(false);
                    setLocalBattingOrder([]);
                  }}
                  disabled={isUpdating}
                  style={{ padding: 8, opacity: isUpdating ? 0.4 : 1 }}
                >
                  <Text style={{ color: T.textDim, fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text
                style={{ color: T.textMuted, fontSize: 11, marginBottom: 12 }}
              >
                Use ▲▼ to reorder • Currently batting and out players are locked
              </Text>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flexGrow: 0 }}
              >
                {localBattingOrder.map((player, index) => {
                  const playerId = String(player._id || player.id);
                  const isBatting = (sportData?.currentBatsmen || []).some(
                    (b) => String(b.playerId) === playerId,
                  );
                  const isOut = isPlayerOut(playerId);
                  const isLocked = isBatting || isOut;
                  return (
                    <View
                      key={playerId}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: 12,
                        marginBottom: 6,
                        borderRadius: 10,
                        borderWidth: 1,
                        backgroundColor: isBatting
                          ? "rgba(34,197,94,0.1)"
                          : isOut
                            ? "rgba(220,38,38,0.1)"
                          : T.cardElevated,
                        borderColor: isBatting
                          ? "rgba(34,197,94,0.3)"
                          : isOut
                            ? "rgba(220,38,38,0.35)"
                          : T.border,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isBatting ? "#16a34a" : isOut ? "#dc2626" : "#374151",
                          }}
                        >
                          <Text
                            style={{
                              color: "#FFFFFF",
                              fontWeight: "bold",
                              fontSize: 12,
                            }}
                          >
                            {index + 1}
                          </Text>
                        </View>
                        <View>
                          <Text
                            style={{
                              color: T.text,
                              fontWeight: "600",
                              fontSize: 13,
                            }}
                          >
                            {player.firstName} {player.lastName}
                          </Text>
                          <Text style={{ color: T.textDim, fontSize: 10 }}>
                            {player.jerseyNumber
                              ? `#${player.jerseyNumber}`
                              : ""}
                            {player.position ? ` · ${player.position}` : ""}
                          </Text>
                        </View>
                      </View>
                      {isBatting ? (
                        <Text
                          style={{
                            color: "#4ade80",
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                            Batting
                        </Text>
                      ) : isOut ? (
                        <Text
                          style={{
                            color: "#f87171",
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          OUT
                        </Text>
                      ) : (
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          <TouchableOpacity
                            disabled={isLocked || index === 0}
                            onPress={() => {
                              const order = [...localBattingOrder];
                              [order[index], order[index - 1]] = [
                                order[index - 1],
                                order[index],
                              ];
                              setLocalBattingOrder(order);
                            }}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 6,
                              backgroundColor: T.cardElevated,
                              opacity: isLocked || index === 0 ? 0.3 : 1,
                            }}
                          >
                            <Text style={{ color: T.text, fontSize: 13 }}>
                              ▲
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={isLocked || index === localBattingOrder.length - 1}
                            onPress={() => {
                              const order = [...localBattingOrder];
                              [order[index], order[index + 1]] = [
                                order[index + 1],
                                order[index],
                              ];
                              setLocalBattingOrder(order);
                            }}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 6,
                              backgroundColor: T.cardElevated,
                              opacity:
                                isLocked || index === localBattingOrder.length - 1
                                  ? 0.3
                                  : 1,
                            }}
                          >
                            <Text style={{ color: T.text, fontSize: 13 }}>
                              ▼
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => {
                    const finalOrder = localBattingOrder.map((p, i) => ({
                      playerId: p._id || p.id,
                      name: [(p.firstName || "").trim(), (p.lastName || "").trim()].filter(Boolean).join(" ") || "Player",
                      battingOrder: i + 1,
                    }));
                    const payload = {
                      team: battingTeamSide,
                      battingOrder: finalOrder,
                    };
                    if (validBatsmen.length === 0) {
                      payload.currentBatsmen = finalOrder
                        .slice(0, 2)
                        .map((p, i) => ({
                          playerId: p.playerId,
                          striker: i === 0,
                          runs: 0,
                          balls: 0,
                          fours: 0,
                          sixes: 0,
                        }));
                    }
                    onSetBattingOrder?.(payload);
                    setSetupHold(true);
                    setShowBattingOrderModal(false);
                    setLocalBattingOrder([]);
                  }}
                  disabled={isUpdating}
                  style={{
                    flex: 1,
                    backgroundColor: "#16a34a",
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 48,
                    opacity: isUpdating ? 0.7 : 1,
                  }}
                >
                  {isUpdating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      style={{ color: "white", fontWeight: "700", fontSize: 14 }}
                    >
                      Save Order
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowBattingOrderModal(false);
                    setLocalBattingOrder([]);
                  }}
                  disabled={isUpdating}
                  style={{
                    flex: 1,
                    backgroundColor: T.cardElevated,
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                    opacity: isUpdating ? 0.5 : 1,
                  }}
                >
                  <Text
                    style={{ color: T.text, fontWeight: "700", fontSize: 14 }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={{ width: "100%", gap: 12 }}>
      {/* ═════ FREE HIT BANNER ═════ */}
      {isFreeHit && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: T.warningBg,
            borderWidth: 1,
            borderColor: T.warningBorder,
            borderRadius: 10,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="flash" size={16} color={T.warning} />
          <Text style={{ color: T.warning, fontWeight: "900", fontSize: 13, letterSpacing: 2 }}>
            FREE HIT
          </Text>
        </View>
      )}

      {/* ═════ BATTING INFO ═════ */}
      <View
        style={{
          backgroundColor: T.card,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: T.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: T.textDim,
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: "600",
            }}
          >
            Batting
          </Text>
          {isSecondInnings && target && (
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{ fontSize: 10, fontWeight: "bold", color: T.warning }}
              >
                Target: {target} • Need {runsNeeded > 0 ? runsNeeded : 0} off{" "}
                {ballsRemaining > 0 ? ballsRemaining : 0} balls
              </Text>
              {ballsRemaining > 0 && runsNeeded > 0 && (
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color: ((runsNeeded / ballsRemaining) * 6) > 12
                      ? "#ef4444"
                      : ((runsNeeded / ballsRemaining) * 6) > 8
                        ? "#f97316"
                        : "#4ade80",
                    marginTop: 2,
                  }}
                >
                  Req. RR: {((runsNeeded / ballsRemaining) * 6).toFixed(2)}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Scoreline */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            marginBottom: 8,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 32, fontWeight: "900", color: T.text }}>
            {totalRuns}/{wickets}
          </Text>
          <Text style={{ fontSize: 14, color: T.textDim }}>
            ({oversDisplay}/{totalOvers} ov)
          </Text>
        </View>

        {/* Striker */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 6,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              flex: 1,
            }}
          >
            <Text
              style={{ color: T.warning, fontSize: 13, fontWeight: "bold" }}
            >
              ★
            </Text>
            <Text
              style={{ color: T.text, fontWeight: "600", fontSize: 13 }}
              numberOfLines={1}
            >
              {getPlayerName(striker?.playerId)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: T.text, fontWeight: "bold", fontSize: 13 }}>
              {striker?.runs ?? 0}
              <Text style={{ color: T.textDim, fontWeight: "normal" }}>
                ({striker?.balls ?? 0})
              </Text>
            </Text>
            <Text style={{ color: T.textMuted, fontSize: 10 }}>
              {striker?.fours ?? 0}×4 {striker?.sixes ?? 0}×6
            </Text>
          </View>
        </View>

        {/* Non-Striker */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 6,
            opacity: 0.7,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              flex: 1,
            }}
          >
            <Text style={{ color: "transparent", fontSize: 13 }}>★</Text>
            <Text style={{ color: T.text, fontSize: 13 }} numberOfLines={1}>
              {getPlayerName(nonStriker?.playerId)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: T.text, fontSize: 13 }}>
              {nonStriker?.runs ?? 0}
              <Text style={{ color: T.textMuted, fontWeight: "normal" }}>
                ({nonStriker?.balls ?? 0})
              </Text>
            </Text>
            <Text style={{ color: T.textMuted, fontSize: 10 }}>
              {nonStriker?.fours ?? 0}×4 {nonStriker?.sixes ?? 0}×6
            </Text>
          </View>
        </View>

        {/* Partnership */}
        {partnership.balls > 0 && (
          <View
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: T.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: T.textDim, fontSize: 10, fontWeight: "600" }}>
                Partnership
              </Text>
              {partnership.runs >= 100 ? (
                <View style={{ backgroundColor: T.warningBg, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                  <Text style={{ color: T.warning, fontSize: 8, fontWeight: "900" }}>💯 CENTURY</Text>
                </View>
              ) : partnership.runs >= 50 ? (
                <View style={{ backgroundColor: "rgba(71,254,183,0.15)", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                  <Text style={{ color: "#4ade80", fontSize: 8, fontWeight: "800" }}>⭐ FIFTY</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ color: partnership.runs >= 50 ? "#16A34A" : T.text, fontWeight: "bold", fontSize: 12 }}>
                {partnership.runs}
                <Text style={{ color: T.textMuted, fontWeight: "normal", fontSize: 10 }}>
                  ({partnership.balls})
                </Text>
              </Text>
              <Text style={{ color: T.textMuted, fontSize: 9 }}>
                RR {partnership.runRate}
              </Text>
            </View>
          </View>
        )}

        {(upcomingBatters.length > 0 || dismissedBatters.length > 0) && (
          <View
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: T.border,
              gap: 8,
            }}
          >
            <TouchableOpacity
              onPress={() => setShowFullBattingQueue((prev) => !prev)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: T.textDim,
                  fontSize: 10,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                }}
              >
                Batting Queue
              </Text>
              <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: "700" }}>
                {showFullBattingQueue ? "Show Less" : "Show Full"}
              </Text>
            </TouchableOpacity>

            {upcomingBatters.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={{ color: T.textMuted, fontSize: 10 }}>
                  Next In
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {visibleUpcomingBatters.map((player) => (
                    <View
                      key={`next-${player.playerId}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: T.cardElevated,
                        borderWidth: 1,
                        borderColor: T.border,
                      }}
                    >
                      <Text style={{ color: T.textDim, fontSize: 10, fontWeight: "700" }}>
                        {player.battingOrder}
                      </Text>
                      <Text style={{ color: T.text, fontSize: 11, fontWeight: "600" }} numberOfLines={1}>
                        {getPlayerName(player.playerId)}
                      </Text>
                    </View>
                  ))}
                  {!showFullBattingQueue && upcomingBatters.length > 4 && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: T.cardElevated,
                      }}
                    >
                      <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: "700" }}>
                        +{upcomingBatters.length - 4}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {dismissedBatters.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={{ color: T.textMuted, fontSize: 10 }}>
                  Dismissed
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {visibleDismissedBatters.map((player) => {
                    const stats = getBatterInningsStats(player.playerId);
                    return (
                      <View
                        key={`out-${player.playerId}`}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          borderRadius: 10,
                          backgroundColor: "rgba(220,38,38,0.12)",
                          borderWidth: 1,
                          borderColor: "rgba(248,113,113,0.25)",
                          minWidth: 120,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <Text
                            style={{ color: "#FECACA", fontSize: 11, fontWeight: "600", flex: 1 }}
                            numberOfLines={1}
                          >
                            {getPlayerName(player.playerId)}
                          </Text>
                          <View
                            style={{
                              paddingHorizontal: 5,
                              paddingVertical: 2,
                              borderRadius: 999,
                              backgroundColor: "rgba(220,38,38,0.35)",
                            }}
                          >
                            <Text style={{ color: "#FCA5A5", fontSize: 8, fontWeight: "900" }}>
                              OUT
                            </Text>
                          </View>
                        </View>
                        <Text style={{ color: T.textDim, fontSize: 10, marginTop: 3 }}>
                          {stats.runs} ({stats.balls})
                        </Text>
                      </View>
                    );
                  })}
                  {!showFullBattingQueue && dismissedBatters.length > 4 && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: "rgba(220,38,38,0.08)",
                      }}
                    >
                      <Text style={{ color: "#F87171", fontSize: 10, fontWeight: "700" }}>
                        +{dismissedBatters.length - 4}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ═════ BOWLER INFO ═════ */}
      <View
        style={{
          backgroundColor: T.card,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: T.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontSize: 10,
                color: T.textDim,
                textTransform: "uppercase",
                letterSpacing: 2,
                fontWeight: "600",
              }}
            >
              Bowling
            </Text>
            <Text
              style={{ color: T.text, fontWeight: "600", fontSize: 13 }}
              numberOfLines={1}
            >
              {getPlayerName(bowlerData?.playerId)}
            </Text>
          </View>
          {bowlerFigures && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text
                style={{
                  color: T.text,
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              >
                {bowlerFigures.overs}-{bowlerFigures.maidens}-
                {bowlerFigures.runs}-{bowlerFigures.wickets}
              </Text>
              <Text style={{ color: T.textMuted, fontSize: 10 }}>
                Eco: {bowlerFigures.economy}
              </Text>
            </View>
          )}
        </View>
        {!displayOnly && (
          <TouchableOpacity
            onPress={() => setShowBowlerSelect(true)}
            style={{
              marginTop: 8,
              backgroundColor: T.warningBg,
              borderWidth: 1,
              borderColor: T.warningBorder,
              borderRadius: 10,
              paddingVertical: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: T.warning, fontWeight: "800", fontSize: 12 }}>
              Change Bowler
            </Text>
          </TouchableOpacity>
        )}

      </View>

      <BowlerSelectModal
        visible={showBowlerSelect}
        teamName={teamNames?.[bowlingTeamSide]}
        bowlingTeamPlayers={bowlingTeamPlayers}
        selectedBowlerId={currentBowlerId}
        busy={bowlerSaving || isCricketSyncing}
        onClose={() => {
          if (bowlerSaving || isCricketSyncing) return;
          setShowBowlerSelect(false);
        }}
        onSelect={(playerId) => {
          setBowlerSaving(true);
          onChangeBowler?.(playerId);
        }}
      />

      {/* ═════ THIS OVER ═════ */}
      <View
        style={{
          backgroundColor: T.card,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: T.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: T.textDim,
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: "600",
            }}
          >
            Over {oversCompleted + (ballsInOver > 0 ? 1 : 0)}
          </Text>
          <Text style={{ fontSize: 10, color: T.textMuted }}>
            {oversDisplay}/{totalOvers} ov
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          {thisOverBalls.length === 0 ? (
            <Text
              style={{ color: T.textMuted, fontSize: 11, fontStyle: "italic" }}
            >
              No balls yet
            </Text>
          ) : (
            thisOverBalls.map((ball, i) => {
              const bc = getBallColor(ball);
              return (
                <View
                  key={i}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: bc.bg,
                    borderWidth: 1,
                    borderColor: bc.border || "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ color: bc.text, fontSize: 10, fontWeight: "bold" }}
                  >
                    {getBallDisplay(ball)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* ═════ BATTING ORDER BUTTON ═════ */}
      {!displayOnly && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            marginBottom: -4,
          }}
        >
          <TouchableOpacity
            disabled={protectedDisabled}
            onPress={() => {
              setLocalBattingOrder([...battingTeamPlayers]);
              setShowBattingOrderModal(true);
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: "#15803d",
              borderRadius: 6,
              opacity: protectedDisabled ? 0.5 : 1,
            }}
          >
            <Text style={{ color: "white", fontSize: 10, fontWeight: "600" }}>
              Change Batting Order
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ═════ EXTRAS MODAL ═════ */}
      {extrasModal.visible && (
        <View
          style={{
            backgroundColor: T.card,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: T.border,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: "bold" }}>
              {extrasModal.type === "wide" ? "Wide" : extrasModal.type === "no_ball" ? "No Ball" : extrasModal.type === "bye" ? "Bye" : "Leg Bye"}
              {" "}- Select Runs
            </Text>
            <TouchableOpacity onPress={() => setExtrasModal({ visible: false, type: null })}>
              <Ionicons name="close-circle" size={24} color={T.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: T.textDim, fontSize: 11, marginBottom: 12 }}>
            {extrasModal.type === "wide" || extrasModal.type === "no_ball"
              ? `1 ${extrasModal.type === "wide" ? "wide" : "no-ball"} penalty + additional runs scored`
              : "Total runs scored as extras"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(extrasModal.type === "wide" || extrasModal.type === "no_ball"
              ? [
                  { label: "0 extra", runs: 1, sub: "Just the penalty" },
                  { label: "+1", runs: 2, sub: "1 run taken" },
                  { label: "+2", runs: 3, sub: "2 runs taken" },
                  { label: "+3", runs: 4, sub: "3 runs taken" },
                  { label: "+4", runs: 5, sub: "4 (boundary)" },
                  { label: "+6", runs: 7, sub: "6 (over boundary)" },
                ]
              : [
                  { label: "1", runs: 1, sub: "Single" },
                  { label: "2", runs: 2, sub: "Double" },
                  { label: "3", runs: 3, sub: "Triple" },
                  { label: "4", runs: 4, sub: "Four" },
                ]
            ).map((opt) => (
              <TouchableOpacity
                key={opt.runs}
                onPress={() => {
                  onScore(extrasModal.type, opt.runs);
                  setExtrasModal({ visible: false, type: null });
                }}
                style={{
                  width: "30%",
                  backgroundColor: T.cardElevated,
                  borderRadius: 8,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: T.border,
                }}
              >
                <Text style={{ color: T.text, fontSize: 20, fontWeight: "bold" }}>
                  {opt.label}
                </Text>
                <Text style={{ color: T.textMuted, fontSize: 9, marginTop: 3 }}>
                  {opt.sub}
                </Text>
                <Text style={{ color: T.textDim, fontSize: 10, marginTop: 2, fontWeight: "600" }}>
                  = {opt.runs} run{opt.runs !== 1 ? "s" : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ═════ WICKET FLOW OVERLAY ═════ */}
      {showWicketFlow && (
        <View
          style={{
            backgroundColor: T.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: T.border,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Text style={{ color: T.text, fontWeight: "bold", fontSize: 14 }}>
              {wicketStep === "type"
                ? "Wicket Type"
                : wicketStep === "dismissed"
                  ? "Dismissed Batsman"
                  : wicketStep === "runout_runs"
                    ? "Runs Completed"
                    : "Fielder"}
            </Text>
            <TouchableOpacity
              onPress={resetWicketFlow}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: T.cardElevated,
              }}
            >
              <Text style={{ color: T.textMuted, fontSize: 11 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Step 1: Wicket Type */}
          {wicketStep === "type" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {WICKET_TYPES.map((w) => (
                <TouchableOpacity
                  key={w.type}
                  onPress={() => handleWicketTypeSelect(w.type)}
                  style={{
                    width: "30%",
                    backgroundColor: "rgba(220,38,38,0.15)",
                    borderWidth: 1,
                    borderColor: "rgba(220,38,38,0.3)",
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 20, marginBottom: 2 }}>
                    {w.icon}
                  </Text>
                  <Text
                    style={{
                      color: "#fca5a5",
                      fontWeight: "600",
                      fontSize: 10,
                    }}
                  >
                    {w.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Step 2: Dismissed Batsman */}
          {wicketStep === "dismissed" && (
            <View>
              <Text
                style={{
                  color: T.textDim,
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                Who is out? ({wicketType})
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {/* Show current batsmen first */}
                {[striker, nonStriker].filter(Boolean).map((b) => {
                  const pId = b.playerId;
                  return (
                    <TouchableOpacity
                      key={pId}
                      onPress={() => handleDismissedSelect(pId)}
                      style={{
                        backgroundColor: "rgba(220,38,38,0.15)",
                        borderWidth: 1,
                        borderColor: "rgba(220,38,38,0.3)",
                        borderRadius: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        width: "48%",
                      }}
                    >
                      <Text
                        style={{
                          color: "#fca5a5",
                          fontWeight: "600",
                          fontSize: 11,
                        }}
                        numberOfLines={1}
                      >
                        {b.striker ? "★ " : ""}
                        {getPlayerName(pId)}
                      </Text>
                      <Text style={{ color: T.textMuted, fontSize: 9 }}>
                        {b.runs ?? 0}({b.balls ?? 0})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Step 3: Fielder */}
          {wicketStep === "fielder" && (
            <View>
              <Text
                style={{
                  color: T.textDim,
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                Fielder ({wicketType})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  onWicket(wicketType, dismissedPlayerId, null);
                  resetWicketFlow();
                }}
                style={{
                  backgroundColor: T.cardElevated,
                  borderWidth: 1,
                  borderColor: T.border,
                  borderRadius: 10,
                  paddingVertical: 8,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: T.textDim, fontSize: 11 }}>
                  Skip (No fielder)
                </Text>
              </TouchableOpacity>
              <ScrollView style={{ maxHeight: 180 }}>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {bowlingTeamPlayers.map((p) => (
                    <TouchableOpacity
                      key={p._id || p.id}
                      onPress={() => handleFielderSelect(p._id || p.id)}
                      style={{
                        backgroundColor: T.cardElevated,
                        borderWidth: 1,
                        borderColor: T.border,
                        borderRadius: 10,
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        width: "48%",
                      }}
                    >
                      <Text
                        style={{
                          color: T.text,
                          fontWeight: "600",
                          fontSize: 10,
                        }}
                        numberOfLines={1}
                      >
                        {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}
                        {p.firstName} {p.lastName?.[0]}.
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Step 4: Runs completed on run-out */}
          {wicketStep === "runout_runs" && (
            <View>
              <Text
                style={{
                  color: T.textDim,
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                Runs completed before run-out?
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[0, 1, 2, 3].map((runs) => (
                  <TouchableOpacity
                    key={runs}
                    onPress={() => handleRunOutRuns(runs)}
                    style={{
                      flex: 1,
                      backgroundColor: runs === 0 ? T.cardElevated : "rgba(34,197,94,0.12)",
                      borderWidth: 1,
                      borderColor: runs === 0 ? T.border : "rgba(34,197,94,0.3)",
                      borderRadius: 10,
                      paddingVertical: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: runs === 0 ? T.textDim : "#16A34A", fontWeight: "bold", fontSize: 18 }}>
                      {runs}
                    </Text>
                    <Text style={{ color: T.textMuted, fontSize: 9, marginTop: 2 }}>
                      {runs === 0 ? "None" : `${runs} run${runs > 1 ? "s" : ""}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ═════ SCORING BUTTONS ═════ */}
      {!displayOnly && !showWicketFlow && (
        <View style={{ gap: 8 }}>
          {/* Row 1: Runs 0,1,2,3 */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              {
                type: "dot_ball",
                label: "0",
                sub: "Dot",
                bg: "#475569",
                border: "#334155",
                text: "#FFFFFF",
              },
              {
                type: "single",
                label: "1",
                sub: "Single",
                bg: "#2563EB",
                border: "#1D4ED8",
                text: "#FFFFFF",
              },
              {
                type: "double",
                label: "2",
                sub: "Double",
                bg: "#7C3AED",
                border: "#6D28D9",
                text: "#FFFFFF",
              },
              {
                type: "triple",
                label: "3",
                sub: "Triple",
                bg: "#EA580C",
                border: "#C2410C",
                text: "#FFFFFF",
              },
            ].map((btn) => (
              <TouchableOpacity
                key={btn.type}
                onPress={() => onScore(btn.type)}
                disabled={scoringDisabled || !hasBowler}
                style={{
                  flex: 1,
                  backgroundColor: btn.bg,
                  borderWidth: 1,
                  borderColor: btn.border,
                  borderBottomWidth: 4,
                  borderBottomColor: btn.border,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: "center",
                  opacity: scoringDisabled || !hasBowler ? 0.4 : 1,
                  ...raisedButtonShadow,
                }}
              >
                <Text
                  style={{ color: btn.text, fontSize: 24, fontWeight: "bold" }}
                >
                  {btn.label}
                </Text>
                <Text
                  style={{
                    color: btn.text,
                    opacity: 0.78,
                    fontSize: 10,
                    marginTop: 2,
                  }}
                >
                  {btn.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Row 2: Boundaries 4, 6 */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => onScore("boundary_4")}
              disabled={scoringDisabled || !hasBowler}
              style={{
                flex: 1,
                backgroundColor: "#0284C7",
                borderWidth: 1,
                borderColor: "#0369A1",
                borderBottomWidth: 5,
                borderBottomColor: "#075985",
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                opacity: scoringDisabled || !hasBowler ? 0.4 : 1,
                ...raisedButtonShadow,
              }}
            >
              <Text
                style={{ color: "white", fontSize: 24, fontWeight: "bold" }}
              >
                4
              </Text>
              <Text
                style={{
                  color: "rgba(191,219,254,0.8)",
                  fontSize: 10,
                  marginTop: 2,
                }}
              >
                Four
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onScore("boundary_6")}
              disabled={scoringDisabled || !hasBowler}
              style={{
                flex: 1,
                backgroundColor: "#16A34A",
                borderWidth: 1,
                borderColor: "#15803D",
                borderBottomWidth: 5,
                borderBottomColor: "#166534",
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                opacity: scoringDisabled || !hasBowler ? 0.4 : 1,
                ...raisedButtonShadow,
              }}
            >
              <Text
                style={{ color: "white", fontSize: 24, fontWeight: "bold" }}
              >
                6
              </Text>
              <Text style={{ color: "white", fontSize: 10, marginTop: 2 }}>
                Six
              </Text>
            </TouchableOpacity>
          </View>

          {/* Row 3: Extras Wd, Nb, B, Lb */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              {
                type: "wide",
                label: "Wd",
                sub: "Wide",
                bg: "#CA8A04",
                border: "#854D0E",
                text: "#FFFFFF",
              },
              {
                type: "no_ball",
                label: "Nb",
                sub: "No Ball",
                bg: "#DC2626",
                border: "#991B1B",
                text: "#FFFFFF",
              },
              {
                type: "bye",
                label: "B",
                sub: "Bye",
                bg: "#0D9488",
                border: "#115E59",
                text: "#FFFFFF",
              },
              {
                type: "leg_bye",
                label: "Lb",
                sub: "Leg Bye",
                bg: "#0F766E",
                border: "#134E4A",
                text: "#FFFFFF",
              },
            ].map((btn) => (
              <TouchableOpacity
                key={btn.type}
                onPress={() => setExtrasModal({ visible: true, type: btn.type })}
                disabled={scoringDisabled || !hasBowler}
                style={{
                  flex: 1,
                  backgroundColor: btn.bg,
                  borderWidth: 1,
                  borderColor: btn.border,
                  borderBottomWidth: 4,
                  borderBottomColor: btn.border,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: scoringDisabled || !hasBowler ? 0.4 : 1,
                  ...raisedButtonShadow,
                }}
              >
                <Text
                  style={{ color: btn.text, fontSize: 18, fontWeight: "bold" }}
                >
                  {btn.label}
                </Text>
                <Text
                  style={{
                    color: btn.text,
                    opacity: 0.8,
                    fontSize: 9,
                    marginTop: 2,
                  }}
                >
                  {btn.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Row 4: WICKET */}
          <TouchableOpacity
            onPress={() => setShowWicketFlow(true)}
            disabled={scoringDisabled || !hasBowler}
            style={{
              backgroundColor: "#B91C1C",
              borderWidth: 1,
              borderColor: "#991B1B",
              borderBottomWidth: 5,
              borderBottomColor: "#7F1D1D",
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              opacity: scoringDisabled || !hasBowler ? 0.4 : 1,
              ...raisedButtonShadow,
            }}
          >
            <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>
              WICKET
            </Text>
          </TouchableOpacity>

          {/* Row 5: Swap Strike + Change Bowler */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={onSwapStrike}
              disabled={scoringDisabled}
              style={{
                flex: 1,
                backgroundColor: T.cardElevated,
                borderWidth: 1,
                borderColor: T.isDark ? T.border : "#CBD5E1",
                borderBottomWidth: 4,
                borderBottomColor: T.isDark ? "#111827" : "#94A3B8",
                borderRadius: 12,
                paddingVertical: 10,
                alignItems: "center",
                opacity: scoringDisabled ? 0.4 : 1,
                ...raisedButtonShadow,
              }}
            >
              <Text
                style={{ color: T.text, fontWeight: "600", fontSize: 12 }}
              >
                ⇄ Swap Strike
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowBowlerSelect(true)}
              disabled={scoringDisabled}
              style={{
                flex: 1,
                backgroundColor: T.cardElevated,
                borderWidth: 1,
                borderColor: T.isDark ? T.border : "#CBD5E1",
                borderBottomWidth: 4,
                borderBottomColor: T.isDark ? "#111827" : "#94A3B8",
                borderRadius: 12,
                paddingVertical: 10,
                alignItems: "center",
                opacity: scoringDisabled ? 0.4 : 1,
                ...raisedButtonShadow,
              }}
            >
              <Text
                style={{ color: T.text, fontWeight: "600", fontSize: 12 }}
              >
                ● Change Bowler
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      )}

      {/* ═════ START 2ND INNINGS ═════ */}
      {!displayOnly && !isSecondInnings && !gameOver && onStartSecondInnings && (() => {
        const isAllOut = wickets >= inningsLimits.maxWickets;
        const isOversComplete = oversCompleted >= inningsLimits.maxOvers;
        const shouldPrompt = isAllOut || isOversComplete;
        return (
          <TouchableOpacity
            onPress={onStartSecondInnings}
            disabled={isUpdating || isCricketSyncing}
            style={{
              backgroundColor: shouldPrompt ? "rgba(71,254,183,0.2)" : "rgba(71,254,183,0.08)",
              borderWidth: 2,
              borderColor: shouldPrompt ? "rgba(71,254,183,0.6)" : "rgba(71,254,183,0.25)",
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 12,
              minHeight: 64,
              opacity: isUpdating || isCricketSyncing ? 0.75 : 1,
            }}
          >
            {isUpdating ? (
              <>
                <ActivityIndicator color={T.accent} />
                <Text style={{ color: T.textDim, fontSize: 10, marginTop: 8 }}>
                  Starting 2nd innings…
                </Text>
              </>
            ) : (
              <>
                <Text style={{ color: T.accent, fontWeight: "900", fontSize: 14, letterSpacing: 1 }}>
                  {shouldPrompt ? "Start 2nd Innings" : "Declare & Start 2nd Innings"}
                </Text>
                <Text style={{ color: T.textDim, fontSize: 10, marginTop: 4 }}>
                  {isAllOut ? "All out — teams will swap" : isOversComplete ? "Overs complete — teams will swap" : "Early declaration — teams will swap"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        );
      })()}

      {/* ═════ SUPER OVER ═════ */}
      {!displayOnly && !gameOver && onStartSuperOver && matchResult?.needsSuperOver && (
        <TouchableOpacity
          onPress={onStartSuperOver}
          disabled={isUpdating || isCricketSyncing}
          style={{
            backgroundColor: T.warningBg,
            borderWidth: 2,
            borderColor: T.warningBorder,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 12,
            minHeight: 64,
            opacity: isUpdating || isCricketSyncing ? 0.75 : 1,
          }}
        >
          {isUpdating ? (
            <>
              <ActivityIndicator color={T.warning} />
              <Text style={{ color: T.textDim, fontSize: 10, marginTop: 8 }}>
                Starting Super Over…
              </Text>
            </>
          ) : (
            <>
              <Text style={{ color: T.warning, fontWeight: "900", fontSize: 14, letterSpacing: 1 }}>
                {sportData?.matchStatus === "super_over_break" && (currentInningsNumber % 2 === 1)
                  ? "Start Super Over — 2nd innings"
                  : matchResult?.superOver
                    ? "Play Super Over again"
                    : "Start Super Over"}
              </Text>
              <Text style={{ color: T.textDim, fontSize: 10, marginTop: 4, textAlign: "center", paddingHorizontal: 12 }}>
                {matchResult?.resultText || "1 over per side · 2 wickets max"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {isSuperOver && !gameOver ? (
        <View
          style={{
            marginTop: 10,
            alignSelf: "center",
            backgroundColor: T.warningBg,
            borderWidth: 1,
            borderColor: T.warningBorder,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}
        >
          <Text style={{ color: T.warning, fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>
            SUPER OVER · 1 ov · {inningsLimits.maxWickets} wkts
          </Text>
        </View>
      ) : null}

      {/* ═════ BATTING ORDER MODAL ═════ */}
      <Modal
        visible={showBattingOrderModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowBattingOrderModal(false);
          setLocalBattingOrder([]);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: T.card,
              borderRadius: 16,
              padding: 20,
              maxHeight: "85%",
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <View>
                <Text
                  style={{ color: T.text, fontSize: 18, fontWeight: "bold" }}
                >
                  Batting Order
                </Text>
                <Text style={{ color: T.textDim, fontSize: 12 }}>
                  {teamNames[battingTeamSide]}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowBattingOrderModal(false);
                  setLocalBattingOrder([]);
                }}
                style={{ padding: 8 }}
              >
                <Text style={{ color: T.textDim, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: T.textMuted, fontSize: 11, marginBottom: 12 }}>
              Use ▲▼ to reorder • Currently batting and out players are locked in place
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flexGrow: 0 }}
            >
              {localBattingOrder.map((player, index) => {
                const playerId = String(player._id || player.id);
                const isBatting = (sportData?.currentBatsmen || []).some(
                  (b) => String(b.playerId) === playerId,
                );
                const isOut = isPlayerOut(playerId);
                const isLocked = isBatting || isOut;
                return (
                  <View
                    key={playerId}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 12,
                      marginBottom: 6,
                      borderRadius: 10,
                      borderWidth: 1,
                      backgroundColor: isBatting
                        ? "rgba(34,197,94,0.1)"
                        : isOut
                          ? "rgba(220,38,38,0.1)"
                        : T.cardElevated,
                      borderColor: isBatting
                        ? "rgba(34,197,94,0.3)"
                        : isOut
                          ? "rgba(220,38,38,0.35)"
                        : T.border,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isBatting ? "#16a34a" : isOut ? "#dc2626" : "#374151",
                        }}
                      >
                        <Text
                          style={{
                            color: "#FFFFFF",
                            fontWeight: "bold",
                            fontSize: 12,
                          }}
                        >
                          {index + 1}
                        </Text>
                      </View>
                      <View>
                        <Text
                          style={{
                            color: T.text,
                            fontWeight: "600",
                            fontSize: 13,
                          }}
                        >
                          {player.firstName} {player.lastName}
                        </Text>
                        <Text style={{ color: T.textDim, fontSize: 10 }}>
                          {player.jerseyNumber ? `#${player.jerseyNumber}` : ""}
                          {player.position ? ` · ${player.position}` : ""}
                        </Text>
                      </View>
                    </View>
                    {isBatting ? (
                      <Text
                        style={{
                          color: "#4ade80",
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                      >
                          Batting
                      </Text>
                    ) : isOut ? (
                      <Text
                        style={{
                          color: "#f87171",
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        OUT
                      </Text>
                    ) : (
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        <TouchableOpacity
                          disabled={isLocked || index === 0}
                          onPress={() => {
                            const order = [...localBattingOrder];
                            [order[index], order[index - 1]] = [
                              order[index - 1],
                              order[index],
                            ];
                            setLocalBattingOrder(order);
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                            backgroundColor: T.cardElevated,
                            opacity: isLocked || index === 0 ? 0.3 : 1,
                          }}
                        >
                          <Text style={{ color: T.text, fontSize: 13 }}>
                            ▲
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={isLocked || index === localBattingOrder.length - 1}
                          onPress={() => {
                            const order = [...localBattingOrder];
                            [order[index], order[index + 1]] = [
                              order[index + 1],
                              order[index],
                            ];
                            setLocalBattingOrder(order);
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                            backgroundColor: T.cardElevated,
                            opacity:
                              isLocked || index === localBattingOrder.length - 1 ? 0.3 : 1,
                          }}
                        >
                          <Text style={{ color: T.text, fontSize: 13 }}>
                            ▼
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Action Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                disabled={protectedDisabled}
                onPress={() => {
                  const finalOrder = localBattingOrder.map((p, i) => ({
                    playerId: p._id || p.id,
                    name: `${p.firstName} ${p.lastName}`,
                    battingOrder: i + 1,
                  }));
                  const payload = {
                    team: battingTeamSide,
                    battingOrder: finalOrder,
                  };
                  if (validBatsmen.length === 0) {
                    payload.currentBatsmen = finalOrder
                      .slice(0, 2)
                      .map((p, i) => ({
                        playerId: p.playerId,
                        striker: i === 0,
                        runs: 0,
                        balls: 0,
                        fours: 0,
                        sixes: 0,
                      }));
                  }
                  onSetBattingOrder?.(payload);
                  setBattingSaving(true);
                }}
                style={{
                  flex: 1,
                  backgroundColor: "#16a34a",
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 48,
                  opacity: protectedDisabled ? 0.5 : 1,
                }}
              >
                {isUpdating || battingSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{ color: "white", fontWeight: "700", fontSize: 14 }}
                  >
                    Save Order
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowBattingOrderModal(false);
                  setLocalBattingOrder([]);
                }}
                disabled={protectedDisabled || battingSaving}
                style={{
                  flex: 1,
                  backgroundColor: T.cardElevated,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  opacity: protectedDisabled || battingSaving ? 0.5 : 1,
                }}
              >
                <Text
                  style={{ color: T.text, fontWeight: "700", fontSize: 14 }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


export default CricketScoringPanelMobile;

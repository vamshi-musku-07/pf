import { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { getCricketMatchResult } from "./hooks/cricketState";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

function CricketScorecardMobile({ currentGame, players, teamNames }) {
  const T = useGameScoringTheme();
  const sport = currentGame?.sport;
  const base = currentGame?.base;
  const matchResult = getCricketMatchResult(currentGame);
  const matchResultText =
    matchResult?.finished && matchResult.resultText
      ? matchResult.tie
        ? matchResult.resultText
        : matchResult.superOver
          ? `${matchResult.winnerSide === "home" ? teamNames?.home : teamNames?.away} ${matchResult.resultText}`
          : `${matchResult.winnerSide === "home" ? teamNames?.home : teamNames?.away} ${matchResult.resultText}`
      : null;

  const allPlayers = useMemo(
    () => [...(players?.home || []), ...(players?.away || [])],
    [players],
  );

  const findPlayer = (playerId) => {
    if (!playerId) return null;
    const pid = String(playerId);
    return allPlayers.find((pl) => String(pl.id || pl._id) === pid) || null;
  };

  const getPlayerName = (playerId) => {
    const player = findPlayer(playerId);
    if (!player) return "Unknown Player";
    const fullName = [player.firstName, player.lastName]
      .filter((part) => typeof part === "string" && part.trim())
      .join(" ")
      .trim();
    return fullName || player.name || player.fullName || player.displayName || "Unknown Player";
  };

  const getPlayerShortName = (playerId) => {
    const player = findPlayer(playerId);
    if (!player) return "Unknown";
    const firstName = (player.firstName || "").trim();
    const lastName = (player.lastName || "").trim();
    if (firstName && lastName) return `${firstName[0]}. ${lastName}`;
    if (firstName) return firstName;
    if (lastName) return lastName;
    return player.name || player.fullName || player.displayName || "Unknown";
  };

  const getPartnershipPlayerName = (playerId) => {
    if (!playerId) return "Batter TBC";
    return getPlayerName(playerId);
  };

  const getDismissalText = (playerId, innings) => {
    if (!sport?.events) return "not out";
    const pid = String(playerId);
    const WICKET_TYPES = [
      "wicket",
      "bowled",
      "caught",
      "lbw",
      "run_out",
      "stumped",
      "hit_wicket",
    ];
    const ev = sport.events.find(
      (e) =>
        e.innings === innings &&
        (String(e.dismissedPlayerId) === pid || String(e.playerId) === pid) &&
        WICKET_TYPES.includes(e.eventType),
    );
    if (!ev) return "not out";
    const type = ev.wicketType || ev.eventType;
    const bowlerPid = String(ev.playerId) !== pid ? ev.playerId : "";
    switch (type) {
      case "bowled":
        return `b ${getPlayerShortName(bowlerPid)}`;
      case "caught":
        return `c ${getPlayerShortName(ev.fielderId || "")} b ${getPlayerShortName(bowlerPid)}`;
      case "lbw":
        return `lbw b ${getPlayerShortName(bowlerPid)}`;
      case "run_out":
        return `run out (${getPlayerShortName(ev.fielderId || "")})`;
      case "stumped":
        return `st ${getPlayerShortName(ev.fielderId || "")} b ${getPlayerShortName(bowlerPid)}`;
      case "hit_wicket":
        return "hit wicket";
      default:
        return "out";
    }
  };

  const calcSR = (runs, balls) => {
    if (!balls) return "0.0";
    return ((runs / balls) * 100).toFixed(1);
  };

  // Canonical runs by eventType — used as fallback when an event was saved
  // without an explicit `runs` field (common before the live-wrapper fix).
  const EVENT_RUNS = {
    dot_ball: 0, single: 1, double: 2, triple: 3,
    boundary_4: 4, boundary_6: 6,
  };

  const getEventRuns = (ev) =>
    ev.runs != null ? ev.runs : (EVENT_RUNS[ev.eventType] ?? 0);

  const inningsData = useMemo(() => {
    if (!sport?.innings) return [];
    const homeId = String(base?.teamId || "");

    return sport.innings.map((inn) => {
      const battingTeamId = inn.battingTeamId;
      const bowlingTeamId = inn.bowlingTeamId;
      const battingTeamName =
        String(battingTeamId) === homeId ? teamNames?.home : teamNames?.away;

      // Build batting stats from events
      const eventBatting = new Map();
      (sport.events || [])
        .filter(
          (e) =>
            e.innings === inn.inningsNumber &&
            String(e.teamId) === String(battingTeamId) &&
            [
              "dot_ball",
              "single",
              "double",
              "triple",
              "boundary_4",
              "boundary_6",
              "ball",
            ].includes(e.eventType),
        )
        .forEach((ev) => {
          const pid = String(ev.playerId);
          if (!eventBatting.has(pid))
            eventBatting.set(pid, { runs: 0, balls: 0, fours: 0, sixes: 0 });
          const p = eventBatting.get(pid);
          const runs = getEventRuns(ev);
          p.runs += runs;
          p.balls += 1;
          if (ev.eventType === "boundary_4" || runs === 4) p.fours += 1;
          if (ev.eventType === "boundary_6" || runs === 6) p.sixes += 1;
        });

      const psMap = new Map();
      (sport.playerStats || [])
        .filter((ps) => String(ps.teamId) === String(battingTeamId))
        .forEach((ps) => psMap.set(String(ps.playerId), ps));

      const orderKey =
        String(battingTeamId) === homeId
          ? "homeBattingOrder"
          : "awayBattingOrder";
      const battingOrderArr = sport[orderKey] || [];
      const boMap = new Map();
      battingOrderArr.forEach((bo) => boMap.set(String(bo.playerId), bo));

      const allPlayerIds = new Set([
        ...eventBatting.keys(),
        ...psMap.keys(),
        // Include ALL batting order players so the lineup shows even before scoring starts
        ...battingOrderArr.map((bo) => String(bo.playerId)),
      ]);

      const battingStats = [];
      for (const pid of allPlayerIds) {
        const ev = eventBatting.get(pid);
        const ps = psMap.get(pid);
        const bo = boMap.get(pid);
        const runs = ev?.runs ?? bo?.runs ?? ps?.runs ?? 0;
        const balls = ev?.balls ?? bo?.balls ?? ps?.balls_faced ?? 0;
        const fours = ev?.fours ?? bo?.fours ?? ps?.fours ?? 0;
        const sixes = ev?.sixes ?? bo?.sixes ?? ps?.sixes ?? 0;
        const WICKET_TYPES = [
          "wicket",
          "bowled",
          "caught",
          "lbw",
          "run_out",
          "stumped",
          "hit_wicket",
        ];
        const isOut =
          (sport.events || []).some(
            (e) =>
              e.innings === inn.inningsNumber &&
              (String(e.dismissedPlayerId) === pid ||
                String(e.playerId) === pid) &&
              WICKET_TYPES.includes(e.eventType),
          ) ||
          ps?.currentInnings?.isOut ||
          bo?.isOut ||
          false;
        const dismissalText = getDismissalText(pid, inn.inningsNumber);

        battingStats.push({
          playerId: pid,
          name: getPlayerName(pid),
          runs,
          balls,
          fours,
          sixes,
          sr: calcSR(runs, balls),
          isOut,
          howOut: isOut && dismissalText === "not out" ? "out" : dismissalText,
          battingOrder: bo?.battingOrder ?? ps?.battingOrder ?? 99,
        });
      }
      battingStats.sort((a, b) => a.battingOrder - b.battingOrder);

      // Build bowling stats from playerStats + events
      const bowlingEventMap = new Map();
      (sport.events || [])
        .filter(
          (e) =>
            e.innings === inn.inningsNumber &&
            String(e.teamId) === String(bowlingTeamId),
        )
        .forEach((ev) => {
          const pid = String(ev.playerId);
          if (!bowlingEventMap.has(pid))
            bowlingEventMap.set(pid, { balls: 0, runs: 0, wickets: 0 });
          const b = bowlingEventMap.get(pid);
          const isLegal = !["wide", "no_ball"].includes(ev.eventType);
          if (isLegal) b.balls += 1;
          b.runs += ev.runs || 0;
          if (
            [
              "wicket",
              "bowled",
              "caught",
              "lbw",
              "stumped",
              "hit_wicket",
            ].includes(ev.eventType)
          )
            b.wickets += 1;
        });

      const bowlingStats = (sport.playerStats || [])
        .filter(
          (ps) =>
            String(ps.teamId) === String(bowlingTeamId) &&
            (ps.currentInnings?.didBowl ||
              ps.overs_bowled > 0 ||
              ps.wickets > 0 ||
              bowlingEventMap.has(String(ps.playerId))),
        )
        .map((ps) => {
          const evBowl = bowlingEventMap.get(String(ps.playerId));
          const totalBalls = evBowl?.balls ?? ps.balls_bowled ?? 0;
          const oversDisplay = (
            Math.floor(totalBalls / 6) +
            (totalBalls % 6) / 10
          ).toFixed(1);
          const oversActual = totalBalls / 6;
          const runsConceded = evBowl?.runs ?? ps.runs_conceded ?? 0;
          const wickets = evBowl?.wickets ?? ps.wickets ?? 0;
          return {
            playerId: ps.playerId,
            name: getPlayerName(ps.playerId),
            overs: oversDisplay,
            maidens: ps.maidens ?? 0,
            runs: runsConceded,
            wickets,
            economy:
              oversActual > 0 ? (runsConceded / oversActual).toFixed(1) : "0.0",
          };
        });

      // Build Fall of Wickets from events
      const fallOfWickets = [];
      const WICKET_TYPES_FOW = ["wicket", "bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket"];
      let fowRunningTotal = 0;
      let fowBallCount = 0;
      let fowWicketNum = 0;
      const fowInningsEvents = (sport.events || []).filter(
        (e) => e && e.innings === inn.inningsNumber
      );
      for (const ev of fowInningsEvents) {
        const isLegal = !["wide", "no_ball"].includes(ev.eventType);
        fowRunningTotal += getEventRuns(ev);
        if (isLegal) fowBallCount += 1;
        if (WICKET_TYPES_FOW.includes(ev.eventType)) {
          fowWicketNum += 1;
          // Use event's overNumber/ballNumber if available, else compute
          const overDisplay = ev.overNumber != null && ev.ballNumber != null
            ? `${ev.overNumber}.${ev.ballNumber}`
            : `${Math.floor((fowBallCount - 1) / 6)}.${((fowBallCount - 1) % 6) + 1}`;
          fallOfWickets.push({
            wicketNumber: fowWicketNum,
            score: fowRunningTotal,
            overDisplay,
            dismissedPlayerId: ev.dismissedPlayerId || ev.playerId,
            wicketType: ev.eventType,
          });
        }
      }

      // Build partnerships from events
      const partnerships = [];
      const WICKET_TYPES = ["wicket", "bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket"];
      const RUN_EVENTS = ["dot_ball", "single", "double", "triple", "boundary_4", "boundary_6", "ball", "wide", "no_ball", "bye", "leg_bye"];
      const inningsEvents = (sport.events || []).filter(
        (e) => e && e.innings === inn.inningsNumber
      );

      // Split events by wickets to derive partnerships
      let partStart = 0;
      let partBatsmenAtStart = battingOrderArr.slice(0, 2).map((bo) => String(bo.playerId));
      // Track which batsmen are "current" as we iterate
      let activeBatsmen = [...partBatsmenAtStart];
      let partNumber = 1;

      const buildPartnership = (events, batsmenIds, wicketIdx) => {
        let runs = 0;
        let balls = 0;
        let fours = 0;
        let sixes = 0;
        for (const ev of events) {
          if (!RUN_EVENTS.includes(ev.eventType)) continue;
          const r = getEventRuns(ev);
          runs += r;
          const isLegal = !["wide", "no_ball"].includes(ev.eventType);
          if (isLegal) balls += 1;
          if (ev.eventType === "boundary_4" || r === 4) fours += 1;
          if (ev.eventType === "boundary_6" || r === 6) sixes += 1;
        }
        const runRate = balls > 0 ? ((runs / balls) * 6).toFixed(2) : "0.00";
        return {
          wicket: partNumber,
          batsman1: batsmenIds[0] || null,
          batsman2: batsmenIds[1] || null,
          batsman1Name: getPartnershipPlayerName(batsmenIds[0]),
          batsman2Name: getPartnershipPlayerName(batsmenIds[1]),
          runs,
          balls,
          fours,
          sixes,
          runRate,
        };
      };

      for (let i = 0; i < inningsEvents.length; i++) {
        const ev = inningsEvents[i];
        if (WICKET_TYPES.includes(ev.eventType)) {
          const partEvents = inningsEvents.slice(partStart, i);
          partnerships.push(buildPartnership(partEvents, activeBatsmen, partNumber));
          partNumber++;
          // Replace dismissed batter with next in order
          const dismissedId = String(ev.dismissedPlayerId || ev.playerId || "");
          activeBatsmen = activeBatsmen.filter((id) => id !== dismissedId);
          // Next batter from batting order not yet in
          const usedBatsmen = new Set();
          for (let j = 0; j <= i; j++) {
            const prev = inningsEvents[j];
            if (WICKET_TYPES.includes(prev.eventType)) {
              usedBatsmen.add(String(prev.dismissedPlayerId || prev.playerId || ""));
            }
          }
          const nextBatter = battingOrderArr.find(
            (bo) => !usedBatsmen.has(String(bo.playerId)) && !activeBatsmen.includes(String(bo.playerId))
          );
          if (nextBatter) activeBatsmen.push(String(nextBatter.playerId));
          partStart = i + 1;
        }
      }
      // Current / last unbroken partnership
      if (partStart < inningsEvents.length) {
        const partEvents = inningsEvents.slice(partStart);
        const p = buildPartnership(partEvents, activeBatsmen, partNumber);
        p.notOut = true;
        partnerships.push(p);
      }

      // Best partnership
      const bestPartnership = partnerships.length > 0
        ? partnerships.reduce((best, p) => (p.runs > best.runs ? p : best), partnerships[0])
        : null;

      return {
        inningsNumber: inn.inningsNumber,
        battingTeamName,
        totalRuns: inn.total_runs,
        wickets: inn.wickets,
        overs: Math.floor((inn.balls_completed || 0) / 6),
        balls: (inn.balls_completed || 0) % 6,
        extras: inn.extras || 0,
        extrasBreakdown: inn.extras_breakdown || {},
        battingStats,
        bowlingStats,
        partnerships,
        bestPartnership,
        fallOfWickets,
      };
    });
  }, [sport, base, teamNames, players]);

  if (!inningsData.length) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 40 }}>
        <Text style={{ color: T.textMuted, fontSize: 14 }}>
          No innings data available yet
        </Text>
      </View>
    );
  }

  const colW = {
    name: 100,
    howOut: 90,
    R: 28,
    B: 28,
    fours: 24,
    sixes: 24,
    sr: 38,
  };
  const bowlColW = { name: 110, O: 32, M: 26, R: 28, W: 26, econ: 38 };

  return (
    <View style={{ gap: 24 }}>
      {matchResultText && (
        <View
          style={{
            backgroundColor: T.isDark ? "rgba(71,254,183,0.12)" : "#ECFDF5",
            borderWidth: 1,
            borderColor: T.isDark ? "rgba(71,254,183,0.4)" : "#86EFAC",
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: T.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            Result
          </Text>
          <Text style={{ color: T.accent, fontWeight: "900", fontSize: 15, textAlign: "center" }}>
            {matchResultText}
          </Text>
        </View>
      )}
      {inningsData.map((inn) => (
        <View
          key={inn.inningsNumber}
          style={{
            gap: 12,
            backgroundColor: T.card,
            borderWidth: 1,
            borderColor: T.border,
            borderRadius: 16,
            padding: 12,
          }}
        >
          {/* Innings Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: T.cardElevated,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: T.text, fontWeight: "bold", fontSize: 13 }}>
              {inn.battingTeamName} —{" "}
              {inn.inningsNumber <= 2
                ? `${inn.inningsNumber === 1 ? "1st" : "2nd"} Innings`
                : `Super Over ${Math.ceil((inn.inningsNumber - 2) / 2)}${inn.inningsNumber % 2 === 1 ? " (1st)" : " (2nd)"}`}
            </Text>
            <Text
              style={{ color: "#16A34A", fontWeight: "bold", fontSize: 13 }}
            >
              {inn.totalRuns}/{inn.wickets}{" "}
              <Text
                style={{ color: T.textDim, fontWeight: "normal", fontSize: 11 }}
              >
                ({inn.overs}.{inn.balls} ov)
              </Text>
            </Text>
          </View>

          {/* Batting Card */}
          {inn.battingStats.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: 340 }}>
                {/* Header */}
                <View
                  style={{
                    flexDirection: "row",
                    borderBottomWidth: 1,
                    borderBottomColor: T.border,
                    paddingBottom: 6,
                    marginBottom: 2,
                  }}
                >
                  <Text
                    style={{
                      width: colW.name,
                      color: T.textDim,
                      fontSize: 10,
                      fontWeight: "600",
                    }}
                  >
                    Batter
                  </Text>
                  <Text
                    style={{
                      width: colW.howOut,
                      color: T.textDim,
                      fontSize: 10,
                      fontWeight: "600",
                    }}
                  >
                    How Out
                  </Text>
                  <Text
                    style={{
                      width: colW.R,
                      color: T.textDim,
                      fontSize: 10,
                      fontWeight: "600",
                      textAlign: "right",
                    }}
                  >
                    R
                  </Text>
                  <Text
                    style={{
                      width: colW.B,
                      color: T.textDim,
                      fontSize: 10,
                      fontWeight: "600",
                      textAlign: "right",
                    }}
                  >
                    B
                  </Text>
                  <Text
                    style={{
                      width: colW.fours,
                      color: T.textDim,
                      fontSize: 10,
                      fontWeight: "600",
                      textAlign: "right",
                    }}
                  >
                    4s
                  </Text>
                  <Text
                    style={{
                      width: colW.sixes,
                      color: T.textDim,
                      fontSize: 10,
                      fontWeight: "600",
                      textAlign: "right",
                    }}
                  >
                    6s
                  </Text>
                  <Text
                    style={{
                      width: colW.sr,
                      color: T.textDim,
                      fontSize: 10,
                      fontWeight: "600",
                      textAlign: "right",
                    }}
                  >
                    SR
                  </Text>
                </View>
                {/* Rows */}
                {inn.battingStats.map((bat, idx) => (
                  <View
                    key={bat.playerId || idx}
                    style={{
                      flexDirection: "row",
                      paddingVertical: 7,
                      borderBottomWidth: 1,
                      borderBottomColor: T.borderSubtle,
                    }}
                  >
                    <View style={{ width: colW.name }}>
                      <Text
                        style={{
                          color: T.text,
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                        numberOfLines={1}
                      >
                        {bat.name}
                        {!bat.isOut && (
                          <Text style={{ color: T.isDark ? "#4ADE80" : "#16A34A" }}>*</Text>
                        )}
                      </Text>
                    </View>
                    <Text
                      style={{
                        width: colW.howOut,
                        color: bat.isOut
                          ? T.dangerText
                          : T.isDark
                            ? "#4ADE80"
                            : "#15803D",
                        fontSize: 10,
                      }}
                      numberOfLines={1}
                    >
                      {bat.howOut}
                    </Text>
                    <Text
                      style={{
                        width: colW.R,
                        color: T.text,
                        fontSize: 11,
                        fontWeight: "bold",
                        textAlign: "right",
                      }}
                    >
                      {bat.runs}
                    </Text>
                    <Text
                      style={{
                        width: colW.B,
                        color: T.text,
                        fontSize: 11,
                        textAlign: "right",
                      }}
                    >
                      {bat.balls}
                    </Text>
                    <Text
                      style={{
                        width: colW.fours,
                        color: T.text,
                        fontSize: 11,
                        textAlign: "right",
                      }}
                    >
                      {bat.fours}
                    </Text>
                    <Text
                      style={{
                        width: colW.sixes,
                        color: T.text,
                        fontSize: 11,
                        textAlign: "right",
                      }}
                    >
                      {bat.sixes}
                    </Text>
                    <Text
                      style={{
                        width: colW.sr,
                        color: T.textDim,
                        fontSize: 10,
                        textAlign: "right",
                      }}
                    >
                      {bat.sr}
                    </Text>
                  </View>
                ))}
                {/* Extras & Total */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 6,
                    paddingHorizontal: 2,
                    paddingVertical: 6,
                    backgroundColor: T.cardElevated,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: T.textDim, fontSize: 10 }}>
                    Extras: {inn.extras}
                    {inn.extras > 0 && (
                      <Text style={{ color: T.textMuted }}>
                        {" "}
                        (wd {inn.extrasBreakdown.wides || 0} nb{" "}
                        {inn.extrasBreakdown.no_balls || 0} b{" "}
                        {inn.extrasBreakdown.byes || 0} lb{" "}
                        {inn.extrasBreakdown.leg_byes || 0})
                      </Text>
                    )}
                  </Text>
                  <Text
                    style={{ color: T.text, fontWeight: "bold", fontSize: 11 }}
                  >
                    {inn.totalRuns}/{inn.wickets}
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}

          {/* Bowling Card */}
          {inn.bowlingStats.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text
                style={{
                  color: T.textDim,
                  fontSize: 10,
                  fontWeight: "600",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Bowling
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ minWidth: 300 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      borderBottomWidth: 1,
                      borderBottomColor: T.border,
                      paddingBottom: 6,
                      marginBottom: 2,
                    }}
                  >
                    <Text
                      style={{
                        width: bowlColW.name,
                        color: T.textDim,
                        fontSize: 10,
                        fontWeight: "600",
                      }}
                    >
                      Bowler
                    </Text>
                    <Text
                      style={{
                        width: bowlColW.O,
                        color: T.textDim,
                        fontSize: 10,
                        fontWeight: "600",
                        textAlign: "right",
                      }}
                    >
                      O
                    </Text>
                    <Text
                      style={{
                        width: bowlColW.M,
                        color: T.textDim,
                        fontSize: 10,
                        fontWeight: "600",
                        textAlign: "right",
                      }}
                    >
                      M
                    </Text>
                    <Text
                      style={{
                        width: bowlColW.R,
                        color: T.textDim,
                        fontSize: 10,
                        fontWeight: "600",
                        textAlign: "right",
                      }}
                    >
                      R
                    </Text>
                    <Text
                      style={{
                        width: bowlColW.W,
                        color: T.textDim,
                        fontSize: 10,
                        fontWeight: "600",
                        textAlign: "right",
                      }}
                    >
                      W
                    </Text>
                    <Text
                      style={{
                        width: bowlColW.econ,
                        color: T.textDim,
                        fontSize: 10,
                        fontWeight: "600",
                        textAlign: "right",
                      }}
                    >
                      Econ
                    </Text>
                  </View>
                  {inn.bowlingStats.map((bowl, idx) => (
                    <View
                      key={bowl.playerId || idx}
                      style={{
                        flexDirection: "row",
                        paddingVertical: 7,
                        borderBottomWidth: 1,
                        borderBottomColor: T.borderSubtle,
                      }}
                    >
                      <Text
                        style={{
                          width: bowlColW.name,
                          color: T.text,
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                        numberOfLines={1}
                      >
                        {bowl.name}
                      </Text>
                      <Text
                        style={{
                          width: bowlColW.O,
                          color: T.text,
                          fontSize: 11,
                          textAlign: "right",
                        }}
                      >
                        {bowl.overs}
                      </Text>
                      <Text
                        style={{
                          width: bowlColW.M,
                          color: T.text,
                          fontSize: 11,
                          textAlign: "right",
                        }}
                      >
                        {bowl.maidens}
                      </Text>
                      <Text
                        style={{
                          width: bowlColW.R,
                          color: T.text,
                          fontSize: 11,
                          textAlign: "right",
                        }}
                      >
                        {bowl.runs}
                      </Text>
                      <Text
                        style={{
                          width: bowlColW.W,
                          color: T.text,
                          fontSize: 11,
                          fontWeight: "bold",
                          textAlign: "right",
                        }}
                      >
                        {bowl.wickets}
                      </Text>
                      <Text
                        style={{
                          width: bowlColW.econ,
                          color: T.textDim,
                          fontSize: 10,
                          textAlign: "right",
                        }}
                      >
                        {bowl.economy}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Partnerships */}
          {inn.partnerships.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <Text
                  style={{
                    color: T.textDim,
                    fontSize: 10,
                    fontWeight: "600",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Partnerships
                </Text>
                {inn.bestPartnership && inn.bestPartnership.runs > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ color: T.textMuted, fontSize: 9 }}>Best:</Text>
                    <Text style={{ color: T.warning, fontSize: 10, fontWeight: "800" }}>
                      {inn.bestPartnership.runs}({inn.bestPartnership.balls})
                    </Text>
                  </View>
                )}
              </View>
              {inn.partnerships.map((p, idx) => {
                const isCentury = p.runs >= 100;
                const isFifty = p.runs >= 50 && p.runs < 100;
                const isBest = inn.bestPartnership && p.runs === inn.bestPartnership.runs && p.wicket === inn.bestPartnership.wicket;
                const highlightBg = isCentury
                  ? T.warningBg
                  : isFifty
                    ? T.isDark
                      ? "rgba(71,254,183,0.06)"
                      : "#ECFDF5"
                    : T.cardElevated;
                const highlightBorder = isCentury
                  ? T.warningBorder
                  : isFifty
                    ? T.isDark
                      ? "rgba(71,254,183,0.2)"
                      : "#86EFAC"
                    : T.border;
                const wicketLabel = p.notOut ? "Current" : `${p.wicket}${p.wicket === 1 ? "st" : p.wicket === 2 ? "nd" : p.wicket === 3 ? "rd" : "th"} wicket`;
                return (
                  <View
                    key={idx}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 10,
                      marginBottom: 6,
                      borderRadius: 10,
                      backgroundColor: highlightBg,
                      borderWidth: 1,
                      borderColor: isBest ? T.warningBorder : highlightBorder,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <Text style={{ color: p.notOut ? "#16A34A" : T.textMuted, fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 }}>
                            {wicketLabel}
                          </Text>
                          {isBest && (
                            <Text style={{ color: T.warning, fontSize: 9, fontWeight: "800" }}>
                              BEST
                            </Text>
                          )}
                        </View>
                        <Text style={{ color: T.text, fontSize: 12, fontWeight: "700" }} numberOfLines={2}>
                          {p.batsman1Name} & {p.batsman2Name}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                          <Text style={{ color: T.textMuted, fontSize: 9 }}>
                            4s {p.fours}
                          </Text>
                          <Text style={{ color: T.textMuted, fontSize: 9 }}>
                            6s {p.sixes}
                          </Text>
                          <Text style={{ color: T.textMuted, fontSize: 9 }}>
                            RR {p.runRate}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end", minWidth: 72 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {isCentury && (
                            <Text style={{ fontSize: 10, color: T.warning, fontWeight: "900" }}>💯</Text>
                          )}
                          {isFifty && (
                            <Text style={{ fontSize: 10, color: T.isDark ? "#4ADE80" : "#16A34A", fontWeight: "800" }}>⭐</Text>
                          )}
                        </View>
                        <Text style={{ color: isCentury ? T.warning : isFifty ? "#16A34A" : T.text, fontWeight: "900", fontSize: 18, marginTop: 2 }}>
                          {p.runs}
                        </Text>
                        <Text style={{ color: T.textDim, fontSize: 10 }}>
                          {p.balls} balls
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Fall of Wickets */}
          {inn.fallOfWickets.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text
                style={{
                  color: T.textDim,
                  fontSize: 10,
                  fontWeight: "600",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Fall of Wickets
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {inn.fallOfWickets.map((fow, idx) => (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: T.dangerBg,
                      borderWidth: 1,
                      borderColor: T.isDark ? "rgba(239,68,68,0.25)" : "#FECACA",
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ color: T.dangerText, fontSize: 10, fontWeight: "700" }}>
                      {fow.score}/{fow.wicketNumber}
                    </Text>
                    <Text style={{ color: T.textMuted, fontSize: 9, marginTop: 1 }}>
                      {getPlayerShortName(fow.dismissedPlayerId)} ({fow.overDisplay} ov)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}


export { CricketScorecardMobile };

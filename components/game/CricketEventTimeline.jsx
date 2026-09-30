import { useMemo } from "react";
import { FlatList, Text, View } from "react-native";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";

function CricketEventTimelineMobile({ currentGame, players, teamNames }) {
  const T = useGameScoringTheme();
  const sport = currentGame?.sport;
  const base = currentGame?.base;

  const allPlayers = useMemo(
    () => [...(players?.home || []), ...(players?.away || [])],
    [players],
  );

  const getPlayerShortName = (playerId) => {
    if (!playerId) return "";
    const pid = String(playerId);
    const p = allPlayers.find((pl) => String(pl.id || pl._id) === pid);
    if (!p) return "";
    return `${p.firstName?.[0] || ""}. ${p.lastName || ""}`;
  };

  // Build ball-by-ball timeline with running score
  const timeline = useMemo(() => {
    if (!sport?.events?.length) return [];

    const events = sport.events.filter((e) => e != null);
    const DELIVERY_TYPES = [
      "dot_ball", "single", "double", "triple", "boundary_4", "boundary_6",
      "ball", "wide", "no_ball", "bye", "leg_bye",
      "wicket", "bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket",
    ];
    const WICKET_TYPES = [
      "wicket", "bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket",
    ];

    let runningScore = { 1: { runs: 0, wickets: 0, balls: 0 }, 2: { runs: 0, wickets: 0, balls: 0 } };
    const result = [];

    for (const ev of events) {
      if (!DELIVERY_TYPES.includes(ev.eventType)) continue;

      const inn = ev.innings || 1;
      if (!runningScore[inn]) runningScore[inn] = { runs: 0, wickets: 0, balls: 0 };

      const runs = ev.runs || 0;
      runningScore[inn].runs += runs;

      const isLegal = !["wide", "no_ball"].includes(ev.eventType);
      if (isLegal) runningScore[inn].balls += 1;

      if (WICKET_TYPES.includes(ev.eventType)) {
        runningScore[inn].wickets += 1;
      }

      const overNum = isLegal
        ? Math.floor((runningScore[inn].balls - 1) / 6)
        : Math.floor(runningScore[inn].balls / 6);
      const ballInOver = isLegal
        ? ((runningScore[inn].balls - 1) % 6) + 1
        : runningScore[inn].balls % 6;

      // Use event's overNumber/ballNumber if available
      const displayOver = ev.overNumber != null ? ev.overNumber : overNum;
      const displayBall = ev.ballNumber != null ? ev.ballNumber : ballInOver;

      result.push({
        key: `${inn}-${result.length}`,
        innings: inn,
        overBall: `${displayOver}.${displayBall}`,
        eventType: ev.eventType,
        runs,
        scoreAfter: `${runningScore[inn].runs}/${runningScore[inn].wickets}`,
        batsmanId: ev.playerId,
        dismissedId: ev.dismissedPlayerId,
        fielderId: ev.fielderId,
        wicketType: ev.wicketType || ev.eventType,
        isWicket: WICKET_TYPES.includes(ev.eventType),
        isExtra: ["wide", "no_ball", "bye", "leg_bye"].includes(ev.eventType),
        isBoundary: ["boundary_4", "boundary_6"].includes(ev.eventType),
      });
    }

    return result.reverse(); // Most recent first
  }, [sport?.events]);

  const getEventLabel = (item) => {
    if (item.isWicket) {
      const dismissed = getPlayerShortName(item.dismissedId || item.batsmanId);
      const type = item.wicketType.replace(/_/g, " ");
      const fielder = item.fielderId ? ` (${getPlayerShortName(item.fielderId)})` : "";
      return `OUT! ${dismissed} - ${type}${fielder}`;
    }
    switch (item.eventType) {
      case "dot_ball": return "No run";
      case "single": return "1 run";
      case "double": return "2 runs";
      case "triple": return "3 runs";
      case "boundary_4": return "FOUR!";
      case "boundary_6": return "SIX!";
      case "ball": return item.runs > 0 ? `${item.runs} run${item.runs > 1 ? "s" : ""}` : "No run";
      case "wide": return item.runs > 1 ? `Wide + ${item.runs - 1}` : "Wide";
      case "no_ball": return item.runs > 1 ? `No ball + ${item.runs - 1}` : "No ball";
      case "bye": return item.runs > 1 ? `${item.runs} byes` : "Bye";
      case "leg_bye": return item.runs > 1 ? `${item.runs} leg byes` : "Leg bye";
      default: return item.eventType.replace(/_/g, " ");
    }
  };

  const getEventColor = (item) => {
    if (item.isWicket) {
      return {
        bg: T.dangerBg,
        border: T.isDark ? "rgba(239,68,68,0.3)" : "#FECACA",
        text: T.dangerText,
        dot: "#EF4444",
      };
    }
    if (item.isBoundary) {
      return item.eventType === "boundary_6"
        ? {
            bg: T.isDark ? "rgba(34,197,94,0.1)" : "#ECFDF5",
            border: T.isDark ? "rgba(34,197,94,0.25)" : "#86EFAC",
            text: T.isDark ? "#4ADE80" : "#15803D",
            dot: "#22C55E",
          }
        : {
            bg: T.isDark ? "rgba(14,165,233,0.1)" : "#EFF6FF",
            border: T.isDark ? "rgba(14,165,233,0.25)" : "#93C5FD",
            text: T.isDark ? "#38BDF8" : "#1D4ED8",
            dot: "#0EA5E9",
          };
    }
    if (item.isExtra) {
      return {
        bg: T.warningBg,
        border: T.warningBorder,
        text: T.warning,
        dot: T.warningStrong,
      };
    }
    if (item.runs === 0) {
      return {
        bg: T.cardElevated,
        border: T.border,
        text: T.textMuted,
        dot: T.textMuted,
      };
    }
    return {
      bg: T.card,
      border: T.border,
      text: T.text,
      dot: T.textDim,
    };
  };

  const renderItem = ({ item }) => {
    const colors = getEventColor(item);
    const label = getEventLabel(item);
    const batsman = !item.isWicket ? getPlayerShortName(item.batsmanId) : "";

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 8,
          paddingHorizontal: 10,
          marginBottom: 4,
          borderRadius: 8,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {/* Over.Ball */}
        <View style={{ width: 36, alignItems: "center" }}>
          <Text style={{ color: T.textDim, fontSize: 10, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
            {item.overBall}
          </Text>
        </View>

        {/* Event dot */}
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.dot, marginHorizontal: 8 }} />

        {/* Event description */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>
            {label}
          </Text>
          {batsman ? (
            <Text style={{ color: T.textMuted, fontSize: 9, marginTop: 1 }}>
              {batsman}
            </Text>
          ) : null}
        </View>

        {/* Score after */}
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: T.text, fontWeight: "800", fontSize: 12, fontVariant: ["tabular-nums"] }}>
            {item.scoreAfter}
          </Text>
          <Text style={{ color: T.textMuted, fontSize: 8, marginTop: 1 }}>
            Inn {item.innings}
          </Text>
        </View>
      </View>
    );
  };

  if (!timeline.length) {
    return (
      <View
        style={{
          alignItems: "center",
          paddingVertical: 40,
          marginHorizontal: 12,
          marginTop: 12,
          backgroundColor: T.card,
          borderWidth: 1,
          borderColor: T.border,
          borderRadius: 16,
        }}
      >
        <Text style={{ color: T.textDim, fontSize: 13 }}>No deliveries bowled yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={timeline}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      maxToRenderPerBatch={20}
      windowSize={7}
      ListHeaderComponent={
        <Text style={{ color: T.textDim, fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
          Ball-by-Ball ({timeline.length} deliveries)
        </Text>
      }
    />
  );
}

export { CricketEventTimelineMobile };

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@/constants/typography";
import { resolveTournamentTeamLogo } from "@/features/tournament/helpers";

const BG = "#0B1324";
const MUTED = "#94A3B8";
const TEXT = "#F8FAFC";
const SCORE = "#E2E8F0";

const formatMatchDateTime = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${dd}.${mm}.${yyyy}. • ${time}`;
  } catch {
    return null;
  }
};

const ballsToOversLabel = (balls) => {
  const n = Number(balls) || 0;
  return `${Math.floor(n / 6)}.${n % 6}`;
};

const inningsScoreForTeam = (sport, teamId) => {
  const innings = sport?.innings || [];
  const tid = String(teamId || "");
  const own = [...innings].reverse().find((inn) => String(inn?.battingTeamId || "") === tid);
  if (!own) return null;
  const runs = own.total_runs ?? own.runs ?? 0;
  const wickets = own.wickets ?? 0;
  const overs =
    own.overs != null
      ? String(own.overs)
      : own.balls_completed != null
        ? ballsToOversLabel(own.balls_completed)
        : null;
  return { runs, wickets, overs, label: `${runs}/${wickets}` };
};

const resolveStatusLabel = (base, sport, isFootball) => {
  const status = String(base?.status || "").toLowerCase();
  if (status === "completed" || status === "finished") return "Finished";
  if (status === "scheduled") return "Scheduled";
  if (status === "halftime" || sport?.matchStatus === "half_time") return "Half-time";
  if (sport?.matchStatus === "penalties") return "Penalties";
  if (sport?.matchStatus === "extra_time") return "Extra time";
  if (status === "live" || status === "in_progress") {
    if (isFootball) {
      const half = sport?.currentHalf || sport?.currentPeriod || 1;
      if (half === 1) return "1st half";
      if (half === 2) return "2nd half";
      if (half === 3) return "ET 1st";
      if (half === 4) return "ET 2nd";
      return "Live";
    }
    const inn = sport?.currentInnings || 1;
    return inn === 1 ? "1st innings" : inn === 2 ? "2nd innings" : `Innings ${inn}`;
  }
  return status ? status.replace(/_/g, " ") : "Match";
};

function TeamBlock({ name, logo, scoreLabel }) {
  const source = resolveTournamentTeamLogo(logo);
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "rgba(255,255,255,0.95)",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.2)",
        }}
      >
        {source ? (
          <ExpoImage
            source={source}
            style={{ width: 48, height: 48, borderRadius: 24 }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : (
          <Text style={{ color: "#0B1324", fontWeight: "900", fontSize: 18 }}>
            {(name || "T")[0]?.toUpperCase()}
          </Text>
        )}
      </View>
      <Text
        style={{
          color: TEXT,
          fontWeight: "700",
          fontSize: 13,
          marginTop: 8,
          textAlign: "center",
          maxWidth: 110,
        }}
        numberOfLines={2}
      >
        {name || "Team"}
      </Text>
      {scoreLabel ? (
        <Text
          style={{
            color: SCORE,
            fontWeight: "800",
            fontSize: 16,
            marginTop: 6,
            fontFamily: fonts.scoreDisplay,
          }}
        >
          {scoreLabel}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Match header for spectators (Watch flow).
 * Supports Football and Cricket.
 */
export default function SpectatorMatchHeader({
  game,
  teamMeta,
  onBack,
  topInset = 0,
}) {
  const base = game?.base || {};
  const sport = game?.sport || {};
  const sportName = String(base.sport || "").toLowerCase();
  const isFootball = sportName === "football";
  const isCricket = sportName === "cricket";

  const homeName =
    teamMeta?.home?.teamName
    || base.teamName
    || base.homeTeamName
    || "Home";
  const awayName =
    teamMeta?.away?.teamName
    || base.opponentTeamName
    || base.awayTeamName
    || "Away";
  const homeLogo =
    teamMeta?.home?.teamLogo
    || base.teamLogo
    || base.teamlogo
    || null;
  const awayLogo =
    teamMeta?.away?.teamLogo
    || base.opponentTeamLogo
    || base.opponentTeamlogo
    || null;
  const homeTeamId = base.teamId;
  const awayTeamId = base.opponentTeamId;

  const dateLabel = useMemo(
    () => formatMatchDateTime(base.startTime || base.scheduledAt || base.createdAt),
    [base.startTime, base.scheduledAt, base.createdAt],
  );

  const statusLabel = useMemo(
    () => resolveStatusLabel(base, sport, isFootball),
    [base, sport, isFootball],
  );

  const footballScore = {
    home: sport?.score?.home ?? 0,
    away: sport?.score?.away ?? 0,
  };

  const homeCricket = isCricket ? inningsScoreForTeam(sport, homeTeamId) : null;
  const awayCricket = isCricket ? inningsScoreForTeam(sport, awayTeamId) : null;

  const isFinished =
    ["completed", "finished"].includes(String(base?.status || "").toLowerCase())
    || String(sport?.matchStatus || "").toLowerCase() === "finished";
  const isLiveMatch =
    !isFinished
    && ["live", "in_progress", "halftime"].includes(String(base?.status || "").toLowerCase());
  const showDatePill = isFinished && !!dateLabel;

  return (
    <View style={{ backgroundColor: BG, paddingTop: topInset }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.1)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}

          <View style={{ flex: 1, alignItems: "center" }}>
            {showDatePill ? (
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.08)",
                }}
              >
                <Text style={{ color: TEXT, fontSize: 12, fontWeight: "600" }}>{dateLabel}</Text>
              </View>
            ) : null}
          </View>

          {isLiveMatch ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: "rgba(34,197,94,0.14)",
                borderWidth: 1,
                borderColor: "rgba(34,197,94,0.28)",
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ade80" }} />
              <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 }}>
                LIVE
              </Text>
            </View>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: showDatePill || isLiveMatch ? 14 : 10,
            paddingHorizontal: 4,
          }}
        >
          <TeamBlock name={homeName} logo={homeLogo} scoreLabel={isCricket ? homeCricket?.label : null} />

          <View style={{ alignItems: "center", minWidth: 100, paddingHorizontal: 6 }}>
            {isFootball ? (
              <Text
                style={{
                  fontFamily: fonts.scoreDisplay,
                  color: SCORE,
                  fontSize: 36,
                  lineHeight: 40,
                  fontWeight: "700",
                  letterSpacing: 1,
                }}
              >
                {footballScore.home} - {footballScore.away}
              </Text>
            ) : (
              <Text
                style={{
                  fontFamily: fonts.scoreDisplay,
                  color: SCORE,
                  fontSize: 28,
                  lineHeight: 32,
                  fontWeight: "700",
                }}
              >
                vs
              </Text>
            )}
            <Text
              style={{
                color: TEXT,
                fontSize: 13,
                fontWeight: "500",
                marginTop: 6,
                textTransform: "capitalize",
              }}
            >
              {statusLabel}
            </Text>
            {isFootball && sport?.result?.is_penalties ? (
              <Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                Pens {sport?.result?.penalties_score?.home ?? 0}-{sport?.result?.penalties_score?.away ?? 0}
              </Text>
            ) : null}
            {isCricket && (homeCricket?.overs || awayCricket?.overs) ? (
              <Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                {[homeCricket?.overs, awayCricket?.overs].filter(Boolean).join(" / ")} ov
              </Text>
            ) : null}
          </View>

          <TeamBlock name={awayName} logo={awayLogo} scoreLabel={isCricket ? awayCricket?.label : null} />
        </View>
      </View>
    </View>
  );
}

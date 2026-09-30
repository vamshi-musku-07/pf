import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusPill, TournamentTeamLogo, formatFixtureDateTime } from "@/features/tournament/helpers";
import {
  isByeFixture,
  getByeAdvancer,
  describeByeAdvancement,
  isKnockoutFixture,
} from "@/features/tournament/bracketConfig";

function ByeFixtureCard({ fixture, allFixtures = [] }) {
  const advancer = getByeAdvancer(fixture);
  const nextLabel = describeByeAdvancement(fixture, allFixtures);

  return (
    <View
      style={{
        backgroundColor: "#FAF5FF",
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#DDD6FE",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280", flex: 1, paddingRight: 8 }} numberOfLines={1}>
          {fixture.label}
        </Text>
        <StatusPill status="bye" />
      </View>

      {advancer ? (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <TournamentTeamLogo teamLogo={advancer.teamLogo} teamName={advancer.teamName} size={24} />
          <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: "#0B1324" }} numberOfLines={1}>
            {advancer.teamName}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="arrow-forward-circle-outline" size={16} color="#7C3AED" />
        <Text style={{ fontSize: 12, fontWeight: "600", color: "#6D28D9", flex: 1, lineHeight: 17 }}>
          BYE — advances to {nextLabel}
        </Text>
      </View>
    </View>
  );
}

export default function FixtureCard({
  fixture,
  isAdmin,
  onStart,
  onOpen,
  onEnterResult,
  onWatchLive,
  onSchedule,
  busy,
  totalOvers,
  allFixtures,
  variant,
}) {
  const isBracket = variant === "bracket" || isKnockoutFixture(fixture);

  if (isByeFixture(fixture)) {
    return <ByeFixtureCard fixture={fixture} allFixtures={allFixtures} />;
  }

  const done = fixture.status === "completed" || fixture.status === "bye";
  const isLive = fixture.gameStatus === "live" || fixture.gameStatus === "halftime" || fixture.status === "live";
  const hasGame = !!fixture.gameId;
  const winnerId = fixture.result?.winnerTeamId;
  const homeWon = winnerId && String(winnerId) === String(fixture.homeTeamId);
  const awayWon = winnerId && String(winnerId) === String(fixture.awayTeamId);
  const canPlay = fixture.homeTeamId && fixture.awayTeamId;
  const scheduledLabel = formatFixtureDateTime(fixture.scheduledAt);
  const homeIsBye = isBracket && !fixture.homeTeamId && !!fixture.awayTeamId;
  const awayIsBye = isBracket && !fixture.awayTeamId && !!fixture.homeTeamId;

  const teamRow = (name, source, logo, won, side, isByeSlot) => (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
      {won ? (
        <Ionicons name="checkmark-circle" size={16} color="#22C55E" style={{ marginRight: 6 }} />
      ) : (
        <View style={{ width: 22 }} />
      )}
      {isByeSlot ? (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: "#EDE9FE",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
          }}
        >
          <Ionicons name="remove" size={14} color="#7C3AED" />
        </View>
      ) : (
        <TournamentTeamLogo teamLogo={logo} teamName={name || source} size={24} />
      )}
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: won ? "700" : isByeSlot ? "600" : "500",
          color: isByeSlot ? "#7C3AED" : name || source ? "#111827" : "#9CA3AF",
          fontStyle: isByeSlot ? "italic" : "normal",
        }}
        numberOfLines={1}
      >
        {isByeSlot ? "BYE" : name || source || "TBD"}
      </Text>
      {done && side?.runs != null ? (
        <Text style={{ fontSize: 14, fontWeight: "700", color: "#374151" }}>
          {side.runs}/{side.wickets ?? 0}
        </Text>
      ) : null}
    </View>
  );

  const openMatch = () => {
    if (isAdmin && hasGame) onOpen(fixture);
    else onWatchLive(fixture);
  };

  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: isLive ? "#86EFAC" : "#E2E8F0",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280", flex: 1, paddingRight: 8 }} numberOfLines={1}>
          {fixture.label}
        </Text>
        <StatusPill status={isLive ? "live" : fixture.status} />
      </View>

      {!isBracket && (scheduledLabel || fixture.venue || totalOvers) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
          {scheduledLabel ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
              <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600" }}>{scheduledLabel}</Text>
            </View>
          ) : null}
          {fixture.venue ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="location-outline" size={12} color="#9CA3AF" />
              <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600" }} numberOfLines={1}>
                {fixture.venue}
              </Text>
            </View>
          ) : null}
          {totalOvers ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="time-outline" size={12} color="#9CA3AF" />
              <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600" }}>{totalOvers} overs</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {teamRow(fixture.homeTeamName, fixture.homeSource, fixture.homeTeamLogo, homeWon, fixture.result?.home, homeIsBye)}
      {teamRow(fixture.awayTeamName, fixture.awaySource, fixture.awayTeamLogo, awayWon, fixture.result?.away, awayIsBye)}

      {done && fixture.result?.margin ? (
        <Text style={{ fontSize: 12, color: "#15803D", fontWeight: "600", marginTop: 4, marginLeft: 28 }}>
          {fixture.result.margin}
        </Text>
      ) : null}

      {hasGame ? (
        <TouchableOpacity
          onPress={openMatch}
          style={{
            marginTop: 12,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isLive ? "#22C55E" : "#E5E7EB",
            alignItems: "center",
          }}
        >
          <Text style={{ color: isLive ? "#15803D" : "#374151", fontWeight: "700", fontSize: 13 }}>
            {isLive ? (isAdmin ? "Resume scoring" : "Watch live") : isAdmin ? "Resume scoring" : "View scorecard"}
          </Text>
        </TouchableOpacity>
      ) : null}

      {isAdmin && !done && !isLive && onSchedule ? (
        <TouchableOpacity
          onPress={() => onSchedule(fixture)}
          disabled={busy}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 12,
            paddingVertical: 9,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            minHeight: 40,
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#374151" />
          ) : (
            <>
              <Ionicons name="calendar-outline" size={14} color="#374151" />
              <Text style={{ color: "#374151", fontWeight: "700", fontSize: 13 }}>
                {fixture.scheduledAt ? "Reschedule" : "Schedule"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}

      {isAdmin && !done && canPlay ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: hasGame ? 8 : 12 }}>
          {!hasGame ? (
            <TouchableOpacity
              disabled={busy}
              onPress={() => onStart(fixture)}
              style={{
                flex: 1,
                backgroundColor: "#0B1324",
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 40,
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Start match</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => onOpen(fixture)}
              style={{ flex: 1, backgroundColor: "#BAF072", paddingVertical: 10, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#0B1324", fontWeight: "700", fontSize: 13 }}>Resume scoring</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            disabled={busy}
            onPress={() => onEnterResult(fixture)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 72,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#374151" />
            ) : (
              <Text style={{ color: "#374151", fontWeight: "700", fontSize: 13 }}>Result</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

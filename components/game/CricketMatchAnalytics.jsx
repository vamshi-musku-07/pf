import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import WormChart from "./charts/WormChart";
import ManhattanChart from "./charts/ManhattanChart";
import WagonWheel from "./charts/WagonWheel";
import PartnershipTimeline from "./charts/PartnershipTimeline";
import {
  buildWormSeries,
  buildManhattanData,
  buildWagonWheelZones,
  buildPartnershipTimeline,
  buildMatchPhaseStats,
  buildMatchInsights,
  buildPlayerNameMap,
} from "./hooks/cricketMatchAnalytics";
import { sanitizeGameEvents } from "@/lib/gameModel";

const toPlayerList = (players) => {
  if (Array.isArray(players)) return players;
  return [...(players?.home || []), ...(players?.away || [])];
};

function ChartCard({ title, icon, children }) {
  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Ionicons name={icon} size={14} color="#9AEA62" />
        <Text style={{ color: "#9CA3AF", fontWeight: "800", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function PhaseRow({ label, runs, wickets }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}>
      <Text style={{ color: "#D1D5DB", fontSize: 12, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: "#9AEA62", fontSize: 12, fontWeight: "700" }}>{runs}/{wickets}</Text>
    </View>
  );
}

export default function CricketMatchAnalytics({ currentGame, players = [], teamNames = {} }) {
  const sport = currentGame?.sport;
  const events = useMemo(
    () => sanitizeGameEvents(sport?.events),
    [sport?.events],
  );
  const inningsList = Array.isArray(sport?.innings) ? sport.innings : [];
  const inningsCount = Math.max(sport?.currentInnings || 1, inningsList.length || 1);
  const [selectedInnings, setSelectedInnings] = useState(
    sport?.currentInnings || inningsCount || 1,
  );

  const playerList = useMemo(() => toPlayerList(players), [players]);
  const nameMap = useMemo(() => buildPlayerNameMap(playerList), [playerList]);
  const totalOvers = sport?.totalOvers || 20;

  const analytics = useMemo(() => {
    const inn = selectedInnings;
    return {
      worm: buildWormSeries(events, inn, totalOvers),
      manhattan: buildManhattanData(events, inn),
      wagon: buildWagonWheelZones(events, inn),
      partnerships: buildPartnershipTimeline(events, inn, nameMap),
      phases: buildMatchPhaseStats(events, inn, totalOvers),
      insights: buildMatchInsights(sport, { teamNames, inningsNum: inn }),
    };
  }, [events, selectedInnings, totalOvers, sport, nameMap, teamNames]);

  const hasData = events.some((e) => (e?.innings || 1) === selectedInnings);

  if (!hasData) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
        <Ionicons name="analytics-outline" size={48} color="#4B5563" />
        <Text style={{ color: "#9CA3AF", fontWeight: "700", fontSize: 14, marginTop: 12, textAlign: "center" }}>
          Analytics unlock as the innings progresses
        </Text>
        <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 6, textAlign: "center" }}>
          Worm chart, Manhattan, wagon wheel and insights appear after the first deliveries.
        </Text>
      </View>
    );
  }

  const battingTeamName = (() => {
    const inn = inningsList.find((i) => i.inningsNumber === selectedInnings);
    const batId = String(inn?.battingTeamId || "");
    const homeId = String(currentGame?.base?.teamId || "");
    if (!batId) return `Innings ${selectedInnings}`;
    if (batId === homeId) return teamNames.home || "Home";
    return teamNames.away || "Away";
  })();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={{ color: "#9CA3AF", fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
        Match Analytics
      </Text>

      {inningsCount > 1 ? (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {[1, 2].slice(0, inningsCount).map((inn) => (
            <TouchableOpacity
              key={inn}
              onPress={() => setSelectedInnings(inn)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: selectedInnings === inn ? "rgba(154,234,98,0.15)" : "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: selectedInnings === inn ? "rgba(154,234,98,0.4)" : "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ color: selectedInnings === inn ? "#9AEA62" : "#9CA3AF", fontWeight: "800", fontSize: 12 }}>
                Innings {inn}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: 10, marginTop: 2 }} numberOfLines={1}>
                {inn === selectedInnings ? battingTeamName : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {analytics.insights.length > 0 ? (
        <ChartCard title="Match Insights" icon="bulb-outline">
          {analytics.insights.map((line, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: i < analytics.insights.length - 1 ? 8 : 0 }}>
              <Text style={{ color: "#9AEA62", fontSize: 12 }}>•</Text>
              <Text style={{ color: "#E5E7EB", fontSize: 12, flex: 1, lineHeight: 18 }}>{line}</Text>
            </View>
          ))}
        </ChartCard>
      ) : null}

      <ChartCard title="Worm Chart" icon="trending-up-outline">
        <WormChart data={analytics.worm} totalOvers={totalOvers} />
      </ChartCard>

      <ChartCard title="Manhattan" icon="bar-chart-outline">
        <ManhattanChart data={analytics.manhattan} />
      </ChartCard>

      <ChartCard title="Wagon Wheel" icon="radio-button-on-outline">
        <WagonWheel zones={analytics.wagon} />
        <Text style={{ color: "#6B7280", fontSize: 10, textAlign: "center", marginTop: 8 }}>
          Scoring zones (off / straight / leg)
        </Text>
      </ChartCard>

      <ChartCard title="Partnerships" icon="people-outline">
        <PartnershipTimeline partnerships={analytics.partnerships} />
      </ChartCard>

      <ChartCard title="Phase Breakdown" icon="time-outline">
        <PhaseRow label={analytics.phases.powerplay.label} runs={analytics.phases.powerplay.runs} wickets={analytics.phases.powerplay.wickets} />
        {analytics.phases.middle.overs > 0 ? (
          <PhaseRow label={analytics.phases.middle.label} runs={analytics.phases.middle.runs} wickets={analytics.phases.middle.wickets} />
        ) : null}
        <PhaseRow label={analytics.phases.death.label} runs={analytics.phases.death.runs} wickets={analytics.phases.death.wickets} />
      </ChartCard>
    </ScrollView>
  );
}

import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

const EVENT_CONFIG = {
  point: { label: "Point", icon: "●", color: "#16a34a" },
  serve_ace: { label: "Ace", icon: "A", color: "#eab308" },
  service_ace: { label: "Ace", icon: "A", color: "#eab308" },
  attack_kill: { label: "Kill", icon: "K", color: "#f97316" },
  kill: { label: "Kill", icon: "K", color: "#f97316" },
  block_point: { label: "Block", icon: "B", color: "#2563eb" },
  serve_error: { label: "Serve Err", icon: "SE", color: "#dc2626" },
  attack_error: { label: "Att Err", icon: "AE", color: "#dc2626" },
  fault: { label: "Fault", icon: "F", color: "#ef4444" },
  timeout: { label: "Timeout", icon: "T", color: "#ca8a04" },
  substitution: { label: "Sub", icon: "↔", color: "#4f46e5" },
  challenge: { label: "Challenge", icon: "?", color: "#7c3aed" },
  challenge_won: { label: "Challenge Won", icon: "✓", color: "#16a34a" },
  challenge_lost: { label: "Challenge Lost", icon: "✗", color: "#dc2626" },
  rotation: { label: "Rotation", icon: "↻", color: "#6B7280" },
  side_out: { label: "Side Out", icon: "SO", color: "#9333ea" },
};

function VolleyballTimeline({
  events = [],
  homeTeamId = "",
  teamNames = { home: "Home", away: "Away" },
  currentSet = 1,
  filterSet = null,
}) {
  const filteredEvents = useMemo(() => {
    let evts = (events || []).filter(Boolean);
    if (filterSet != null) {
      evts = evts.filter((e) => Number(e.setNumber) === Number(filterSet));
    }
    return evts.slice().reverse(); // newest first
  }, [events, filterSet]);

  if (filteredEvents.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: "center" }}>
        <Text style={{ color: "#6B7280", fontSize: 12, fontStyle: "italic" }}>
          No events yet
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 2 }}>
      {filteredEvents.map((event, idx) => {
        const cfg = EVENT_CONFIG[event.eventType] || { label: event.eventType, icon: "•", color: "#4B5563" };
        const isHome = String(event.teamId) === String(homeTeamId);
        const teamLabel = isHome ? teamNames.home : teamNames.away;
        const playerName = event.playerName || "Team";
        const scoreAfter = event.homeScoreAfter != null
          ? `${event.homeScoreAfter}-${event.awayScoreAfter}`
          : null;

        return (
          <View
            key={idx}
            style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              paddingVertical: 8, paddingHorizontal: 10,
              backgroundColor: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
              borderRadius: 6,
            }}
          >
            {/* Badge */}
            <View style={{
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: cfg.color, alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{cfg.icon}</Text>
            </View>

            {/* Details */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{cfg.label}</Text>
                <Text style={{ color: isHome ? "#4ade80" : "#f87171", fontSize: 10, fontWeight: "600" }}>
                  {teamLabel}
                </Text>
              </View>
              <Text style={{ color: "#6B7280", fontSize: 10 }} numberOfLines={1}>
                {playerName} · Set {event.setNumber || currentSet}
              </Text>
            </View>

            {/* Score */}
            {scoreAfter && (
              <View style={{
                backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
              }}>
                <Text style={{ color: "#D1D5DB", fontSize: 11, fontWeight: "700" }}>{scoreAfter}</Text>
              </View>
            )}

            {/* Timestamp */}
            <Text style={{ color: "#4B5563", fontSize: 9 }}>
              {event.timestamp ? new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default VolleyballTimeline;

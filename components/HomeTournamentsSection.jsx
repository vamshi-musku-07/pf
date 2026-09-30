import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getPublicTournamentFeedAPI } from "@/services/TournamentApi";
import { useBackendAuth } from "@/context/BackendAuthContext";
import {
  describeLiveMatch,
  tournamentListSubtitle,
  resolveTournamentRoute,
} from "@/features/tournament/publicConfig";

function FeedCard({ item, onPress, live }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        width: 220,
        backgroundColor: "#fff",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: live ? "#86EFAC" : "#E2E8F0",
        padding: 14,
        marginRight: 12,
      }}
    >
      {live ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#DC2626" }} />
          <Text style={{ color: "#DC2626", fontSize: 11, fontWeight: "800" }}>LIVE</Text>
        </View>
      ) : null}
      <Text style={{ fontSize: 15, fontWeight: "800", color: "#0B1324" }} numberOfLines={2}>
        {item.name || describeLiveMatch(item)}
      </Text>
      <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 6, lineHeight: 16 }} numberOfLines={2}>
        {item.subtitle || tournamentListSubtitle(item)}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeTournamentsSection() {
  const router = useRouter();
  const { isSignedIn } = useBackendAuth();
  const [feed, setFeed] = useState({ tournaments: [], liveMatches: [] });
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    try {
      const res = await getPublicTournamentFeedAPI({ sport: "Cricket", limit: 10 });
      const payload = res?.data || res || {};
      setFeed({
        tournaments: payload.tournaments || [],
        liveMatches: payload.liveMatches || [],
      });
    } catch {
      setFeed({ tournaments: [], liveMatches: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const openTournament = (item) => {
    const route = resolveTournamentRoute(item, { backTo: "/(tabs)", isSignedIn });
    if (route) router.push(route);
  };

  const tournaments = feed.tournaments || [];
  const liveMatches = feed.liveMatches || [];
  if (loading || (!tournaments.length && !liveMatches.length)) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#0B1324" }}>Tournaments</Text>
          <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Live leagues and public standings</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/tournament", params: { backTo: "/(tabs)", tab: "browse" } })}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Text style={{ color: "#2563EB", fontWeight: "700", fontSize: 13 }}>Browse</Text>
          <Ionicons name="chevron-forward" size={14} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {liveMatches.length > 0 ? (
        <>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 8 }}>Live now</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {liveMatches.map((match) => (
              <FeedCard
                key={match._id}
                item={{
                  name: match.label,
                  subtitle: describeLiveMatch(match),
                  shareCode: match.tournamentId,
                  _id: match.tournamentId,
                }}
                live
                onPress={() => openTournament({ _id: match.tournamentId, shareCode: match.tournamentId })}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {tournaments.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tournaments.map((t) => (
            <FeedCard key={t._id} item={t} onPress={() => openTournament(t)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

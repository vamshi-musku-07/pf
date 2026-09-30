import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBackendAuth } from "@/context/BackendAuthContext";
import {
  assignChessPuzzleAPI,
  getAssignedChessPuzzlesAPI,
  getChessPuzzlesByTeamAPI,
} from "@/services/GameApi";
import { getPlayersByTeamAPI } from "@/services/PlayerApi";

const getListFromResponse = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.puzzles)) return payload.puzzles;
  if (Array.isArray(payload?.data?.puzzles)) return payload.data.puzzles;
  return [];
};

const PuzzleCard = ({ item, actionLabel, onAction, disabled }) => {
  const difficulty = String(item?.difficulty || "medium");
  const themes = Array.isArray(item?.themes) ? item.themes.slice(0, 3) : [];
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 12,
        backgroundColor: "#121A2C",
        borderWidth: 1,
        borderColor: "rgba(148,163,184,0.18)",
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: "#E2E8F0", fontSize: 15, fontWeight: "700", flex: 1 }} numberOfLines={1}>
          {item?.title || "Chess Puzzle"}
        </Text>
        <Text style={{ color: "#94A3B8", fontSize: 12, textTransform: "capitalize" }}>{difficulty}</Text>
      </View>
      <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 6 }} numberOfLines={2}>
        {item?.description || "Practice tactical patterns with this position."}
      </Text>
      {!!themes.length && (
        <Text style={{ color: "#60A5FA", fontSize: 12, marginTop: 6 }}>
          {themes.join(" • ")}
        </Text>
      )}
      {!!actionLabel && (
        <TouchableOpacity
          onPress={onAction}
          disabled={disabled}
          style={{
            marginTop: 10,
            borderRadius: 10,
            paddingVertical: 10,
            alignItems: "center",
            backgroundColor: "#9AEA62",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Text style={{ color: "#081126", fontSize: 13, fontWeight: "800" }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function ChessPuzzlesScreen() {
  const router = useRouter();
  const { teamId: teamIdParam } = useLocalSearchParams();
  const { backendUser } = useBackendAuth();
  const userId = String(backendUser?.id || backendUser?._id || backendUser?.userId || "");
  const teamId = String(teamIdParam || "");

  const [tab, setTab] = useState("assigned");
  const [loading, setLoading] = useState(true);
  const [assigningPuzzleId, setAssigningPuzzleId] = useState(null);
  const [assigned, setAssigned] = useState([]);
  const [teamPuzzles, setTeamPuzzles] = useState([]);
  const [teamPlayers, setTeamPlayers] = useState([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [assignedRes, teamRes, playersRes] = await Promise.allSettled([
        getAssignedChessPuzzlesAPI(userId, { limit: 50 }),
        teamId ? getChessPuzzlesByTeamAPI(teamId, { limit: 50 }) : Promise.resolve([]),
        teamId ? getPlayersByTeamAPI(teamId) : Promise.resolve([]),
      ]);

      if (assignedRes.status === "fulfilled") {
        setAssigned(getListFromResponse(assignedRes.value));
      }
      if (teamRes.status === "fulfilled") {
        setTeamPuzzles(getListFromResponse(teamRes.value));
      }
      if (playersRes.status === "fulfilled") {
        const payload = playersRes.value;
        const players =
          payload?.data?.players ||
          payload?.players ||
          payload?.data ||
          [];
        setTeamPlayers(Array.isArray(players) ? players : []);
      }
    } finally {
      setLoading(false);
    }
  }, [teamId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const defaultAssignee = useMemo(() => {
    if (!teamPlayers.length) return null;
    return teamPlayers.find((p) => String(p.userId || p._id || p.id)) || teamPlayers[0];
  }, [teamPlayers]);

  const assignToDefaultPlayer = useCallback(async (puzzle) => {
    if (!teamId || !defaultAssignee) {
      Alert.alert("No player found", "Add players to the team before assigning puzzles.");
      return;
    }
    const playerId = String(defaultAssignee.userId || defaultAssignee._id || defaultAssignee.id || "");
    if (!playerId) {
      Alert.alert("Invalid player", "Couldn't resolve a valid player ID for assignment.");
      return;
    }
    setAssigningPuzzleId(String(puzzle?._id || ""));
    try {
      await assignChessPuzzleAPI(String(puzzle?._id), [{ playerId, teamId }], null);
      Alert.alert("Puzzle assigned", `Assigned to ${defaultAssignee.firstName || defaultAssignee.name || "player"}.`);
      refresh();
    } catch (err) {
      Alert.alert("Assignment failed", err?.response?.data?.message || "Could not assign this puzzle.");
    } finally {
      setAssigningPuzzleId(null);
    }
  }, [defaultAssignee, teamId, refresh]);

  const data = tab === "assigned" ? assigned : teamPuzzles;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#081126" }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.1)",
            marginRight: 12,
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#E2E8F0" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#E2E8F0", fontSize: 18, fontWeight: "900" }}>Chess Puzzles</Text>
          <Text style={{ color: "#94A3B8", fontSize: 12 }}>
            Practice tactics and assign drills to your team.
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
        {[
          { key: "assigned", label: "Assigned To Me" },
          { key: "team", label: "Team Puzzles" },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => setTab(item.key)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: tab === item.key ? "rgba(154,234,98,0.22)" : "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: tab === item.key ? "rgba(154,234,98,0.4)" : "rgba(148,163,184,0.2)",
            }}
          >
            <Text style={{ color: tab === item.key ? "#BAF072" : "#CBD5E1", fontWeight: "700", fontSize: 12 }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
          <ActivityIndicator size="large" color="#9AEA62" />
          <Text style={{ color: "#94A3B8" }}>Loading puzzles...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
          data={data}
          keyExtractor={(item, idx) => String(item?._id || item?.id || idx)}
          renderItem={({ item }) => (
            <PuzzleCard
              item={item}
              actionLabel={tab === "team" ? "Assign to a Team Player" : null}
              onAction={() => assignToDefaultPlayer(item)}
              disabled={assigningPuzzleId === String(item?._id || "")}
            />
          )}
          ListEmptyComponent={(
            <View style={{ marginTop: 30, alignItems: "center" }}>
              <Text style={{ color: "#94A3B8", textAlign: "center" }}>
                {tab === "assigned"
                  ? "No assigned puzzles yet."
                  : "No team puzzles found for this team."}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

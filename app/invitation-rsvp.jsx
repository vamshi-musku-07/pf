import { Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { acceptInvitationAPI } from "@/services/PlayerApi";
import { navigateToTeamOrTournament } from "@/lib/openTeamInvitation";
import { goBackTo } from "@/lib/navigationBack";

const sportColors = {
  Football: "#2382F2",
  Basketball: "#FF6518",
  Cricket: "#9AEA62",
  Baseball: "#E51733",
  Volleyball: "#2382F2",
  Tennis: "#D7FF38",
  "Table Tennis": "#FF6518",
  Badminton: "#DE9444",
  Rugby: "#DE9444",
  Hockey: "#5B7180",
  Pickleball: "#9AEA62",
  Chess: "#8B6914",
};

const sportIcons = {
  Football: "football",
  Basketball: "basketball",
  Cricket: "tennisball",
  Tennis: "tennisball",
  default: "trophy",
};

export default function InvitationRsvp() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [accepting, setAccepting] = useState(false);

  const {
    invitationId,
    invitationToken,
    email,
    teamName,
    teamId,
    sport,
    season,
    location,
    playerRole,
    playerName,
    playerPosition,
    playerJerseyNumber,
    expiresAt,
    isAccepted,
  } = params;

  const color = sportColors[sport] || "#9AEA62";
  const icon = sportIcons[sport] || sportIcons.default;
  const accepted = isAccepted === "true";

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  const handleAccept = async () => {
    if (!invitationToken || !email) {
      Alert.alert("Error", "Invalid invitation — token or email missing.");
      return;
    }
    setAccepting(true);
    try {
      const result = await acceptInvitationAPI(invitationToken, email);
      const joinedTeamId = result?.data?.teamId;
      if (joinedTeamId) {
        await navigateToTeamOrTournament(router, joinedTeamId, "/(tabs)/teams");
      } else {
        // Fallback if teamId not in response
        router.replace("/(tabs)/teams");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to accept invitation";
      Alert.alert("Error", msg);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
        <TouchableOpacity onPress={() => goBackTo(router)} style={{ marginRight: 12, padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>Team Invitation</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Sport + Team Card */}
        <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: color + "22", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Ionicons name={icon} size={36} color={color} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {teamName}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <View style={{ backgroundColor: color + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
              <Text style={{ color, fontWeight: "700", fontSize: 12 }}>{sport}</Text>
            </View>
            {season && (
              <View style={{ backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                <Text style={{ color: "#6B7280", fontWeight: "600", fontSize: 12 }}>{season}</Text>
              </View>
            )}
          </View>
          {location && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
              <Feather name="map-pin" size={13} color="#9CA3AF" />
              <Text style={{ color: "#6B7280", fontSize: 13 }}>{location}</Text>
            </View>
          )}
        </View>

        {/* Your Role */}
        <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Your Details</Text>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="user" size={15} color="#6B7280" />
                <Text style={{ color: "#6B7280", fontSize: 14 }}>Name</Text>
              </View>
              <Text style={{ color: "#111827", fontWeight: "700", fontSize: 14 }}>{playerName || "—"}</Text>
            </View>

            <View style={{ height: 1, backgroundColor: "#F3F4F6" }} />

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="shield" size={15} color="#6B7280" />
                <Text style={{ color: "#6B7280", fontSize: 14 }}>Role</Text>
              </View>
              <View style={{ backgroundColor: playerRole === "manager" ? "#EDE9FE" : "#DCFCE7", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
                <Text style={{ color: playerRole === "manager" ? "#7C3AED" : "#16A34A", fontWeight: "700", fontSize: 13, textTransform: "capitalize" }}>
                  {playerRole || "Player"}
                </Text>
              </View>
            </View>

            {playerPosition && (
              <>
                <View style={{ height: 1, backgroundColor: "#F3F4F6" }} />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="target" size={15} color="#6B7280" />
                    <Text style={{ color: "#6B7280", fontSize: 14 }}>Position</Text>
                  </View>
                  <Text style={{ color: "#111827", fontWeight: "700", fontSize: 14 }}>{playerPosition}</Text>
                </View>
              </>
            )}

            {playerJerseyNumber && (
              <>
                <View style={{ height: 1, backgroundColor: "#F3F4F6" }} />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="hash" size={15} color="#6B7280" />
                    <Text style={{ color: "#6B7280", fontSize: 14 }}>Jersey #</Text>
                  </View>
                  <Text style={{ color: "#111827", fontWeight: "700", fontSize: 14 }}>#{playerJerseyNumber}</Text>
                </View>
              </>
            )}

            {expiresAt && (
              <>
                <View style={{ height: 1, backgroundColor: "#F3F4F6" }} />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="clock" size={15} color="#6B7280" />
                    <Text style={{ color: "#6B7280", fontSize: 14 }}>Expires</Text>
                  </View>
                  <Text style={{ color: new Date(expiresAt) > new Date() ? "#F59E0B" : "#EF4444", fontWeight: "600", fontSize: 13 }}>
                    {formatDate(expiresAt)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Status / Action */}
        {accepted ? (
          <View style={{ backgroundColor: "#F0FDF4", borderRadius: 16, padding: 20, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#BBF7D0" }}>
            <Ionicons name="checkmark-circle" size={32} color="#16A34A" />
            <Text style={{ color: "#16A34A", fontWeight: "800", fontSize: 16 }}>Already Accepted</Text>
            <Text style={{ color: "#4B5563", fontSize: 13, textAlign: "center" }}>You're already a member of this team.</Text>
            <TouchableOpacity
              onPress={() => {
                if (teamId) {
                  router.replace({ pathname: `/team/${teamId}`, params: { initialTab: "AVAILABILITY" } });
                } else {
                  router.replace("/(tabs)/teams");
                }
              }}
              style={{ marginTop: 8, backgroundColor: "#081126", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
              <Text style={{ color: "#9AEA62", fontWeight: "700", fontSize: 14 }}>Go to Team Dashboard →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleAccept}
            disabled={accepting}
            style={{ backgroundColor: "#111827", borderRadius: 16, paddingVertical: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, opacity: accepting ? 0.7 : 1 }}>
            {accepting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="checkmark-circle" size={20} color="#9AEA62" />
            )}
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
              {accepting ? "Joining team…" : "Accept Invitation"}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => goBackTo(router)}
          style={{ marginTop: 12, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#9CA3AF", fontWeight: "600", fontSize: 14 }}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

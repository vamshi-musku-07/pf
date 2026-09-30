import React, { useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBackTo } from "@/lib/navigationBack";
import TournamentInviteSheet from "@/components/tournament/TournamentInviteSheet";

export default function TournamentInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const inviteId = Array.isArray(params.inviteId) ? params.inviteId[0] : params.inviteId;
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;

  const [open, setOpen] = useState(true);

  if (!inviteId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F0F4F8" }}>
        <ActivityIndicator size="large" color="#0B1324" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F4F8" }}>
      <TournamentInviteSheet
        visible={open}
        inviteId={inviteId}
        backTo={backTo || "/(tabs)/invitations"}
        onClose={() => {
          setOpen(false);
          goBackTo(router, backTo, "/(tabs)/invitations");
        }}
        onAccepted={() => {
          // Sheet shows success state; user can tap View Tournament
        }}
      />
    </View>
  );
}

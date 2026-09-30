import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { getBackToParam, goBackTo, BACK_TO_PROFILE } from "@/lib/navigationBack";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

const SUPPORT_EMAIL = "vamshireddy19421@gmail.com";

const DELETED_ITEMS = [
  "Your PlayFlash profile — name, email, phone, location, age, and profile photo",
  "Teams you created, including rosters, schedules, games, posts, and team chat for those teams",
  "TriCount groups you created",
  "Links from your account to other teams, availability, assignments, and player records you joined",
  "Your in-app reviews and support tickets",
  "Push notification tokens registered for your devices",
];

const KEPT_ITEMS = [
  "If you joined other people's teams, your name and stats on those rosters may remain, but your login will no longer be linked to them",
  "Team chat messages you sent on other teams may remain in the thread but are no longer tied to your account name",
  "Content other members uploaded to shared team spaces you did not create may remain visible to those teams",
];

const DeleteAccountScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const backTo = getBackToParam(params);
  const insets = useSafeAreaInsets();
  const { deleteAccount } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const closeConfirmModal = () => {
    if (loading) return;
    setShowConfirmModal(false);
  };

  const handleFinalDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteAccount();
      if (!result.ok) {
        Alert.alert("Could not delete account", result.message || "Please try again.");
        return;
      }
      setShowConfirmModal(false);
      router.replace("/(auth)/welcome");
    } catch (error) {
      Alert.alert(
        "Could not delete account",
        error?.response?.data?.message || error?.message || "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={["top"]}>
      <StatusBar barStyle={T.statusBar} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: T.border,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackTo(router, backTo, BACK_TO_PROFILE)}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color="#2563EB" />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 17,
            fontWeight: "600",
            color: T.text,
            marginRight: 24,
          }}
        >
          Delete Account
        </Text>
      </View>

      <ScrollView
        style={{ backgroundColor: T.bg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: "700",
            color: T.text,
            marginBottom: 12,
            fontFamily: "BebasNeue_400Regular",
          }}
        >
          Delete Your Account
        </Text>

        <Text style={{ fontSize: 15, lineHeight: 22, color: T.textDim, marginBottom: 20 }}>
          We're sorry to see you go. We hope you've enjoyed PlayFlash, and we'd love to
          have you back when the time is right.
        </Text>

        <Text style={{ fontSize: 15, lineHeight: 22, color: T.textDim, marginBottom: 24 }}>
          Deleting your account is permanent. Your personal login and profile data will
          be removed from PlayFlash, along with every team you created. Content on teams
          you only joined (not created) may remain without being linked to your account.
        </Text>

        <Text style={{ fontSize: 18, fontWeight: "700", color: T.text, marginBottom: 10 }}>
          What gets deleted
        </Text>
        {DELETED_ITEMS.map((item) => (
          <View key={item} style={{ flexDirection: "row", marginBottom: 10 }}>
            <Text style={{ color: T.text, marginRight: 8 }}>{"\u2022"}</Text>
            <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: T.textDim }}>
              {item}
            </Text>
          </View>
        ))}

        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: T.text,
            marginTop: 20,
            marginBottom: 10,
          }}
        >
          What doesn't get deleted
        </Text>
        {KEPT_ITEMS.map((item) => (
          <View key={item} style={{ flexDirection: "row", marginBottom: 10 }}>
            <Text style={{ color: T.text, marginRight: 8 }}>{"\u2022"}</Text>
            <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: T.textDim }}>
              {item}
            </Text>
          </View>
        ))}

        <Text style={{ fontSize: 14, lineHeight: 21, color: T.textMuted, marginTop: 16 }}>
          Questions? Email us at{" "}
          <Text
            style={{ color: "#2563EB" }}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          >
            {SUPPORT_EMAIL}
          </Text>
          .
        </Text>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 20,
          paddingBottom: Math.max(insets.bottom, 20),
          backgroundColor: T.surface,
          borderTopWidth: 1,
          borderTopColor: T.border,
        }}
      >
        <TouchableOpacity
          onPress={() => setShowConfirmModal(true)}
          style={{
            backgroundColor: T.dangerBg,
            borderRadius: 999,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: T.dangerText, fontSize: 16, fontWeight: "700" }}>
            Delete Account
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={closeConfirmModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: T.overlay,
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={closeConfirmModal}
            disabled={loading}
          />

          <View
            style={{
              backgroundColor: T.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 24),
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: T.border,
                marginBottom: 20,
              }}
            />

            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: T.text,
                marginBottom: 10,
                textAlign: "center",
              }}
            >
              Delete your account?
            </Text>

            <Text
              style={{
                fontSize: 15,
                lineHeight: 22,
                color: T.textMuted,
                textAlign: "center",
                marginBottom: 28,
              }}
            >
              This action is permanent and cannot be undone. Your profile and personal
              data will be removed from PlayFlash.
            </Text>

            <TouchableOpacity
              onPress={handleFinalDelete}
              disabled={loading}
              style={{
                backgroundColor: T.dangerBg,
                borderRadius: 999,
                paddingVertical: 16,
                alignItems: "center",
                opacity: loading ? 0.7 : 1,
                marginBottom: 12,
              }}
            >
              {loading ? (
                <ActivityIndicator color={T.dangerText} />
              ) : (
                <Text style={{ color: T.dangerText, fontSize: 16, fontWeight: "700" }}>
                  Delete Account
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={closeConfirmModal}
              disabled={loading}
              style={{ paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#2563EB", fontSize: 16, fontWeight: "600" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default DeleteAccountScreen;

import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackTo, getBackToParam, BACK_TO_PROFILE } from "@/lib/navigationBack";
import { showToast } from "@/context/ToastContext";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

const SATISFACTION_OPTIONS = [
  { value: 1, label: "Very dissatisfied" },
  { value: 2, label: "Somewhat dissatisfied" },
  { value: 3, label: "Neither satisfied nor dissatisfied" },
  { value: 4, label: "Somewhat satisfied" },
  { value: 5, label: "Very satisfied" },
];

export default function ShareFeedback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const backTo = getBackToParam(params) || BACK_TO_PROFILE;
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);

  const [rating, setRating] = useState(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const goBack = () => goBackTo(router, backTo, BACK_TO_PROFILE);

  const handleSubmit = async () => {
    if (!rating) {
      showToast?.("Please select a rating", "error");
      return;
    }
    setSubmitting(true);
    try {
      // Feedback is captured client-side for now; wire to a backend when available.
      setShowThankYou(true);
    } finally {
      setSubmitting(false);
    }
  };

  const finishFeedback = () => {
    setShowThankYou(false);
    showToast?.("Thanks for your feedback!", "success");
    goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar} />
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: T.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={goBack} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "700", color: T.text }}>
            Share Feedback
          </Text>
        </View>
        <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "800",
              letterSpacing: 0.5,
              color: rating ? "#16A34A" : T.textMuted,
            }}
          >
            SUBMIT
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: T.bg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: T.text,
            marginBottom: 24,
          }}
        >
          How dissatisfied or satisfied are you with this feature?
        </Text>

        {SATISFACTION_OPTIONS.map((opt) => {
          const selected = rating === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setRating(opt.value)}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  color: T.text,
                  flex: 1,
                  marginRight: 12,
                }}
              >
                {opt.label}
              </Text>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: selected ? "#16A34A" : T.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selected ? (
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: "#16A34A",
                    }}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ marginTop: 28 }}>
          <Text
            style={{ fontSize: 15, fontWeight: "700", color: T.text }}
          >
            Additional Comments
          </Text>
          <TextInput
            value={comments}
            onChangeText={setComments}
            placeholder="What's helpful? Not helpful?"
            placeholderTextColor={T.textMuted}
            multiline
            style={{
              marginTop: 10,
              minHeight: 100,
              borderWidth: 1,
              borderColor: T.inputBorder,
              borderRadius: 12,
              padding: 14,
              fontSize: 14,
              color: T.text,
              backgroundColor: T.inputBg,
              textAlignVertical: "top",
            }}
          />
        </View>
      </ScrollView>

      {/* Thank you dialog */}
      <Modal visible={showThankYou} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: T.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 360,
              backgroundColor: T.surface,
              borderRadius: 16,
              padding: 22,
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: "800", color: T.text }}
            >
              Thank you
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: T.textDim,
                marginTop: 8,
                lineHeight: 22,
              }}
            >
              Would you like to be contacted for more feedback in the future?
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 28,
                marginTop: 24,
              }}
            >
              <TouchableOpacity onPress={finishFeedback}>
                <Text
                  style={{ fontSize: 15, fontWeight: "800", color: "#16A34A" }}
                >
                  No
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={finishFeedback}>
                <Text
                  style={{ fontSize: 15, fontWeight: "800", color: "#16A34A" }}
                >
                  Yes
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

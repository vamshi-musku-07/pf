import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCommunityPostTheme } from "@/lib/communityPostTheme";

export const HIDE_REASONS = [
  {
    id: "not_useful",
    label: "I don't find this post useful or motivating",
  },
  {
    id: "not_interested_sport",
    label: "I'm not interested in this sport",
  },
  {
    id: "not_interested_athlete",
    label: "I'm not interested in this player",
  },
  {
    id: "none",
    label: "None of the above",
  },
];

/**
 * Bottom sheets for other people's posts:
 * 1) Follow / Unfollow + Hide this activity
 * 2) Hide reason picker
 */
export default function PostOptionsSheet({
  visible,
  post,
  isFollowing = false,
  followBusy = false,
  hideBusy = false,
  onClose,
  onToggleFollow,
  onHideWithReason,
}) {
  const insets = useSafeAreaInsets();
  const T = useCommunityPostTheme();
  const [step, setStep] = useState("options"); // options | hide

  useEffect(() => {
    if (visible) setStep("options");
  }, [visible, post?._id]);

  const authorName = useMemo(() => {
    const raw = String(post?.authorName || "player").trim();
    return raw || "player";
  }, [post?.authorName]);

  const sheetBg = T.menuBg || T.surface;
  const divider = T.border;
  const titleColor = T.text;
  const mutedColor = T.muted;
  const rowPad = 18;

  if (!visible || !post) return null;

  const Divider = () => (
    <View style={{ height: 1, backgroundColor: divider, width: "100%" }} />
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={{ flex: 1, backgroundColor: T.overlay }}
          onPress={onClose}
        />

        <View
          style={{
            backgroundColor: sheetBg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: 1,
            borderColor: divider,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: T.borderStrong || divider,
              marginTop: 10,
              marginBottom: 14,
              opacity: 0.9,
            }}
          />

          {step === "options" ? (
            <>
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 17,
                  fontWeight: "700",
                  color: titleColor,
                  marginBottom: 14,
                  paddingHorizontal: 20,
                }}
              >
                Follow Options
              </Text>

              <Divider />

              <TouchableOpacity
                onPress={onToggleFollow}
                disabled={followBusy}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 22,
                  paddingVertical: rowPad,
                  opacity: followBusy ? 0.55 : 1,
                }}
              >
                {followBusy ? (
                  <ActivityIndicator color={T.green} />
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "500",
                      color: titleColor,
                    }}
                  >
                    {isFollowing ? `Unfollow ${authorName}` : `Follow ${authorName}`}
                  </Text>
                )}
              </TouchableOpacity>

              <Divider />

              <TouchableOpacity
                onPress={() => setStep("hide")}
                activeOpacity={0.7}
                style={{ paddingHorizontal: 22, paddingVertical: rowPad }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "500",
                    color: titleColor,
                  }}
                >
                  Hide this activity
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 17,
                  fontWeight: "700",
                  color: titleColor,
                  paddingHorizontal: 24,
                }}
              >
                Hide this activity
              </Text>
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  color: mutedColor,
                  marginTop: 8,
                  marginBottom: 16,
                  paddingHorizontal: 28,
                  lineHeight: 18,
                }}
              >
                We'll show you less content like this in the future
              </Text>

              <Divider />

              {HIDE_REASONS.map((reason) => (
                <View key={reason.id}>
                  <TouchableOpacity
                    onPress={() => onHideWithReason?.(reason.id)}
                    disabled={hideBusy}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 22,
                      paddingVertical: rowPad,
                      opacity: hideBusy ? 0.55 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: titleColor,
                        lineHeight: 22,
                      }}
                    >
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                  <Divider />
                </View>
              ))}

              <TouchableOpacity
                onPress={onClose}
                disabled={hideBusy}
                activeOpacity={0.7}
                style={{ paddingHorizontal: 22, paddingVertical: rowPad }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: mutedColor,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

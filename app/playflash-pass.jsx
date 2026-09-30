import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { goBackTo, BACK_TO_PROFILE } from "@/lib/navigationBack";
import { showToast } from "@/context/ToastContext";

const { width: SCREEN_W } = Dimensions.get("window");

const BENEFITS = [
  {
    key: "ai",
    title: "AI COMMENTARY IN YOUR PREFERRED LANGUAGE",
    description:
      "Get live AI match commentary in the language you choose — stay immersed in every play.",
    icon: require("../assets/images/pass-benefit-ai-3d-v2.png"),
  },
  {
    key: "stream",
    title: "STREAM LIVE",
    description:
      "Broadcast and watch live games in high quality. Share the action with your team and fans.",
    icon: require("../assets/images/pass-benefit-stream-3d-v2.png"),
  },
  {
    key: "stats",
    title: "ADVANCED MATCH STATS & INSIGHTS",
    description:
      "Unlock deeper player analytics, performance trends, and post-match insights for every game.",
    icon: require("../assets/images/pass-benefit-stats-3d-v2.png"),
  },
  {
    key: "vip",
    title: "PRIORITY ACCESS & AD-FREE EXPERIENCE",
    description:
      "Skip the wait with priority features and enjoy Playflash without interruptions.",
    icon: require("../assets/images/pass-benefit-vip-3d-v2.png"),
  },
];

function VerticalRays() {
  const rays = Array.from({ length: 14 }, (_, i) => i);
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 420,
        flexDirection: "row",
        justifyContent: "space-evenly",
        opacity: 0.18,
      }}
    >
      {rays.map((i) => (
        <View
          key={i}
          style={{
            width: 1,
            height: "100%",
            backgroundColor: "rgba(154,234,98,0.28)",
            transform: [{ skewX: "-8deg" }],
          }}
        />
      ))}
    </View>
  );
}

export default function PlayflashPassScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;

  const onBuy = () => {
    showToast("Playflash Pass checkout coming soon", "info");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#1A2E12", "#0F1A0C", "#050805", "#000000"]}
        locations={[0, 0.28, 0.62, 1]}
        style={{ flex: 1 }}
      >
        <VerticalRays />

        <View style={{ paddingTop: insets.top + 6, flex: 1 }}>
          <TouchableOpacity
            onPress={() => goBackTo(router, backTo, BACK_TO_PROFILE)}
            hitSlop={12}
            style={{
              marginLeft: 16,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: Math.max(insets.bottom, 16) + 100,
              alignItems: "center",
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: "center", marginTop: 20, width: "100%" }}>
              <Image
                source={require("../assets/logos/applogo.png")}
                style={{
                  width: Math.min(128, SCREEN_W * 0.54),
                  height: 36,
                  tintColor: "#C8C8C8",
                }}
                resizeMode="contain"
              />
              <Image
                source={require("../assets/images/pass-wordmark-3d-v2.png")}
                style={{
                  width: Math.min(340, SCREEN_W * 0.58),
                  height: 118,
                  marginTop: -4,
                }}
                resizeMode="contain"
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 18,
                gap: 10,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 48,
                  fontWeight: "800",
                  letterSpacing: -1,
                }}
              >
                $999
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.72)",
                  fontSize: 12,
                  fontWeight: "600",
                  letterSpacing: 0.8,
                  lineHeight: 16,
                }}
              >
                {"FOR\n3 MONTHS"}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 28,
                width: "100%",
                gap: 12,
              }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.22)" }} />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 1.4,
                }}
              >
                ✦ PASS BENEFITS ✦
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.22)" }} />
            </View>

            <View
              style={{
                marginTop: 18,
                width: "100%",
                borderRadius: 22,
                backgroundColor: "rgba(18,18,22,0.92)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                paddingVertical: 8,
                paddingHorizontal: 14,
              }}
            >
              {BENEFITS.map((item, index) => (
                <View
                  key={item.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    paddingVertical: 18,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: "rgba(255,255,255,0.08)",
                    gap: 14,
                  }}
                >
                  <Image
                    source={item.icon}
                    style={{ width: 58, height: 58, marginTop: 2 }}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 14,
                        fontWeight: "800",
                        letterSpacing: 0.3,
                        lineHeight: 19,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        marginTop: 6,
                        color: "rgba(255,255,255,0.58)",
                        fontSize: 13,
                        lineHeight: 18,
                      }}
                    >
                      {item.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Text
              style={{
                marginTop: 18,
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              *Offer handling charge will be applied at checkout
            </Text>
          </ScrollView>

          <View
            style={{
              position: "absolute",
              left: 20,
              right: 20,
              bottom: Math.max(insets.bottom, 14),
            }}
          >
            <TouchableOpacity
              onPress={onBuy}
              activeOpacity={0.9}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 28,
                height: 54,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#111111", fontSize: 16, fontWeight: "800" }}>
                Buy Playflash Pass
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

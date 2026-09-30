import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getBackToParam, goBackTo, BACK_TO_HOME } from "@/lib/navigationBack";

const extractJoinToken = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  if (/^[a-f0-9]{32,}$/i.test(trimmed)) return trimmed;

  try {
    const url = new URL(
      trimmed.includes("://")
        ? trimmed
        : `https://playflash.local?${trimmed.split("?")[1] || `token=${trimmed}`}`,
    );
    return url.searchParams.get("token") || trimmed;
  } catch {
    return trimmed;
  }
};

export default function TeamScan() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const backTo = getBackToParam(params);
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 12) + 8;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [opening, setOpening] = useState(false);
  const [manualLink, setManualLink] = useState("");

  const openToken = useCallback((rawValue) => {
    const token = extractJoinToken(rawValue);
    if (!token) {
      Alert.alert("Invalid QR", "No team join token was found.");
      setScanned(false);
      return;
    }

    setOpening(true);
    router.replace({
      pathname: "/team-join",
      params: { token, backTo: backTo || BACK_TO_HOME },
    });
  }, [router, backTo]);

  const handleScanned = useCallback(({ data }) => {
    if (scanned || opening) return;
    setScanned(true);
    openToken(data);
  }, [openToken, opening, scanned]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#081126" }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 }}>
        <TouchableOpacity
          onPress={() => goBackTo(router, backTo, BACK_TO_HOME)}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>Scan Team QR</Text>
          <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 2 }}>Join a team from a shared code</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottomPad }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!permission?.granted ? (
          <View style={{ minHeight: 280, alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 24 }}>
            <Ionicons name="camera-outline" size={64} color="#64748B" />
            <Text style={{ color: "#CBD5E1", textAlign: "center", fontSize: 15 }}>
              Camera permission is needed to scan team QR codes.
            </Text>
            <TouchableOpacity
              onPress={requestPermission}
              style={{ backgroundColor: "#9AEA62", paddingHorizontal: 26, paddingVertical: 13, borderRadius: 14 }}
            >
              <Text style={{ color: "#081126", fontWeight: "800" }}>Allow Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ borderRadius: 24, overflow: "hidden", backgroundColor: "#020617", maxHeight: 360 }}>
            <CameraView
              style={{ width: "100%", aspectRatio: 1, maxHeight: 360 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={scanned ? undefined : handleScanned}
            />
            <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
              {["tl", "tr", "bl", "br"].map((corner) => (
                <View
                  key={corner}
                  style={{
                    position: "absolute",
                    width: 32,
                    height: 32,
                    borderColor: "#9AEA62",
                    borderWidth: 3,
                    ...(corner.includes("t") ? { top: "24%", borderBottomWidth: 0 } : { bottom: "24%", borderTopWidth: 0 }),
                    ...(corner.includes("l") ? { left: "24%", borderRightWidth: 0 } : { right: "24%", borderLeftWidth: 0 }),
                  }}
                />
              ))}
              <Text style={{ color: "#fff", marginTop: "62%", fontSize: 13, fontWeight: "700", textShadowColor: "#000", textShadowRadius: 4 }}>
                {opening ? "Opening team..." : "Align the team QR in the frame"}
              </Text>
            </View>
            {opening && (
              <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <ActivityIndicator size="large" color="#9AEA62" />
                <Text style={{ color: "#fff", fontWeight: "700" }}>Opening team...</Text>
              </View>
            )}
          </View>
        )}

        <View
          style={{
            marginTop: 22,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
            marginBottom: 4,
          }}
        >
          <Text style={{ color: "#CBD5E1", fontWeight: "800", marginBottom: 8 }}>Paste join link</Text>
          <TextInput
            value={manualLink}
            onChangeText={setManualLink}
            placeholder="playflash://team-join?token=..."
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ color: "#fff", backgroundColor: "#0F172A", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: "#1E293B" }}
          />
          <TouchableOpacity
            onPress={() => openToken(manualLink)}
            disabled={!manualLink.trim()}
            style={{ marginTop: 12, backgroundColor: "#9AEA62", borderRadius: 13, paddingVertical: 12, alignItems: "center", opacity: manualLink.trim() ? 1 : 0.5 }}
          >
            <Text style={{ color: "#081126", fontWeight: "800" }}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

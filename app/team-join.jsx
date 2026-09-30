import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { logoRequireMap } from "@/app/team/tabs/helpers";
import { useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBackendAuth } from "@/context/BackendAuthContext";
import {
  acceptTeamJoinLinkAPI,
  checkJerseyNumberAPI,
  validateTeamJoinLinkAPI,
} from "@/services/PlayerApi";
import { getBackToParam, goBackTo } from "@/lib/navigationBack";
import { FOOTBALL_PLAYER_POSITIONS } from "@/components/game/footballFormations";

const splitDisplayName = (user) => {
  const raw =
    user?.firstName ||
    user?.name ||
    user?.username ||
    (user?.email ? user.email.split("@")[0] : "Player");
  const parts = String(raw || "Player").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Player",
    lastName: user?.lastName || parts.slice(1).join(" "),
  };
};

export default function TeamJoin() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const backTo = getBackToParam(params);
  const { backendUser } = useBackendAuth();
  const jerseyTimerRef = useRef(null);

  const defaultName = useMemo(() => splitDisplayName(backendUser), [backendUser]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [redirectingTeamId, setRedirectingTeamId] = useState(null);
  const [joinData, setJoinData] = useState(null);
  const [errors, setErrors] = useState({});
  const [jerseyStatus, setJerseyStatus] = useState("idle");
  const [form, setForm] = useState({
    firstName: defaultName.firstName,
    lastName: defaultName.lastName,
    email: backendUser?.email || "",
    position: "",
    jerseyNumber: "",
    profileImage: null,
  });

  const launchPicker = async (launchFn) => {
    try {
      const result = await launchFn();
      if (!result.canceled && result.assets?.length > 0) {
        setForm((prev) => ({ ...prev, profileImage: result.assets[0] }));
      }
    } catch (error) {
      Alert.alert("Photo Error", String(error?.message || error));
    }
  };

  const pickProfileImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }

    await launchPicker(() =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })
    );
  };

  const takeProfilePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access.");
      return;
    }

    await launchPicker(() =>
      ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })
    );
  };

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      firstName: prev.firstName || defaultName.firstName,
      lastName: prev.lastName || defaultName.lastName,
      email: prev.email || backendUser?.email || "",
    }));
  }, [backendUser?.email, defaultName.firstName, defaultName.lastName]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!token) {
        setLoading(false);
        setErrors({ load: "Missing team join token." });
        return;
      }

      try {
        const result = await validateTeamJoinLinkAPI(token);
        const data = result?.data || result;
        if (!mounted) return;

        if (data?.alreadyJoined && data?.teamId) {
          setRedirectingTeamId(String(data.teamId));
          setJoinData(data);
          return;
        }

        setJoinData(data);
      } catch (err) {
        if (mounted) {
          setErrors({
            load: err?.response?.data?.message || "This team join link is invalid.",
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
      if (jerseyTimerRef.current) clearTimeout(jerseyTimerRef.current);
    };
  }, [token]);

  useEffect(() => {
    if (!redirectingTeamId) return;

    router.replace({
      pathname: `/team/${redirectingTeamId}`,
      params: { initialTab: "TEAM", backTo: "/(tabs)" },
    });
  }, [redirectingTeamId, router]);

  useEffect(() => {
    if (jerseyTimerRef.current) clearTimeout(jerseyTimerRef.current);

    const raw = String(form.jerseyNumber || "").trim();
    if (!raw) {
      setJerseyStatus("idle");
      return;
    }

    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) {
      setJerseyStatus("invalid");
      return;
    }

    if ((joinData?.usedJerseyNumbers || []).includes(parsed)) {
      setJerseyStatus("taken");
      return;
    }

    if (!joinData?.teamId) {
      setJerseyStatus("idle");
      return;
    }

    setJerseyStatus("checking");
    jerseyTimerRef.current = setTimeout(async () => {
      try {
        const result = await checkJerseyNumberAPI(joinData.teamId, parsed);
        setJerseyStatus((result?.data || result)?.available ? "available" : "taken");
      } catch {
        setJerseyStatus("idle");
      }
    }, 300);
  }, [form.jerseyNumber, joinData?.teamId, joinData?.usedJerseyNumbers]);

  const team = joinData?.team || {};
  const isFootballTeam = String(team.sport || "").toLowerCase() === "football";
  const suggestions = (joinData?.availableJerseyNumbers || []).filter((n) => n !== 0);

  const handleJoin = async () => {
    const nextErrors = {};
    if (!form.firstName.trim() || form.firstName.trim().length < 2) {
      nextErrors.firstName = "First name is required";
    }
    if (!form.position.trim()) {
      nextErrors.position = "Position is required";
    }
    if (!String(form.jerseyNumber).trim()) {
      nextErrors.jerseyNumber = "Jersey number is required";
    }
    if (jerseyStatus === "taken") {
      nextErrors.jerseyNumber = `#${form.jerseyNumber} is already taken`;
    }
    if (jerseyStatus === "invalid") {
      nextErrors.jerseyNumber = "Use a number from 1 to 99";
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setJoining(true);
    try {
      const payload = form.profileImage
        ? (() => {
            const fd = new FormData();
            fd.append("firstName", form.firstName.trim());
            fd.append("lastName", form.lastName.trim());
            fd.append("email", form.email.trim());
            fd.append("position", form.position.trim());
            fd.append("jerseyNumber", String(Number(form.jerseyNumber)));
            fd.append("playerimage", {
              uri: form.profileImage.uri,
              type: form.profileImage.mimeType || "image/jpeg",
              name: `join_${Date.now()}.jpg`,
            });
            return fd;
          })()
        : {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            position: form.position.trim(),
            jerseyNumber: Number(form.jerseyNumber),
          };

      const result = await acceptTeamJoinLinkAPI(token, payload);
      const data = result?.data || result;
      router.replace({
        pathname: `/team/${data.teamId || joinData.teamId}`,
        params: { initialTab: "TEAM", backTo: "/(tabs)" },
      });
    } catch (err) {
      const message = err?.response?.data?.message || "Could not join this team.";
      setErrors({ submit: message });
      Alert.alert("Join failed", message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#081126" />
        <Text style={{ color: "#64748B", marginTop: 12, fontWeight: "700" }}>Opening team invite...</Text>
      </SafeAreaView>
    );
  }

  if (redirectingTeamId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#081126" />
        <Text style={{ color: "#111827", marginTop: 12, fontWeight: "800" }}>Team already joined</Text>
        <Text style={{ color: "#64748B", marginTop: 6, fontWeight: "600" }}>Opening your team page...</Text>
      </SafeAreaView>
    );
  }

  if (errors.load) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Ionicons name="alert-circle-outline" size={58} color="#EF4444" />
        <Text style={{ color: "#111827", fontSize: 20, fontWeight: "900", marginTop: 16, textAlign: "center" }}>Invite unavailable</Text>
        <Text style={{ color: "#64748B", textAlign: "center", marginTop: 8 }}>{errors.load}</Text>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={{ marginTop: 22, backgroundColor: "#081126", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13 }}>
          <Text style={{ color: "#9AEA62", fontWeight: "800" }}>Go Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>

        {/* ── STICKY HEADER — back button + dark team badge ── */}
        <View style={{ backgroundColor: "#F8FAFC", paddingHorizontal: 4, paddingTop: 10, paddingBottom: 0 }}>
          {/* Back row */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <TouchableOpacity onPress={() => goBackTo(router, backTo)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#E2E8F0", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Ionicons name="arrow-back" size={21} color="#111827" />
            </TouchableOpacity>
            <View>
              <Text style={{ color: "#111827", fontSize: 20, fontWeight: "900" }}>Join Team</Text>
              <Text style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>Finish your roster details to enter the team</Text>
            </View>
          </View>

          {/* Dark team badge */}
          <View style={{ backgroundColor: "#081126", borderRadius: 28, padding: 20, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <View style={{ backgroundColor: "rgba(154,234,98,0.16)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: "#9AEA62", fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>{team.sport || "Team"}</Text>
                  </View>
                  {!!team.teamType && (
                    <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: "#E2E8F0", fontSize: 11, fontWeight: "700" }}>{team.teamType}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>{team.teamName || "PlayFlash Team"}</Text>
                <Text style={{ color: "#94A3B8", marginTop: 6, lineHeight: 18, fontSize: 13 }}>
                  {team.location || "Complete your details to join the roster."}
                </Text>
              </View>
              {logoRequireMap[team.teamlogo] ? (
                <ExpoImage
                  source={logoRequireMap[team.teamlogo]}
                  style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff", padding: 8 }}
                  contentFit="contain"
                />
              ) : (
                <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#081126", fontSize: 26, fontWeight: "900" }}>
                    {(team.teamName || team.sport || "T").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── SCROLLABLE FORM ── */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 56 }} keyboardShouldPersistTaps="handled">

          {/* Already joined banner */}
          {joinData?.alreadyJoined && (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              backgroundColor: "#F0FDF4", borderRadius: 16, padding: 14,
              marginBottom: 16, borderWidth: 1, borderColor: "#86EFAC",
            }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#166534", fontWeight: "800", fontSize: 14 }}>Already on this team</Text>
                <Text style={{ color: "#15803D", fontSize: 12, marginTop: 2 }}>You can refresh your details and profile photo.</Text>
              </View>
            </View>
          )}

          {errors.submit ? (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              backgroundColor: "#FEF2F2", borderRadius: 16, padding: 14, marginBottom: 14,
              borderWidth: 1, borderColor: "#FECACA",
            }}>
              <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
              <Text style={{ color: "#DC2626", fontWeight: "700", flex: 1 }}>{errors.submit}</Text>
            </View>
          ) : null}

          {/* ── Section: Your Info ── */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, marginBottom: 12,
            shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}>

            {/* Section header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10,
              paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
              borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
              {/* <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#EFF6FF",
                alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="person-circle-outline" size={18} color="#3B82F6" />
              </View> */}
              <Text style={{ fontSize: 15, fontWeight: "900", color: "#0F172A" }}>Your Info</Text>
            </View>

            <View style={{ padding: 20 }}>
              {/* Profile photo */}
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                <View style={{ position: "relative" }}>
                  {form.profileImage ? (
                    <ExpoImage
                      source={{ uri: form.profileImage.uri, width: 100, height: 100 }}
                      style={{ width: 100, height: 100, borderRadius: 50,
                        borderWidth: 3, borderColor: "#9AEA62" }}
                      contentFit="cover"
                      cachePolicy="none"
                    />
                  ) : (
                    <View style={{ width: 100, height: 100, borderRadius: 50,
                      backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center",
                      borderWidth: 2, borderColor: "#E2E8F0", borderStyle: "dashed" }}>
                      <Ionicons name="person-outline" size={40} color="#94A3B8" />
                    </View>
                  )}
                  {form.profileImage && (
                    <TouchableOpacity
                      onPress={() => setForm((prev) => ({ ...prev, profileImage: null }))}
                      style={{ position: "absolute", top: 0, right: 0, width: 26, height: 26,
                        borderRadius: 13, backgroundColor: "#EF4444", borderWidth: 2, borderColor: "#fff",
                        alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name="close" size={13} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={{ color: "#94A3B8", fontSize: 12, fontWeight: "600", marginTop: 10 }}>
                  {form.profileImage ? "Tap × to remove" : "Add a profile photo (optional)"}
                </Text>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <TouchableOpacity onPress={takeProfilePhoto} style={{
                    flexDirection: "row", alignItems: "center", gap: 6,
                    backgroundColor: "#081126", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
                  }}>
                    <Ionicons name="camera-outline" size={16} color="#9AEA62" />
                    <Text style={{ color: "#9AEA62", fontWeight: "700", fontSize: 13 }}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={pickProfileImage} style={{
                    flexDirection: "row", alignItems: "center", gap: 6,
                    backgroundColor: "#F1F5F9", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
                    borderWidth: 1, borderColor: "#E2E8F0",
                  }}>
                    <Ionicons name="image-outline" size={16} color="#475569" />
                    <Text style={{ color: "#475569", fontWeight: "700", fontSize: 13 }}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Name row */}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>FIRST NAME *</Text>
                  <View style={[styles.inputRow, errors.firstName && styles.inputRowError]}>
                    <Ionicons name="person-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                    <TextInput
                      value={form.firstName}
                      onChangeText={(firstName) => {
                        setForm((prev) => ({ ...prev, firstName }));
                        if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }));
                      }}
                      style={styles.inputInner}
                      placeholder="First name"
                      placeholderTextColor="#CBD5E1"
                    />
                  </View>
                  {!!errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>LAST NAME</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="person-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                    <TextInput
                      value={form.lastName}
                      onChangeText={(lastName) => setForm((prev) => ({ ...prev, lastName }))}
                      style={styles.inputInner}
                      placeholder="Last name"
                      placeholderTextColor="#CBD5E1"
                    />
                  </View>
                </View>
              </View>

              {/* Email */}
              <Text style={styles.label}>EMAIL</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  value={form.email}
                  onChangeText={(email) => setForm((prev) => ({ ...prev, email }))}
                  style={styles.inputInner}
                  placeholder="your@email.com"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>

          {/* ── Section: Playing Details ── */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, marginBottom: 16,
            shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10,
              paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
              borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
              {/* <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#FEF3C7",
                alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="football-outline" size={17} color="#D97706" />
              </View> */}
              <Text style={{ fontSize: 15, fontWeight: "900", color: "#0F172A" }}>Playing Details</Text>
            </View>

            <View style={{ padding: 20 }}>
              {/* Position */}
              <Text style={styles.label}>POSITION *</Text>
              {isFootballTeam ? (
                <>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {FOOTBALL_PLAYER_POSITIONS.map((opt) => {
                      const active = form.position === opt.code;
                      return (
                        <TouchableOpacity
                          key={opt.code}
                          onPress={() => {
                            setForm((prev) => ({ ...prev, position: opt.code }));
                            if (errors.position) setErrors((prev) => ({ ...prev, position: undefined }));
                          }}
                          style={{
                            minWidth: 52,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 12,
                            alignItems: "center",
                            backgroundColor: active ? "#081126" : "#F8FAFC",
                            borderWidth: 1,
                            borderColor: active ? "#081126" : "#E2E8F0",
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "800", color: active ? "#9AEA62" : "#334155" }}>
                            {opt.code}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {form.position ? (
                    <Text style={{ marginTop: 8, fontSize: 12, color: "#64748B", fontWeight: "600" }}>
                      {FOOTBALL_PLAYER_POSITIONS.find((p) => p.code === form.position)?.label || form.position}
                    </Text>
                  ) : (
                    <Text style={{ marginTop: 8, fontSize: 12, color: "#94A3B8" }}>
                      Select your usual playing position
                    </Text>
                  )}
                </>
              ) : (
                <View style={[styles.inputRow, errors.position && styles.inputRowError]}>
                  <Ionicons name="body-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    value={form.position}
                    onChangeText={(position) => {
                      setForm((prev) => ({ ...prev, position }));
                      if (errors.position) setErrors((prev) => ({ ...prev, position: undefined }));
                    }}
                    style={styles.inputInner}
                    placeholder="e.g. Forward, Goalkeeper…"
                    placeholderTextColor="#CBD5E1"
                  />
                </View>
              )}
              {!!errors.position && <Text style={styles.errorText}>{errors.position}</Text>}

              {/* Jersey number */}
              <Text style={[styles.label, { marginTop: 14 }]}>JERSEY NUMBER *</Text>
              <View style={[styles.inputRow,
                jerseyStatus === "available" && { borderColor: "#86EFAC" },
                (jerseyStatus === "taken" || jerseyStatus === "invalid" || errors.jerseyNumber) && styles.inputRowError,
              ]}>
                <Ionicons name="shirt-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  value={form.jerseyNumber}
                  onChangeText={(jerseyNumber) => {
                    if (jerseyNumber === "0") {
                      Alert.alert("Invalid Number", "Jersey number 0 is not allowed. Please choose a number from 1 to 99.");
                      return;
                    }
                    setForm((prev) => ({ ...prev, jerseyNumber }));
                    if (errors.jerseyNumber) setErrors((prev) => ({ ...prev, jerseyNumber: undefined }));
                  }}
                  style={styles.inputInner}
                  placeholder="1 – 99"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="number-pad"
                />
                {/* Live status icon */}
                {jerseyStatus === "checking" && <ActivityIndicator size="small" color="#94A3B8" style={{ marginLeft: 6 }} />}
                {jerseyStatus === "available" && <Ionicons name="checkmark-circle" size={18} color="#16A34A" style={{ marginLeft: 6 }} />}
                {(jerseyStatus === "taken" || jerseyStatus === "invalid") && <Ionicons name="close-circle" size={18} color="#DC2626" style={{ marginLeft: 6 }} />}
              </View>

              {/* Status hint */}
              {jerseyStatus !== "idle" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
                  <Text style={{
                    fontSize: 12, fontWeight: "700",
                    color: jerseyStatus === "available" ? "#15803D"
                      : jerseyStatus === "taken" || jerseyStatus === "invalid" ? "#DC2626"
                        : "#64748B",
                  }}>
                    {jerseyStatus === "checking" ? "Checking availability…"
                      : jerseyStatus === "available" ? `#${form.jerseyNumber} is available ✓`
                        : jerseyStatus === "taken" ? `#${form.jerseyNumber} is already taken`
                          : "Use a number from 1 to 99"}
                  </Text>
                </View>
              )}
              {!!errors.jerseyNumber && <Text style={styles.errorText}>{errors.jerseyNumber}</Text>}

            {suggestions.length > 0 && (
              <View style={{ marginTop: 18 }}>
                {/* Header row */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: "#E2E8F0" }} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
                    backgroundColor: "#F8FAFC", borderRadius: 999,
                    paddingHorizontal: 12, paddingVertical: 5,
                    borderWidth: 1, borderColor: "#E2E8F0" }}>
                    <Ionicons name="shirt-outline" size={13} color="#64748B" />
                    <Text style={{ color: "#64748B", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 }}>
                      AVAILABLE NUMBERS
                    </Text>
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: "#E2E8F0" }} />
                </View>

                {/* Number grid */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {suggestions.slice(0, 15).map((number) => {
                    const selected = String(number) === String(form.jerseyNumber);
                    return (
                      <TouchableOpacity
                        key={number}
                        onPress={() => setForm((prev) => ({ ...prev, jerseyNumber: String(number) }))}
                        style={{
                          width: 56, height: 56,
                          borderRadius: 16,
                          alignItems: "center", justifyContent: "center",
                          backgroundColor: selected ? "#081126" : "#F8FAFC",
                          borderWidth: selected ? 2 : 1.5,
                          borderColor: selected ? "#9AEA62" : "#E2E8F0",
                          shadowColor: selected ? "#9AEA62" : "#000",
                          shadowOffset: { width: 0, height: selected ? 3 : 1 },
                          shadowOpacity: selected ? 0.35 : 0.06,
                          shadowRadius: selected ? 8 : 3,
                          elevation: selected ? 6 : 1,
                        }}
                      >
                        <Text style={{
                          color: selected ? "#9AEA62" : "#334155",
                          fontWeight: "900",
                          fontSize: number >= 10 ? 15 : 17,
                          letterSpacing: -0.5,
                        }}>
                          #{number}
                        </Text>
                        {/* {selected && (
                          <View style={{
                            position: "absolute", top: -5, right: -5,
                            width: 16, height: 16, borderRadius: 8,
                            backgroundColor: "#9AEA62",
                            alignItems: "center", justifyContent: "center",
                          }}>
                            <Ionicons name="checkmark" size={10} color="#081126" />
                          </View>
                        )} */}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            </View>
          </View>

          {/* ── Join button ── */}
          <TouchableOpacity
            onPress={handleJoin}
            disabled={joining || jerseyStatus === "checking"}
            style={{
              backgroundColor: "#081126",
              borderRadius: 20, paddingVertical: 18,
              alignItems: "center", justifyContent: "center",
              flexDirection: "row", gap: 10,
              opacity: joining || jerseyStatus === "checking" ? 0.65 : 1,
              marginBottom: 8,
              shadowColor: "#081126",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25, shadowRadius: 14, elevation: 8,
            }}
          >
            {joining ? (
              <ActivityIndicator color="#9AEA62" />
            ) : (
              <>
                <Ionicons name={joinData?.alreadyJoined ? "refresh-outline" : "people-outline"} size={20} color="#9AEA62" />
                <Text style={{ color: "#9AEA62", fontSize: 17, fontWeight: "900", letterSpacing: 0.3 }}>
                  {joinData?.alreadyJoined ? "Update Details" : "Join Team"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  label: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 4,
  },
  // Row-style input (icon + TextInput side by side)
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 4,
    marginBottom: 2,
  },
  inputRowError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  inputInner: {
    flex: 1,
    color: "#0F172A",
    fontSize: 15,
    paddingVertical: 0,
  },
  // kept for backwards compat (jersey suggestions still use inputError indirectly)
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0F172A",
    fontSize: 15,
  },
  inputError: {
    borderColor: "#FCA5A5",
  },
  suggestionTitle: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
};

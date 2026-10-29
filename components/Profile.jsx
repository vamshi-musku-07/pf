import { useState, useCallback, useEffect, useRef } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  findNodeHandle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import Constants from "expo-constants";
import { BACK_TO_PROFILE } from "@/lib/navigationBack";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { useRefresh } from "@/hooks/useRefresh";
import * as ImagePicker from "expo-image-picker";
import { ensurePhotoLibraryAccess } from "@/lib/photoLibraryAccess";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import {
  updateProfileFieldAPI,
  uploadProfilePictureAPI,
  deleteProfilePictureAPI,
} from "@/services/ProfileApi";
import { getFollowCountsAPI } from "@/services/CommunityPostApi";
import { getTeamsAPI } from "@/services/TeamApi";
import { getBackendUser } from "@/lib/tokenStorage";
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
} from "@/lib/notificationsStore";
import { registerForPushNotifications } from "@/services/PushNotificationService";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { LinearGradient } from "expo-linear-gradient";
import TrophyCase from "@/components/TrophyCase";
import StreakCard from "@/components/StreakCard";
import ProfileShieldPlus from "@/components/ProfileShieldPlus";
import RoleBadgesSheet from "@/components/RoleBadgesSheet";
import RoleBadgePicker from "@/components/RoleBadgePicker";
import AvatarRoleBadge from "@/components/AvatarRoleBadge";
import {
  loadSelectedRoleIds,
  saveSelectedRoleIds,
  rolesFromIds,
  getRoleById,
} from "@/lib/roleBadges";
import { Image as ExpoImage } from "expo-image";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Static preset avatar images (flat vector circular characters)
const PRESET_IMAGES = [
  { key: "preset01", source: require("../assets/profile-images/preset-01.jpg") },
  { key: "preset02", source: require("../assets/profile-images/preset-02.jpg") },
  { key: "preset03", source: require("../assets/profile-images/preset-03.jpg") },
  { key: "preset04", source: require("../assets/profile-images/preset-04.jpg") },
  { key: "preset05", source: require("../assets/profile-images/preset-05.jpg") },
  { key: "preset06", source: require("../assets/profile-images/preset-06.jpg") },
  { key: "preset07", source: require("../assets/profile-images/preset-07.jpg") },
  { key: "preset08", source: require("../assets/profile-images/preset-08.jpg") },
  { key: "preset09", source: require("../assets/profile-images/preset-09.jpg") },
  { key: "preset10", source: require("../assets/profile-images/preset-10.jpg") },
  { key: "preset11", source: require("../assets/profile-images/preset-11.jpg") },
  { key: "preset12", source: require("../assets/profile-images/preset-12.jpg") },
  { key: "preset13", source: require("../assets/profile-images/preset-13.jpg") },
  { key: "preset14", source: require("../assets/profile-images/preset-14.jpg") },
  { key: "preset15", source: require("../assets/profile-images/preset-15.jpg") },
  { key: "preset16", source: require("../assets/profile-images/preset-16.jpg") },
  { key: "preset17", source: require("../assets/profile-images/preset-17.jpg") },
  { key: "preset18", source: require("../assets/profile-images/preset-18.jpg") },
  { key: "preset19", source: require("../assets/profile-images/preset-19.jpg") },
  { key: "preset20", source: require("../assets/profile-images/preset-20.jpg") },
  { key: "preset21", source: require("../assets/profile-images/preset-21.jpg") },
];

const AVATAR_PLACEHOLDER_COLORS = [
  "#86EFAC", // green
  "#93C5FD", // blue
  "#FCD34D", // amber
  "#F9A8D4", // pink
  "#C4B5FD", // violet
  "#67E8F9", // cyan
  "#FDBA74", // orange
  "#A5B4FC", // indigo
];

const getProfileInitials = (name = "") => {
  const parts = String(name || "")
    .trim()
    .split(/[\s._@-]+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const getPlaceholderColor = (seed = "") => {
  const str = String(seed || "user");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_PLACEHOLDER_COLORS[hash % AVATAR_PLACEHOLDER_COLORS.length];
};

/** Colored circle + initials (light) or default asset (dark) when no photo. */
function ProfileAvatarPlaceholder({ size, name, isDark }) {
  const initials = getProfileInitials(name);
  const bg = getPlaceholderColor(name);
  if (isDark) {
    return (
      <Image
        source={require("../assets/images/default_profile.webp")}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.08)",
      }}
    >
      <Text
        style={{
          color: "#0F172A",
          fontWeight: "800",
          fontSize: Math.round(size * 0.34),
          letterSpacing: 0.5,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

/** Resolve gallery, camera, or bundled preset URIs to a file:// path FileSystem can read. */
const resolveReadableImageUri = async ({ uri, assetModule }) => {
  if (uri?.startsWith("file://") || uri?.startsWith("content://")) {
    return uri;
  }

  const cachePath = `${FileSystem.cacheDirectory}profile-upload-${Date.now()}.jpg`;

  if (assetModule) {
    const resolved = Image.resolveAssetSource(assetModule);
    if (resolved?.uri?.startsWith("file://") || resolved?.uri?.startsWith("content://")) {
      return resolved.uri;
    }
    if (resolved?.uri?.startsWith("http://") || resolved?.uri?.startsWith("https://")) {
      const { uri: downloaded } = await FileSystem.downloadAsync(
        resolved.uri,
        cachePath,
      );
      return downloaded;
    }

    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();

    const candidates = [asset.localUri, asset.uri, uri].filter(Boolean);
    for (const candidate of candidates) {
      if (
        candidate.startsWith("file://") ||
        candidate.startsWith("content://")
      ) {
        return candidate;
      }
      if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
        const { uri: downloaded } = await FileSystem.downloadAsync(
          candidate,
          cachePath,
        );
        return downloaded;
      }
    }

    if (Platform.OS === "android") {
      for (const candidate of candidates) {
        try {
          await FileSystem.copyAsync({ from: candidate, to: cachePath });
          return cachePath;
        } catch {
          // try next candidate
        }
      }
      if (resolved?.uri) {
        try {
          await FileSystem.copyAsync({ from: resolved.uri, to: cachePath });
          return cachePath;
        } catch {
          // fall through
        }
      }
    }
  }

  if (uri?.startsWith("http://") || uri?.startsWith("https://")) {
    const { uri: downloaded } = await FileSystem.downloadAsync(uri, cachePath);
    return downloaded;
  }

  throw new Error("Could not read image file for upload.");
};

/** Base64 JSON upload — reliable on EAS/Android release (multipart fetch often fails). */
const buildProfileImagePayload = async ({ uri, mimeType, assetModule }) => {
  const readableUri = await resolveReadableImageUri({ uri, assetModule });

  const file = await FileSystem.readAsStringAsync(readableUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    file,
    mimetype: mimeType || "image/jpeg",
  };
};

const EditableRow = ({
  label,
  field,
  keyboardType = "default",
  editingField,
  fieldValues,
  savingField,
  setFieldValues,
  saveField,
  cancelEditing,
  startEditing,
  getDisplayValue,
  colors,
}) => (
  <View
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    }}
  >
    <Text style={{ color: colors.textDim, fontWeight: "500" }}>{label}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {editingField === field ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            value={fieldValues[field]}
            onChangeText={(text) =>
              setFieldValues((prev) => ({ ...prev, [field]: text }))
            }
            keyboardType={keyboardType}
            autoFocus
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.inputBg,
              color: colors.text,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              fontSize: 14,
              width: 112,
              borderWidth: 1,
              borderColor: colors.inputBorder,
            }}
            placeholder={`Enter ${label.toLowerCase()}`}
          />
          <TouchableOpacity onPress={() => saveField(field)} disabled={savingField === field}>
            {savingField === field ? (
              <ActivityIndicator size={14} color="#22c55e" />
            ) : (
              <Ionicons name="checkmark" size={18} color="#22c55e" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => cancelEditing(field)}>
            <Ionicons name="close" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
            {getDisplayValue(field)}
          </Text>
          <TouchableOpacity onPress={() => startEditing(field)}>
            <Feather name="edit-2" size={13} color={colors.iconMuted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  </View>
);

const Profile = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const notificationsRef = useRef(null);
  const pendingNotificationsScroll = useRef(false);
  const [highlightNotifications, setHighlightNotifications] = useState(false);
  const [isLegalExpanded, setIsLegalExpanded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { backendUser, signOut, updateBackendUser } = useBackendAuth();

  // Edit profile modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [fieldValues, setFieldValues] = useState({
    username: "",
    phone: "",
    location: "",
    age: "",
  });
  const [savedValues, setSavedValues] = useState({});
  const [savingField, setSavingField] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localProfileImage, setLocalProfileImage] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [teamsCount, setTeamsCount] = useState(0);
  const [roleIds, setRoleIds] = useState([]);
  const [rolesSheetOpen, setRolesSheetOpen] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  const myUserId = String(
    backendUser?._id || backendUser?.id || backendUser?.userId || "",
  );

  const loadProfileStats = useCallback(async () => {
    if (!myUserId) return;
    const [followRes, teamsRes] = await Promise.all([
      getFollowCountsAPI(myUserId).catch(() => null),
      getTeamsAPI({ page: 1, limit: 100 }).catch(() => null),
    ]);

    if (followRes?.data) {
      setFollowersCount(Number(followRes.data.followers) || 0);
      setFollowingCount(Number(followRes.data.following) || 0);
    }

    const teams = teamsRes?.data || teamsRes?.teams || teamsRes || [];
    const list = Array.isArray(teams) ? teams : [];
    setTeamsCount(list.length);
  }, [myUserId]);

  const fetchProfile = useCallback(async () => {
    await loadProfileStats();
  }, [loadProfileStats]);
  const { refreshing, onRefresh } = useRefresh(fetchProfile);

  useFocusEffect(
    useCallback(() => {
      loadProfileStats();
      (async () => {
        const fromServer = backendUser?.profileRole
          ? [backendUser.profileRole]
          : [];
        if (fromServer.length) {
          setRoleIds(fromServer);
          await saveSelectedRoleIds(fromServer).catch(() => {});
          return;
        }
        const local = await loadSelectedRoleIds().catch(() => []);
        setRoleIds(local);
        // One-time migrate local → server
        if (local[0]) {
          try {
            await updateProfileFieldAPI("profileRole", local[0]);
            await updateBackendUser({
              ...backendUser,
              profileRole: local[0],
            });
          } catch {
            /* keep local */
          }
        }
      })();
    }, [loadProfileStats, backendUser?.profileRole]),
  );

  const saveRoleSelection = useCallback(
    async (ids) => {
      setSavingRole(true);
      try {
        const saved = await saveSelectedRoleIds(ids);
        setRoleIds(saved);
        const role = saved[0] || null;
        try {
          await updateProfileFieldAPI("profileRole", role);
          if (backendUser) {
            await updateBackendUser({ ...backendUser, profileRole: role });
          }
        } catch {
          /* local selection is still saved */
        }
      } finally {
        setSavingRole(false);
      }
    },
    [backendUser, updateBackendUser],
  );

  const scrollToNotificationsIfNeeded = useCallback(() => {
    if (!pendingNotificationsScroll.current) return;
    const relativeNode = findNodeHandle(contentRef.current);
    if (!relativeNode || !notificationsRef.current || !scrollRef.current) return;
    notificationsRef.current.measureLayout(
      relativeNode,
      (_x, y) => {
        pendingNotificationsScroll.current = false;
        scrollRef.current?.scrollTo({
          y: Math.max(0, y - 12),
          animated: true,
        });
      },
      () => {},
    );
  }, []);

  useEffect(() => {
    const section = Array.isArray(params.section) ? params.section[0] : params.section;
    if (section !== "notifications") return;
    pendingNotificationsScroll.current = true;
    setHighlightNotifications(true);
    const t1 = setTimeout(scrollToNotificationsIfNeeded, 120);
    const t2 = setTimeout(scrollToNotificationsIfNeeded, 450);
    const clearHighlight = setTimeout(() => setHighlightNotifications(false), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(clearHighlight);
    };
  }, [params.section, scrollToNotificationsIfNeeded]);

  const toggleLegal = () => setIsLegalExpanded(!isLegalExpanded);

  const openEditModal = () => {
    setFieldValues({
      username:
        savedValues.username !== undefined
          ? String(savedValues.username)
          : backendUser?.username || backendUser?.fullname || "",
      phone: savedValues.phone ?? backendUser?.phone ?? "",
      location: savedValues.location ?? backendUser?.location ?? "",
      age:
        savedValues.age !== undefined
          ? String(savedValues.age)
          : backendUser?.age
            ? String(backendUser.age)
            : "",
    });
    setEditingField(null);
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingField(null);
  };

  const startEditing = (field) => {
    setEditingField(field);
  };

  const cancelEditing = (field) => {
    setFieldValues((prev) => ({
      ...prev,
      [field]:
        field === "username"
          ? savedValues.username !== undefined
            ? String(savedValues.username)
            : backendUser?.username || backendUser?.fullname || ""
          : savedValues[field] !== undefined
            ? String(savedValues[field])
            : backendUser?.[field]
              ? String(backendUser[field])
              : "",
    }));
    setEditingField(null);
  };

  const saveField = async (field) => {
    const value = fieldValues[field];
    if (field === "age") {
      const ageNum = parseInt(value);
      if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
        Alert.alert(
          "Invalid Age",
          "Please enter a valid age between 13 and 120.",
        );
        return;
      }
    }
    setSavingField(field);
    try {
      const saveValue = field === "age" ? parseInt(value) : value;
      await updateProfileFieldAPI(field, saveValue);
      if (field === "username") {
        try {
          await updateProfileFieldAPI("fullname", saveValue);
        } catch {
          // fullname sync is best-effort; local state still updates below
        }
      }
      setSavedValues((prev) => ({ ...prev, [field]: saveValue }));
      const stored = await getBackendUser();
      if (stored) {
        const userPatch =
          field === "username"
            ? { username: saveValue, fullname: saveValue, name: saveValue }
            : { [field]: saveValue };
        await updateBackendUser({ ...stored, ...userPatch });
      }
      setEditingField(null);
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || "Unknown error";
      Alert.alert("Error", msg);
    } finally {
      setSavingField(false);
    }
  };

  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const { mode: appearanceMode, setMode: setAppearanceMode, isDark } = useAppearance();
  const T = getAppTheme(isDark);

  useEffect(() => {
    getNotificationsEnabled().then(setNotificationsEnabledState);
  }, []);

  const handleToggleNotifications = async (value) => {
    setNotificationsEnabledState(value);
    await setNotificationsEnabled(value);
    if (value) {
      await registerForPushNotifications();
    }
  };

  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const handleImageChange = () => setShowAvatarPicker(true);

  const uploadAndSave = async (payload, fallbackUri) => {
    setUploadingImage(true);
    try {
      const res = await uploadProfilePictureAPI(payload.file, payload.mimetype);
      const uploadedUrl = res?.data?.profilePicture || fallbackUri;
      setLocalProfileImage(uploadedUrl);
      const stored = await getBackendUser();
      if (stored)
        await updateBackendUser({
          ...stored,
          profileImage: uploadedUrl,
          profilePicture: uploadedUrl,
        });
    } catch (err) {
      console.error(
        "[Profile] Upload error:",
        err?.code || err?.response?.status,
        err?.message,
        err?.response?.data?.message,
      );
      Alert.alert(
        "Upload Error",
        err?.response?.data?.message || err?.message || "Unknown error",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemovePhoto = () => {
    setShowAvatarPicker(false);
    Alert.alert(
      "Remove Profile Picture",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setUploadingImage(true);
            try {
              await deleteProfilePictureAPI();
              setLocalProfileImage(null);
              const stored = await getBackendUser();
              if (stored)
                await updateBackendUser({
                  ...stored,
                  profileImage: null,
                  profilePicture: null,
                });
            } catch (err) {
              Alert.alert(
                "Error",
                err?.response?.data?.message || err?.message || "Failed to remove picture",
              );
            } finally {
              setUploadingImage(false);
            }
          },
        },
      ],
    );
  };

  // Pick from device gallery
  const handlePickFromDevice = async () => {
    setShowAvatarPicker(false);
    const allowed = await ensurePhotoLibraryAccess();
    if (!allowed) {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photo library.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const payload = await buildProfileImagePayload({
        uri: asset.uri,
        mimeType: asset.mimeType,
      });
      await uploadAndSave(payload, asset.uri);
    }
  };

  // Pick a preset avatar
  const handleSelectPreset = async (assetModule) => {
    setShowAvatarPicker(false);
    try {
      const expoAsset = Asset.fromModule(assetModule);
      await expoAsset.downloadAsync();
      const assetUri = expoAsset.localUri || expoAsset.uri;
      const payload = await buildProfileImagePayload({
        uri: assetUri,
        mimeType: "image/jpeg",
        assetModule,
      });
      await uploadAndSave(payload, assetUri);
    } catch (err) {
      Alert.alert("Upload Error", err?.message || "Unknown error");
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err.message);
    } finally {
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = () => {
    router.push({ pathname: "/delete-account", params: { backTo: BACK_TO_PROFILE } });
  };

  const displayName =
    (savedValues.username !== undefined ? String(savedValues.username) : null) ||
    backendUser?.username ||
    backendUser?.fullname ||
    backendUser?.email ||
    "User";
  const profileImage =
    localProfileImage || backendUser?.profileImage || backendUser?.profilePicture;

  const getDisplayValue = (field) => {
    if (savedValues[field] !== undefined) return String(savedValues[field]);
    if (field === "username") {
      return backendUser?.username || backendUser?.fullname || "Not set";
    }
    if (backendUser?.[field]) return String(backendUser[field]);
    return "Not set";
  };


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar} />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: T.bg }}
        contentContainerStyle={{
          paddingBottom: 72 + Math.max(insets.bottom, 20) + 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[T.refresh]}
            tintColor={T.refresh}
          />
        }
      >
        <View
          ref={contentRef}
          collapsable={false}
          style={{ padding: 20, flex: 1 }}
          onLayout={scrollToNotificationsIfNeeded}
        >
          {/* Profile header — matches Strava-style: avatar + name/email, then Following/Followers */}
          <View style={{ marginTop: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 88, height: 88 }}>
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={{ width: 88, height: 88, borderRadius: 44 }}
                  />
                ) : (
                  <ProfileAvatarPlaceholder size={88} name={displayName} isDark={isDark} />
                )}
                <TouchableOpacity
                  onPress={() => setRolesSheetOpen(true)}
                  activeOpacity={0.85}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={{
                    position: "absolute",
                    right: -4,
                    bottom: -4,
                    width: roleIds.length > 0 ? 40 : 30,
                    height: roleIds.length > 0 ? 40 : 30,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  accessibilityLabel={
                    roleIds.length > 0 ? "Change role badge" : "Add role badge"
                  }
                >
                  {roleIds.length > 0 ? (
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 20,
                        borderWidth: 2,
                        borderColor: "#FFFFFF",
                        backgroundColor: "#FFFFFF",
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ExpoImage
                        source={rolesFromIds(roleIds)[0]?.image}
                        style={{ width: 36, height: 36 }}
                        contentFit="contain"
                      />
                    </View>
                  ) : (
                    <ProfileShieldPlus size={28} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1, marginLeft: 16, justifyContent: "center" }}>
                <Text
                  style={{ fontSize: 22, fontWeight: "700", color: T.text }}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                {backendUser?.email ? (
                  <Text
                    style={{ color: T.textDim, fontSize: 14, marginTop: 4 }}
                    numberOfLines={1}
                  >
                    {backendUser.email}
                  </Text>
                ) : null}
                {roleIds.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setRolesSheetOpen(true)}
                    activeOpacity={0.85}
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 8,
                      backgroundColor: isDark ? "rgba(154,234,98,0.16)" : "rgba(20, 20, 19, 0.61)",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: isDark ? "#BAF072" : "white",
                      }}
                    >
                      {rolesFromIds(roleIds)[0]?.label}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                marginTop: 20,
                paddingHorizontal: 4,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: T.textDim }}>Following</Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: T.text, marginTop: 2 }}>
                  {followingCount}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: T.textDim }}>Followers</Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: T.text, marginTop: 2 }}>
                  {followersCount}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: T.textDim }}>Teams</Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: T.text, marginTop: 2 }}>
                  {teamsCount}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={openEditModal}
              style={{ marginTop: 12, paddingVertical: 2, alignSelf: "flex-start" }}
            >
              <Text
                style={{ color: T.textDim, textDecorationLine: "underline", fontSize: 13 }}
              >
                Edit your profile
              </Text>
            </TouchableOpacity>
          </View>


          <StreakCard isDark={isDark} />
          <TrophyCase isDark={isDark} theme={T} />

          {/* Playflash Pass banner */}
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: "/playflash-pass", params: { backTo: BACK_TO_PROFILE } })
            }
            activeOpacity={0.88}
            style={{
              marginTop: 28,
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(154,234,98,0.28)",
            }}
          >
            <LinearGradient
              colors={["#142414", "#0C180C", "#070A07"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                minHeight: 78,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {/* subtle grid */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.22,
                }}
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <View
                    key={`h-${i}`}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 10 + i * 10,
                      height: 1,
                      backgroundColor: "rgba(154,234,98,0.35)",
                    }}
                  />
                ))}
                {Array.from({ length: 14 }).map((_, i) => (
                  <View
                    key={`v-${i}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: 12 + i * 26,
                      width: 1,
                      backgroundColor: "rgba(154,234,98,0.28)",
                    }}
                  />
                ))}
              </View>

              <View style={{ width: 78 }}>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 12,
                    fontWeight: "500",
                    letterSpacing: 0.2,
                    textTransform: "lowercase",
                  }}
                >
                  playflash
                </Text>
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 20,
                    fontWeight: "900",
                    letterSpacing: 1.2,
                    marginTop: -1,
                  }}
                >
                  PASS
                </Text>
              </View>

              <Text
                style={{
                  flex: 1,
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: "600",
                  marginHorizontal: 10,
                  lineHeight: 20,
                }}
              >
                Become a Pass holder at $999
              </Text>

              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Menu Items */}
          <View style={{ marginTop: 24, width: "100%", gap: 8 }}>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/parent", params: { backTo: BACK_TO_PROFILE } })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: T.surface,
                padding: 12,
                borderRadius: 12,
                borderWidth: isDark ? 1 : 0,
                borderColor: T.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <MaterialIcons name="family-restroom" size={40} color="#34D399" />
                <View>
                  <Text style={{ fontWeight: "600", color: T.text }}>Parent Portal</Text>
                  <Text style={{ color: T.textMuted, fontSize: 12 }}>Follow your child's live matches</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={T.iconMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push({ pathname: "/help-center", params: { backTo: BACK_TO_PROFILE } })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: T.surface,
                padding: 12,
                borderRadius: 12,
                borderWidth: isDark ? 1 : 0,
                borderColor: T.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <MaterialIcons name="help-center" size={40} color="#FBBF24" />
                <View>
                  <Text style={{ fontWeight: "600", color: T.text }}>Help Center</Text>
                  <Text style={{ color: T.textMuted, fontSize: 12 }}>AI-powered support</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={T.iconMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push({ pathname: "/customer-support", params: { backTo: BACK_TO_PROFILE } })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: T.surface,
                padding: 12,
                borderRadius: 12,
                borderWidth: isDark ? 1 : 0,
                borderColor: T.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <MaterialIcons name="support-agent" size={35} color="#60A5FA" />
                <View>
                  <Text style={{ fontWeight: "600", color: T.text }}>
                    Contact Support
                  </Text>
                  <Text style={{ color: T.textMuted, fontSize: 12 }}>
                    Chat with our team
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={T.iconMuted} />
            </TouchableOpacity>

            <View>
              <TouchableOpacity
                onPress={toggleLegal}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: T.surface,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: isDark ? 1 : 0,
                  borderColor: T.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <MaterialIcons name="description" size={35} color="#60A5FA" />
                  <Text style={{ fontWeight: "600", color: T.text }}>Legal</Text>
                </View>
                <Ionicons
                  name={isLegalExpanded ? "chevron-up" : "chevron-forward"}
                  size={16}
                  color={T.iconMuted}
                />
              </TouchableOpacity>

              {isLegalExpanded && (
                <View
                  style={{
                    marginTop: 8,
                    backgroundColor: T.surface,
                    borderRadius: 12,
                    overflow: "hidden",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: T.border,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/data-protection', params: { backTo: BACK_TO_PROFILE } })}
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: T.borderSubtle }}
                  >
                    <Text style={{ color: T.textDim }}>Privacy Policy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/terms-of-use', params: { backTo: BACK_TO_PROFILE } })}
                    style={{ padding: 12 }}
                  >
                    <Text style={{ color: T.textDim }}>Terms of Use</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Settings Section */}
            <View style={{ marginTop: 20 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: T.textDim,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  marginBottom: 8,
                  marginLeft: 4,
                }}
              >
                Settings
              </Text>

              <View
                style={{
                  backgroundColor: T.surface,
                  borderRadius: 12,
                  overflow: "hidden",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: T.border,
                }}
              >
                {/* Appearance */}
                <View
                  style={{
                    paddingHorizontal: 14,
                    paddingTop: 14,
                    paddingBottom: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: T.borderSubtle,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: isDark ? "rgba(124,58,237,0.22)" : "#F3E8FF",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="moon" size={20} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "600", color: T.text, fontSize: 15 }}>
                        Appearance
                      </Text>
                      <Text style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>
                        select your preffered mode
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      backgroundColor: T.segmentBg,
                      borderRadius: 12,
                      padding: 4,
                      gap: 4,
                    }}
                  >
                    {[
                      { key: "light", label: "Light", icon: "sunny" },
                      { key: "dark", label: "Dark", icon: "moon" },
                    ].map((opt) => {
                      const active = appearanceMode === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          onPress={() => setAppearanceMode(opt.key)}
                          activeOpacity={0.85}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            paddingVertical: 10,
                            borderRadius: 10,
                            backgroundColor: active ? T.segmentActive : "transparent",
                            shadowColor: "#000",
                            shadowOpacity: active && !isDark ? 0.08 : 0,
                            shadowRadius: 6,
                            shadowOffset: { width: 0, height: 2 },
                            elevation: active && !isDark ? 2 : 0,
                            borderWidth: active && isDark ? 1 : 0,
                            borderColor: T.border,
                          }}
                        >
                          <Ionicons
                            name={opt.icon}
                            size={16}
                            color={active ? T.segmentActiveText : T.textMuted}
                          />
                          <Text
                            style={{
                              fontWeight: "700",
                              fontSize: 13,
                              color: active ? T.segmentActiveText : T.textMuted,
                            }}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Notifications toggle */}
                <View
                  ref={notificationsRef}
                  collapsable={false}
                  onLayout={scrollToNotificationsIfNeeded}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: T.borderSubtle,
                    backgroundColor: highlightNotifications
                      ? isDark
                        ? "rgba(154,234,98,0.14)"
                        : "rgba(154,234,98,0.18)"
                      : "transparent",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: notificationsEnabled
                          ? isDark
                            ? "rgba(59,130,246,0.2)"
                            : "#EFF6FF"
                          : T.surfaceAlt,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name={notificationsEnabled ? "notifications" : "notifications-off"}
                        size={20}
                        color={notificationsEnabled ? "#3B82F6" : T.textMuted}
                      />
                    </View>
                    <View>
                      <Text style={{ fontWeight: "600", color: T.text, fontSize: 15 }}>
                        Notifications
                      </Text>
                      <Text style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>
                        {notificationsEnabled ? "You will receive app alerts" : "All notifications are muted"}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={handleToggleNotifications}
                    trackColor={{ false: isDark ? "#3F3F46" : "#D1D5DB", true: "#86EFAC" }}
                    thumbColor={notificationsEnabled ? "#22C55E" : T.textMuted}
                  />
                </View>

                {/* Delete Account */}
                <TouchableOpacity
                  onPress={handleDeleteAccount}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: T.dangerBg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color={T.dangerText} />
                  </View>
                  <View>
                    <Text style={{ fontWeight: "600", color: T.dangerText, fontSize: 15 }}>
                      Delete Account
                    </Text>
                    <Text style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>
                      Permanently remove your account
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSignOut}
              disabled={signingOut}
              style={{
                padding: 12,
                borderRadius: 12,
                marginTop: 16,
                backgroundColor: signingOut ? (isDark ? "#3F3F46" : "#9CA3AF") : "#22C55E",
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "600" }}>
                {signingOut ? "Signing Out..." : "Sign Out"}
              </Text>
            </TouchableOpacity>

            {/* Feedback bar */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: T.surface,
                borderRadius: 16,
                paddingVertical: 16,
                paddingHorizontal: 18,
                marginTop: 20,
                borderWidth: isDark ? 1 : 0,
                borderColor: T.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.25 : 0.06,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: "600",
                  color: T.text,
                  marginRight: 12,
                }}
              >
                Interested in sharing your feedback?
              </Text>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/share-feedback",
                    params: { backTo: BACK_TO_PROFILE },
                  })
                }
                style={{
                  borderWidth: 1.5,
                  borderColor: "#22C55E",
                  borderRadius: 24,
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                }}
              >
                <Text
                  style={{ color: isDark ? "#9AEA62" : "#16A34A", fontWeight: "800", fontSize: 14 }}
                >
                  Give Feedback
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={{
                alignItems: "flex-start",
                marginTop: 30,
                marginBottom: 18,
                paddingLeft: 2,
              }}
            >
              <Text
                style={{
                  color: T.textMuted,
                  fontSize: 25,
                  fontWeight: "900",
                  fontStyle: "italic",
                  letterSpacing: -1,
                }}
              >
                PlayFlash
              </Text>
              <Text
                style={{
                  color: T.textMuted,
                  fontSize: 11,
                  fontWeight: "600",
                  marginTop: 2,
                }}
              >
                v{Constants.expoConfig?.version || "1.0.1"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditModal}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
          <StatusBar barStyle={T.statusBar} />
          {/* Modal Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: T.border,
              backgroundColor: T.surface,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: T.text }}>Edit Profile</Text>
            <TouchableOpacity onPress={closeEditModal}>
              <Ionicons name="close" size={24} color={T.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24, backgroundColor: T.bg }}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
          >
            {/* Profile Picture */}
            <View style={{ alignItems: "center", marginBottom: 28 }}>
              <View style={{ position: "relative", width: 120, height: 120 }}>
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={{ width: 120, height: 120, borderRadius: 60 }}
                  />
                ) : (
                  <ProfileAvatarPlaceholder size={120} name={displayName} isDark={isDark} />
                )}
                <AvatarRoleBadge
                  roleId={roleIds[0] || null}
                  avatarSize={120}
                  size={34}
                  bordered
                  borderColor={T.surface}
                />
                <TouchableOpacity
                  onPress={handleImageChange}
                  disabled={uploadingImage}
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    backgroundColor: "#22c55e",
                    borderRadius: 20,
                    padding: 7,
                    zIndex: 6,
                  }}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size={16} color="#fff" />
                  ) : (
                    <Feather name="camera" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={{ color: T.textDim, fontSize: 14, marginTop: 8 }}>
                Tap camera to change photo
              </Text>
              {getRoleById(roleIds[0]) ? (
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    fontWeight: "700",
                    color: isDark ? "#9AEA62" : "#15803D",
                  }}
                >
                  {getRoleById(roleIds[0])?.label} badge selected
                </Text>
              ) : null}
              {profileImage ? (
                <TouchableOpacity
                  onPress={handleRemovePhoto}
                  disabled={uploadingImage}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: T.dangerBg,
                  }}
                >
                  <Ionicons name="trash-outline" size={15} color={T.dangerText} />
                  <Text style={{ color: T.dangerText, fontWeight: "600", fontSize: 13 }}>
                    Remove Photo
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Role badge picker */}
            <RoleBadgePicker
              selectedId={roleIds[0] || null}
              onSelect={(id) => saveRoleSelection(id ? [id] : [])}
              saving={savingRole}
              colors={T}
              isDark={isDark}
            />

            {/* Editable Fields */}
            <View
              style={{
                backgroundColor: T.surface,
                borderRadius: 12,
                paddingHorizontal: 16,
                borderWidth: isDark ? 1 : 0,
                borderColor: T.border,
              }}
            >
              {/* Email (read-only) */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: T.borderSubtle,
                }}
              >
                <Text style={{ color: T.textDim, fontWeight: "500" }}>Email</Text>
                <Text
                  style={{ color: T.text, fontWeight: "600", fontSize: 14, maxWidth: 180 }}
                  numberOfLines={1}
                >
                  {backendUser?.email || "Not set"}
                </Text>
              </View>

              <EditableRow label="Name" field="username" editingField={editingField} fieldValues={fieldValues} savingField={savingField} setFieldValues={setFieldValues} saveField={saveField} cancelEditing={cancelEditing} startEditing={startEditing} getDisplayValue={getDisplayValue} colors={T} />
              <EditableRow
                label="Phone"
                field="phone"
                keyboardType="phone-pad"
                editingField={editingField} fieldValues={fieldValues} savingField={savingField} setFieldValues={setFieldValues} saveField={saveField} cancelEditing={cancelEditing} startEditing={startEditing} getDisplayValue={getDisplayValue} colors={T}
              />
              <EditableRow label="Location" field="location" editingField={editingField} fieldValues={fieldValues} savingField={savingField} setFieldValues={setFieldValues} saveField={saveField} cancelEditing={cancelEditing} startEditing={startEditing} getDisplayValue={getDisplayValue} colors={T} />
              <EditableRow label="Age" field="age" keyboardType="numeric" editingField={editingField} fieldValues={fieldValues} savingField={savingField} setFieldValues={setFieldValues} saveField={saveField} cancelEditing={cancelEditing} startEditing={startEditing} getDisplayValue={getDisplayValue} colors={T} />
            </View>
          </ScrollView>

          {/* ── Avatar picker bottom sheet (inside edit modal so it stacks on iOS) ── */}
          <Modal
            visible={showAvatarPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowAvatarPicker(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: T.overlay,
                justifyContent: "flex-end",
              }}
            >
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={1}
                onPress={() => setShowAvatarPicker(false)}
              />
              <View
                style={{
                  backgroundColor: T.surface,
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  maxHeight: "82%",
                  paddingBottom: insets.bottom + 8,
                  borderTopWidth: isDark ? 1 : 0,
                  borderColor: T.border,
                }}
              >
                {/* Header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingTop: 20,
                    paddingBottom: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: T.borderSubtle,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "700",
                      color: T.text,
                    }}
                  >
                    Choose Profile Picture
                  </Text>
                  <TouchableOpacity onPress={() => setShowAvatarPicker(false)}>
                    <Ionicons name="close" size={22} color={T.textDim} />
                  </TouchableOpacity>
                </View>

                {/* Section label */}
                <View
                  style={{
                    paddingHorizontal: 20,
                    paddingTop: 16,
                    paddingBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: T.textDim,
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                    }}
                  >
                    Suggested avatars
                  </Text>
                </View>

                {/* Preset grid */}
                <FlatList
                  data={PRESET_IMAGES}
                  numColumns={3}
                  keyExtractor={(item) => item.key}
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={{
                    paddingHorizontal: 12,
                    paddingBottom: 4,
                  }}
                  columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
                  renderItem={({ item }) => {
                    const size = (SCREEN_WIDTH - 56) / 3;
                    return (
                      <TouchableOpacity
                        onPress={() => handleSelectPreset(item.source)}
                        activeOpacity={0.75}
                        style={{
                          width: size,
                          height: size,
                          borderRadius: 14,
                          overflow: "hidden",
                        }}
                      >
                        <Image
                          source={item.source}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    );
                  }}
                />

                {/* Divider + device button */}
                <View
                  style={{
                    marginHorizontal: 16,
                    marginTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: T.borderSubtle,
                    paddingTop: 12,
                  }}
                >
                  <TouchableOpacity
                    onPress={handlePickFromDevice}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      backgroundColor: isDark ? "#1E1E24" : "#081126",
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: isDark ? 1 : 0,
                      borderColor: T.border,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "rgba(154,234,98,0.15)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="phone-portrait-outline"
                        size={22}
                        color="#9AEA62"
                      />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          color: "#fff",
                        }}
                      >
                        Browse from Device
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.5)",
                          marginTop: 2,
                        }}
                      >
                        Upload from your gallery
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </Modal>

      <RoleBadgesSheet
        visible={rolesSheetOpen}
        selectedIds={roleIds}
        onClose={() => setRolesSheetOpen(false)}
        onSave={saveRoleSelection}
      />
    </SafeAreaView>
  );
};

export default Profile;

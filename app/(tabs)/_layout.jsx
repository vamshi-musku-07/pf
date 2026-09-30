import { tabs } from "@/constants/data";
import { colors, components } from "@/constants/theme";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { useAppearance } from "@/context/AppearanceContext";
import { Ionicons } from "@expo/vector-icons";
import clsx from "clsx";
import { Tabs, useRouter, useSegments, useFocusEffect } from "expo-router";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { HomeScrollProvider, useHomeScrollY } from "@/context/HomeScrollContext";
import { useNotificationBadge } from "@/context/NotificationBadgeContext";
import { BACK_TO_HOME } from "@/lib/navigationBack";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import AvatarRoleBadge from "@/components/AvatarRoleBadge";

const tabBar = components.tabBar;

const PROFILE_RING_COLOR = "#9AEA62";

function ProfileCompletionRing({ user, size = 58, stroke = 3, children }) {
  const fields = [
    user?.profileImage || user?.profilePicture,
    user?.username || user?.fullname || user?.name,
    user?.phone,
    user?.location,
    user?.age,
  ];
  const filled = fields.filter(Boolean).length;
  const pct = fields.length ? filled / fields.length : 0;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={c} cy={c} r={r} stroke="rgba(143, 246, 92, 0.2)" strokeWidth={stroke} fill="none" />
        {pct > 0 ? (
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={PROFILE_RING_COLOR}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${c} ${c})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

const CREATE_ACTIONS = [
  {
    key: "tournament",
    title: "Organise a tournament",
    subtitle: "Host leagues, knockouts & cups",
    icon: "trophy-outline",
    iconBg: "rgba(154,234,98,0.18)",
    iconColor: "#9AEA62",
  },
  {
    key: "team",
    title: "Create a team",
    subtitle: "Set up your squad & season",
    icon: "people-outline",
    iconBg: "rgba(96,165,250,0.18)",
    iconColor: "#60A5FA",
  },
  {
    key: "post",
    title: "Post",
    subtitle: "Share an update with the community",
    icon: "create-outline",
    iconBg: "rgba(251,191,36,0.18)",
    iconColor: "#FBBF24",
  },
];

function CreateActionMenu({ visible, bottomOffset, onClose, onSelect }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 8, tension: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 120, useNativeDriver: true }),
      ]).start();
      return;
    }
    opacity.setValue(0);
    translateY.setValue(14);
    scale.setValue(0.94);
  }, [visible, opacity, translateY, scale]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(8,17,38,0.45)",
          }}
        />
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: bottomOffset,
            alignItems: "center",
            opacity,
            transform: [{ translateY }, { scale }],
          }}
        >
          <View
            style={{
              width: 300,
              backgroundColor: "#111827",
              borderRadius: 20,
              paddingVertical: 8,
              paddingHorizontal: 8,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.35,
              shadowRadius: 20,
              elevation: 16,
            }}
          >
            {CREATE_ACTIONS.map((action, index) => (
              <TouchableOpacity
                key={action.key}
                activeOpacity={0.85}
                onPress={() => onSelect(action.key)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: "transparent",
                  marginTop: index === 0 ? 0 : 2,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: action.iconBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={action.icon} size={22} color={action.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#F8FAFC", fontSize: 15, fontWeight: "800", letterSpacing: -0.2 }}>
                    {action.title}
                  </Text>
                  <Text style={{ color: "#94A3B8", fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                    {action.subtitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#64748B" />
              </TouchableOpacity>
            ))}
          </View>
          <View
            style={{
              width: 16,
              height: 16,
              backgroundColor: "#111827",
              transform: [{ rotate: "45deg" }],
              marginTop: -8,
              borderRightWidth: 1,
              borderBottomWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

function HomeHeaderScrollBackdrop({ insets, scrollY, isDark = false }) {
  const opacity = scrollY.interpolate({
    inputRange: [0, 28, 72],
    outputRange: [0, 0.96, 1],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 45,
        height: insets.top + 84,
        backgroundColor: isDark ? "#0A0A0C" : "#FFFFFF",
        opacity,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#27272A" : "#E5E7EB",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 8,
        shadowOpacity: isDark ? 0.35 : 0.08,
        elevation: 3,
      }}
    />
  );
}

const TabsLayoutInner = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const { backendUser, updateBackendUser } = useBackendAuth();
  const { isDark } = useAppearance();
  const { unreadCount: notifCount, refresh: refreshNotifCount } = useNotificationBadge();
  const scrollY = useHomeScrollY();
  const activeTab = segments[1] || "index";
  const showHeaderActions = activeTab === "index";
  const homeDark = showHeaderActions && isDark;
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [localRoleId, setLocalRoleId] = useState(null);
  const tabBarBottom = Math.max(insets.bottom, tabBar.horizontalInset);
  const createMenuBottomOffset = tabBarBottom + tabBar.height + 28;

  useFocusEffect(useCallback(() => {
    refreshNotifCount();
  }, [refreshNotifCount]));

  // Prefer server role; fall back to local cache so home badge shows before re-login
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (backendUser?.profileRole) {
        if (!cancelled) setLocalRoleId(backendUser.profileRole);
        return;
      }
      try {
        const { loadSelectedRoleIds } = await import("@/lib/roleBadges");
        const { updateProfileFieldAPI } = await import("@/services/ProfileApi");
        const ids = await loadSelectedRoleIds();
        const role = ids[0] || null;
        if (cancelled) return;
        setLocalRoleId(role);
        if (role && backendUser) {
          await updateProfileFieldAPI("profileRole", role);
          await updateBackendUser({ ...backendUser, profileRole: role });
        }
      } catch {
        if (!cancelled) setLocalRoleId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backendUser?.profileRole, backendUser?._id || backendUser?.id]);

  const closeCreateMenu = useCallback(() => setCreateMenuOpen(false), []);

  const handleCreateAction = useCallback(
    (key) => {
      setCreateMenuOpen(false);
      if (key === "tournament") {
        router.push({ pathname: "/tournament", params: { backTo: BACK_TO_HOME } });
        return;
      }
      if (key === "post") {
        router.push({ pathname: "/create-post", params: { backTo: BACK_TO_HOME } });
        return;
      }
      router.navigate("/(tabs)/CreateTeam");
    },
    [router],
  );

  const TabIcon = ({ focused, Icon }) => {
    const IconLib = Icon.lib;
    const focusedBg = isDark ? "#3A3A40" : "#FFFFFF";
    const focusedColor = isDark ? "#FFFFFF" : "#000000";
    const idleColor = isDark ? "#8E8E93" : "#9CA3AF";
    return (
      <View className="flex items-center justify-center size-12 ">
        <View
          className={clsx(
            "size-12  items-center justify-center rounded-full",
            !isDark && (focused ? "bg-white" : "bg-transparent"),
          )}
          style={
            isDark
              ? {
                  backgroundColor: focused ? focusedBg : "transparent",
                }
              : undefined
          }
        >
          <IconLib
            name={Icon.name}
            size={24}
            color={focused ? focusedColor : idleColor}
          />
        </View>
      </View>
    );
  };
  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <Tabs
        backBehavior="none"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: "absolute",
            bottom: tabBarBottom,
            height: tabBar.height,
            marginHorizontal: tabBar.horizontalInset,
            borderRadius: tabBar.radius,
            backgroundColor: isDark ? "#242428" : colors.primary,
            borderWidth: isDark ? 1 : 0,
            borderColor: isDark ? "rgba(255,255,255,0.14)" : "transparent",
            borderTopWidth: isDark ? 1 : 0,
            elevation: isDark ? 12 : 0,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.55 : 0,
            shadowRadius: isDark ? 18 : 0,
          },

          tabBarItemStyle: {
            paddingVertical: tabBar.height / 2 - tabBar.iconFrame / 1.6,
          },

          tabBarIconStyle: {
            width: tabBar.iconFrame,
            height: tabBar.iconFrame,
            alignItems: "center",
          },
        }}
      >
        {tabs.map((tab, index) => {
          const isMiddle = index === Math.floor(tabs.length / 2);
          return (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              listeners={
                isMiddle
                  ? {
                      tabPress: (e) => {
                        e.preventDefault();
                        setCreateMenuOpen((open) => !open);
                      },
                    }
                  : undefined
              }
              options={{
                title: tab.title,
                tabBarIcon: ({ focused }) =>
                  isMiddle ? (
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: "#9AEA62",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 40,
                        shadowColor: "#9AEA62",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.4,
                        shadowRadius: 8,
                        elevation: 8,
                        transform: [{ rotate: createMenuOpen ? "45deg" : "0deg" }],
                      }}
                      className=" border-3 border-gray-100 rounded-full"
                    >
                      <Ionicons name="add" size={30} color="black" className=""/>
                    </View>
                  ) : (
                    <TabIcon focused={focused} Icon={tab.icon} />
                  ),
              }}
            />
          );
        })}
      </Tabs>

      <CreateActionMenu
        visible={createMenuOpen}
        bottomOffset={createMenuBottomOffset}
        onClose={closeCreateMenu}
        onSelect={handleCreateAction}
      />

      {showHeaderActions && scrollY ? (
        <HomeHeaderScrollBackdrop insets={insets} scrollY={scrollY} isDark={homeDark} />
      ) : null}

      {showHeaderActions && (
        
      <>
        <LinearGradient
          pointerEvents="none"
          colors={
            homeDark
              ? ["rgba(139,92,246,0.28)", "rgba(139,92,246,0.08)", "rgba(10,10,12,0)"]
              : [
                  "rgba(244, 246, 92, 0)",
                  "rgba(92, 246, 151, 0)",
                  "rgba(139,92,246,0)",
                ]
          }
          locations={[0, 0.55, 1]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + 150,
            zIndex: 40,
          }}
        />
        <View
            style={{
              position: "absolute",
              top: insets.top + 20,
              left: 16,
              zIndex: 50,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
            
          >
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)/settings")}
              activeOpacity={0.7}
              className="flex-row items-center gap-2"
            >
              <View style={{ width: 58, height: 58 }}>
                <ProfileCompletionRing user={backendUser}>
                  <Image
                    source={
                      backendUser?.profileImage
                        ? { uri: backendUser.profileImage }
                        : require("../../assets/images/default_profile.webp")
                    }
                    style={{ width: 46, height: 46, borderRadius: 23 }}
                  />
                </ProfileCompletionRing>
                {/* Sit on the outer ring corner — not under the green stroke */}
                <AvatarRoleBadge
                  roleId={backendUser?.profileRole || localRoleId}
                  size={18}
                  bordered
                  style={{ right: 2, bottom: 2 }}
                />
              </View>

              <View >
                <Text
                  style={{
                    color: homeDark ? "#A1A1AA" : "#9CA3AF",
                    fontWeight: "700",
                    fontSize: 22,
                  }}
                >
                Welcome!
              </Text>
                <Text
                  style={{
                    color: homeDark ? "#F5F5F7" : "#4B5563",
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                {backendUser?.username ||
                  backendUser?.fullname ||
                  backendUser?.email ||
                  "User"}
              </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View
            style={{
              position: "absolute",
              top: insets.top + 20,
              right: 16,
              zIndex: 50,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                router.push({ pathname: "/team-scan", params: { backTo: BACK_TO_HOME } });
              }}
              activeOpacity={0.7}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                display: "flex",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 6,
                backgroundColor: homeDark ? "#1E1E24" : "#D1D5DB",
                borderRadius: 20,
                marginTop: 8,
              }}
            >
              <Ionicons name="scan-outline" size={20} color={homeDark ? "#F5F5F7" : "black"} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                router.push({ pathname: "/posts", params: { backTo: BACK_TO_HOME } });
              }}
              activeOpacity={0.7}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                display: "flex",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 6,
                backgroundColor: homeDark ? "#1E1E24" : "#D1D5DB",
                borderRadius: 20,
                marginTop: 8,
              }}
            >
              <Ionicons name="bulb-outline" size={20} color={homeDark ? "#F5F5F7" : "black"} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                router.push({ pathname: "/notifications", params: { backTo: BACK_TO_HOME } });
              }}
              activeOpacity={0.7}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                display: "flex",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 6,
                backgroundColor: homeDark ? "#1E1E24" : "#D1D5DB",
                borderRadius: 20,
                marginTop: 8,
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={homeDark ? "#F5F5F7" : "black"} />
              {notifCount > 0 && (
                <View style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  backgroundColor: "#EF4444",
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 3,
                  borderWidth: 1.5,
                  borderColor: "#fff",
                }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                    {notifCount > 99 ? "99+" : notifCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
      </>
        
      )}
    </View>
  );
};

const TabsLayout = () => (
  <HomeScrollProvider>
    <TabsLayoutInner />
  </HomeScrollProvider>
);

export default TabsLayout;

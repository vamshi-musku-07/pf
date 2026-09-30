import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  Alert,
  Animated as RNAnimated,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { buildNotificationsFeed } from "@/lib/notificationsFeed";
import {
  readNotificationsCache,
  writeNotificationsCache,
  isNotificationsCacheFresh,
} from "@/lib/notificationsFeedCache";
import { refreshNotificationBadge } from "@/lib/notificationBadge";
import {
  resolveNotificationOnDismiss,
  resolveNotificationOnOpen,
} from "@/lib/notificationActions";
import {
  clearAllNotifications,
  deleteNotificationById,
  filterNotificationsByStore,
  getNotificationUserId,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notificationsStore";
import { getBackLabel, getBackToParam, goBackTo, BACK_TO_HOME } from "@/lib/navigationBack";
import { openTeamInvitation } from "@/lib/openTeamInvitation";

const formatTime = (d) => {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  return new Date(d).toLocaleDateString();
};

function SkeletonNotifItem({ T, isDark }) {
  const pulse = useRef(new RNAnimated.Value(0.45)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 0.45, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <RNAnimated.View
      style={[
        styles.card,
        {
          backgroundColor: T.surface,
          borderWidth: isDark ? 1 : 0,
          borderColor: T.border,
          shadowOpacity: isDark ? 0 : 0.06,
          elevation: isDark ? 0 : 3,
          opacity: pulse,
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: T.surfaceAlt }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[styles.skeletonLine, { width: "62%", backgroundColor: T.surfaceAlt }]} />
        <View
          style={[
            styles.skeletonLine,
            { width: "88%", height: 12, backgroundColor: T.surfaceAlt },
          ]}
        />
        <View
          style={[
            styles.skeletonLine,
            { width: "32%", height: 10, backgroundColor: T.surfaceAlt },
          ]}
        />
      </View>
    </RNAnimated.View>
  );
}

function NotificationCard({ item, onPress, onDelete, T, isDark }) {
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <TouchableOpacity onPress={onDelete} style={styles.swipeDelete} activeOpacity={0.85}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        style={[
          styles.card,
          {
            backgroundColor: T.surface,
            borderWidth: isDark ? 1 : 0,
            borderColor: T.border,
            shadowOpacity: isDark ? 0 : 0.06,
            elevation: isDark ? 0 : 3,
          },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
          <Ionicons name={item.icon} size={22} color={item.iconColor} />
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: T.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.cardMessage, { color: T.textDim }]} numberOfLines={3}>
            {item.body}
          </Text>
          {item.time ? (
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={14} color={T.textMuted} />
              <Text style={[styles.timeText, { color: T.textMuted }]}>
                {formatTime(item.time)}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const backTo = getBackToParam(params);
  const backLabel = getBackLabel(backTo);
  const { backendUser } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = useMemo(() => getAppTheme(isDark), [isDark]);
  const userId = getNotificationUserId(backendUser);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const notificationsRef = useRef([]);
  const initialRenderRef = useRef(true);
  const knownIdsRef = useRef(new Set());

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const applyFeed = useCallback(async (feed) => {
    const filtered = await filterNotificationsByStore(feed, userId);
    setNotifications(filtered.notifications);
    setUnreadCount(filtered.unreadCount);
    return filtered;
  }, [userId]);

  const refreshFromNetwork = useCallback(async () => {
    const feed = await buildNotificationsFeed(backendUser);
    await writeNotificationsCache(userId, feed);
    await applyFeed(feed);
    refreshNotificationBadge();
  }, [backendUser, userId, applyFeed]);

  // Cache-first render: paint instantly from cache, then revalidate in the background.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await readNotificationsCache(userId);
      if (!cancelled && Array.isArray(cached)) {
        await applyFeed(cached);
        setLoading(false);
      }

      try {
        if (!isNotificationsCacheFresh(userId) || !cached) {
          await refreshFromNetwork();
        }
      } catch {
        // keep cached view on transient failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, applyFeed, refreshFromNetwork]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        void (async () => {
          const ids = notificationsRef.current.map((n) => n.id);
          if (!ids.length || !userId) return;
          await markAllNotificationsRead(ids, userId);
          refreshNotificationBadge();
        })();
      };
    }, [userId]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshFromNetwork();
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenNotification = async (item) => {
    await markNotificationRead(item.id, userId);
    await resolveNotificationOnOpen(item, userId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - (item.isRead ? 0 : 1)));
    refreshNotificationBadge();

    if (item.type === "invitation") {
      try {
        await openTeamInvitation(router, item.params || {}, { backTo: "/notifications" });
      } catch (err) {
        Alert.alert(
          "Invitation",
          err?.message || "Could not open this team invitation.",
        );
      }
      return;
    }

    if (item.route === "/team/[teamId]") {
      router.push({
        pathname: item.route,
        params: { ...(item.params || {}), backTo: "/notifications" },
      });
      return;
    }
    if (item.route === "/tricount") {
      router.push({
        pathname: item.route,
        params: { ...(item.params || {}) },
      });
      return;
    }
    const postId = item.params?.postId || item.postId;
    if (
      item.type === "community" ||
      item.route === "/post/[postId]" ||
      postId
    ) {
      if (postId) {
        try {
          router.push({
            pathname: "/post/[postId]",
            params: { postId: String(postId), backTo: "/notifications" },
          });
        } catch {
          router.push(`/post/${postId}`);
        }
        return;
      }
      router.push({ pathname: "/posts", params: { backTo: "/notifications" } });
      return;
    }
    if (item.route) {
      router.push({
        pathname: item.route,
        params: { ...(item.params || {}) },
      });
    }
  };

  const handleDeleteNotification = async (item) => {
    await resolveNotificationOnDismiss(item, userId);
    await deleteNotificationById(item.id, userId);
    setNotifications((prev) => prev.filter((n) => n.id !== item.id));
    if (!item.isRead) setUnreadCount((c) => Math.max(0, c - 1));
    refreshNotificationBadge();
  };

  const handleClearAll = async () => {
    if (!notifications.length) return;
    await Promise.all(
      notifications.map((item) => resolveNotificationOnDismiss(item, userId)),
    );
    const ids = notifications.map((n) => n.id);
    await clearAllNotifications(ids, userId);
    setNotifications([]);
    setUnreadCount(0);
    refreshNotificationBadge();
  };

  // Track first paint so we never animate the initial batch — only new arrivals get motion.
  useEffect(() => {
    if (loading) return;
    if (initialRenderRef.current) {
      notifications.forEach((n) => knownIdsRef.current.add(n.id));
      initialRenderRef.current = false;
    }
  }, [loading, notifications]);

  const renderItem = ({ item }) => {
    const isNew = !initialRenderRef.current && !knownIdsRef.current.has(item.id);
    if (isNew) knownIdsRef.current.add(item.id);
    const Wrapper = isNew ? Animated.View : View;
    const enterAnim = isNew ? FadeInUp.duration(240).springify().damping(18) : undefined;
    return (
      <Wrapper entering={enterAnim} style={{ marginBottom: 12 }}>
        <NotificationCard
          item={item}
          onPress={() => handleOpenNotification(item)}
          onDelete={() => handleDeleteNotification(item)}
          T={T}
          isDark={isDark}
        />
      </Wrapper>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={["top"]}>
      <StatusBar barStyle={T.statusBar} />
      <TouchableOpacity
        onPress={() => goBackTo(router, backTo, BACK_TO_HOME)}
        style={styles.backRow}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={22} color={T.text} />
        <Text style={[styles.backLabel, { color: T.text }]}>{backLabel}</Text>
      </TouchableOpacity>

      <View style={styles.titleRow}>
        <View style={styles.titleWrap}>
          <Text style={[styles.pageTitle, { color: T.text }]}>Notifications</Text>
          {unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
        </View>
        <TouchableOpacity
          onPress={handleClearAll}
          disabled={!notifications.length}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text
            style={[
              styles.clearAll,
              { color: notifications.length ? T.textDim : T.textMuted },
            ]}
          >
            Clear all
          </Text>
        </TouchableOpacity>
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ marginBottom: 12 }}>
              <SkeletonNotifItem T={T} isDark={isDark} />
            </View>
          ))}
        </View>
      ) : (
        <FlashList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          estimatedItemSize={132}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[T.refresh]}
              tintColor={T.refresh}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor: T.surface,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: T.border,
                    shadowOpacity: isDark ? 0 : 0.05,
                    elevation: isDark ? 0 : 2,
                  },
                ]}
              >
                <Ionicons name="notifications-outline" size={40} color={T.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: T.text }]}>All caught up</Text>
              <Text style={[styles.emptyBody, { color: T.textMuted }]}>
                You have no notifications right now.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 2,
  },
  backLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    marginTop: 4,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    marginTop: 6,
  },
  clearAll: {
    fontSize: 15,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    paddingTop: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 6,
  },
  cardMessage: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "400",
  },
  swipeDelete: {
    width: 72,
    marginBottom: 0,
    borderRadius: 18,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});

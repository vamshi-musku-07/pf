import { isCommunityPushNotification } from "@/lib/communityNotifications";

/**
 * Normalize Expo / FCM payload shapes so deep links keep working whether
 * data lives at the root or nested under `data`.
 */
export const normalizeNotificationData = (raw = {}) => {
  if (!raw || typeof raw !== "object") return {};
  const nested =
    raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? raw.data
      : {};
  return { ...nested, ...raw };
};

const getPostId = (data = {}) => {
  const value = data.postId || data.post_id || data.sourcePostId;
  if (value == null || value === "") return "";
  return String(value);
};

/**
 * Deep link target for a push payload.
 *
 * Shared by the foreground tap listener and the cold-start handler so a
 * notification always lands on the same screen.
 */
export const getNotificationRoute = (rawData = {}) => {
  const data = normalizeNotificationData(rawData);
  if (!data || typeof data !== "object") return null;

  const postId = getPostId(data);
  if (
    postId &&
    (isCommunityPushNotification(data) ||
      data.channelId === "community" ||
      data.screen === "post" ||
      String(data.type || "").startsWith("community_"))
  ) {
    return {
      pathname: "/post/[postId]",
      params: { postId, backTo: "/notifications" },
    };
  }
  if (data.type === "community_team_digest" || data.channelId === "community") {
    return { pathname: "/posts", params: { backTo: "/notifications" } };
  }
  if (data.type === "tournament_invite" && data.inviteId) {
    return {
      pathname: "/tournament-invite/[inviteId]",
      params: { inviteId: String(data.inviteId), backTo: "/(tabs)/invitations" },
    };
  }
  if (data.groupId) {
    return { pathname: "/tricount", params: { groupId: String(data.groupId) } };
  }
  if (data.teamId) {
    const params = { teamId: String(data.teamId) };
    const tab = data.initialTab || data.screen;
    if (tab && tab !== "post") params.initialTab = String(tab);
    if (data.gameId) params.gameId = String(data.gameId);
    return { pathname: "/team/[teamId]", params };
  }
  if (data.screen && data.screen !== "post") {
    return { pathname: String(data.screen), params: {} };
  }
  if (data.deepLink) return { pathname: String(data.deepLink), params: {} };

  return null;
};

export const openNotificationRoute = (router, data) => {
  const target = getNotificationRoute(data);
  if (!target) return false;
  try {
    router.push(target);
    return true;
  } catch {
    try {
      // Fallback for dynamic segments that fail with object form.
      if (target.pathname === "/post/[postId]" && target.params?.postId) {
        router.push(`/post/${target.params.postId}`);
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }
};

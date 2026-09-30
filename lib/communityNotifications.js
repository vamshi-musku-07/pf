const COMMUNITY_PUSH_TYPES = new Set([
  "community_kudos",
  "community_comment",
  "community_comment_reply",
  "community_mention",
  "community_team_tag",
  "community_teammate_post",
  "community_trending",
  "community_team_digest",
]);

export const isCommunityPushNotification = (data = {}) => {
  if (!data || typeof data !== "object") return false;
  if (COMMUNITY_PUSH_TYPES.has(String(data.type || ""))) return true;
  return data.channelId === "community" && Boolean(data.postId);
};

const visualsForType = (type) => {
  switch (type) {
    case "community_kudos":
      return { icon: "heart", iconBg: "#FEE2E2", iconColor: "#DC2626" };
    case "community_comment":
    case "community_comment_reply":
      return { icon: "chatbubble-ellipses", iconBg: "#DBEAFE", iconColor: "#1D4ED8" };
    case "community_mention":
      return { icon: "at", iconBg: "#EDE9FE", iconColor: "#6D28D9" };
    case "community_team_tag":
      return { icon: "pricetag", iconBg: "#FEF3C7", iconColor: "#B45309" };
    case "community_trending":
      return { icon: "flame", iconBg: "#FFEDD5", iconColor: "#EA580C" };
    default:
      return { icon: "newspaper", iconBg: "#F0FDF4", iconColor: "#15803D" };
  }
};

/** Stable id so the same push is not listed twice across refreshes. */
const getDedupeKey = (item) => {
  const data = item?.data || {};
  const type = String(data.type || "community");
  const postId = String(data.postId || "");
  const commentId = String(data.commentId || "");
  const title = String(item?.title || "").trim();
  if (!title && !postId) return "";
  return `${type}:${postId}:${commentId}:${title}`;
};

/**
 * Community pushes live in the shared notification inbox; map them to the
 * feed card shape used by the notifications screen so a tap can deep link
 * straight to the post.
 */
export const inboxItemToCommunityNotification = (item) => {
  const data = item?.data || {};
  const type = String(data.type || "community");
  const postId = data.postId
    ? String(data.postId)
    : data.post_id
      ? String(data.post_id)
      : "";
  const dedupeKey = getDedupeKey(item);

  return {
    id: dedupeKey ? `community_${dedupeKey}` : item.id || `community_${type}_${item.createdAt}`,
    type: "community",
    ...visualsForType(type),
    title: item.title,
    body: item.body || "",
    time: item.createdAt,
    route: postId ? "/post/[postId]" : "/posts",
    params: postId ? { postId, backTo: "/notifications" } : { backTo: "/notifications" },
    postId: postId || undefined,
  };
};

export const buildCommunityInboxNotifications = (items = []) => {
  const map = new Map();

  for (const item of items) {
    if (!item?.title) continue;
    if (!isCommunityPushNotification(item?.data)) continue;
    const mapped = inboxItemToCommunityNotification(item);
    if (!map.has(mapped.id)) map.set(mapped.id, mapped);
  }

  return Array.from(map.values());
};

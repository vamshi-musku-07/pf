/**
 * Build liker avatar stack + Strava-style kudos copy.
 */

export const formatKudosLabel = ({ likedByMe, likeCount }) => {
  const count = Number(likeCount) || 0;
  if (count <= 0) return "Be the first to give kudos";
  if (likedByMe) {
    if (count === 1) return "You gave kudos";
    const others = count - 1;
    return `You and ${others} other${others === 1 ? "" : "s"} gave kudos`;
  }
  if (count === 1) return "1 person gave kudos";
  return `${count} people gave kudos`;
};

export const orderLikerIdsForStack = (recentLikerIds = [], viewerId, limit = 3) => {
  const ids = (recentLikerIds || []).map(String).filter(Boolean);
  const ordered = [];
  const me = viewerId ? String(viewerId) : "";
  if (me && ids.includes(me)) ordered.push(me);
  for (const id of ids) {
    if (ordered.length >= limit) break;
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered.slice(0, limit);
};

export const resolveProfileAvatar = (userId, profileMap = {}, me = null) => {
  const id = String(userId || "");
  const fromMap =
    profileMap[id]?.profilePicture ||
    profileMap[id]?.profileImage ||
    profileMap[id]?.avatar ||
    "";
  if (fromMap) return String(fromMap);
  const myId = String(me?._id || me?.id || me?.userId || "");
  if (id && myId && id === myId) {
    return me?.profilePicture || me?.profileImage || me?.avatar || "";
  }
  return "";
};

export const resolveProfileName = (userId, profileMap = {}, me = null) => {
  const id = String(userId || "");
  const fromMap =
    profileMap[id]?.username || profileMap[id]?.fullname || profileMap[id]?.name || "";
  if (fromMap) return String(fromMap);
  const myId = String(me?._id || me?.id || me?.userId || "");
  if (id && myId && id === myId) {
    return me?.username || me?.fullname || me?.name || "You";
  }
  return "";
};

export const buildRecentLikers = (recentLikerIds, profileMap, me, viewerId) => {
  const ids = orderLikerIdsForStack(recentLikerIds, viewerId, 3);
  return ids.map((id) => ({
    id,
    avatar: resolveProfileAvatar(id, profileMap, me),
    name: resolveProfileName(id, profileMap, me),
  }));
};

/** Optimistic liker stack when toggling kudos. */
export const optimisticRecentLikers = ({
  recentLikers = [],
  likedByMe,
  me,
  viewerId,
}) => {
  const myId = String(viewerId || me?._id || me?.id || me?.userId || "");
  const myAvatar =
    me?.profilePicture || me?.profileImage || me?.avatar || "";
  const withoutMe = (recentLikers || []).filter((l) => String(l.id) !== myId);
  if (!likedByMe) return withoutMe.slice(0, 3);
  return [
    { id: myId, avatar: myAvatar, name: "You" },
    ...withoutMe,
  ].slice(0, 3);
};

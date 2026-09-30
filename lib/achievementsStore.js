import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACHIEVEMENT_BADGES } from "@/lib/achievementBadges";

const STORAGE_KEY = "@playflash/earned_badges_v1";

let memoryCache = null;

const readStore = async () => {
  if (memoryCache) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    memoryCache = raw ? JSON.parse(raw) : {};
  } catch {
    memoryCache = {};
  }
  return memoryCache;
};

const writeStore = async (data) => {
  memoryCache = data;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

/** @returns {Promise<Record<string, string>>} map of badgeId -> ISO earnedAt */
export const getEarnedBadgesMap = async () => readStore();

export const getEarnedBadgeIds = async () => Object.keys(await readStore());

export const isBadgeEarned = async (badgeId) => {
  const map = await readStore();
  return Boolean(map[badgeId]);
};

/**
 * Unlock one or more badges. Returns newly unlocked ids.
 * @param {string|string[]} badgeIds
 */
export const unlockBadges = async (badgeIds) => {
  const ids = Array.isArray(badgeIds) ? badgeIds : [badgeIds];
  const map = { ...(await readStore()) };
  const unlocked = [];
  const now = new Date().toISOString();
  ids.forEach((id) => {
    if (!id || map[id]) return;
    if (!ACHIEVEMENT_BADGES.some((b) => b.id === id)) return;
    map[id] = now;
    unlocked.push(id);
  });
  if (unlocked.length) await writeStore(map);
  return unlocked;
};

export const resetEarnedBadges = async () => {
  memoryCache = {};
  await AsyncStorage.removeItem(STORAGE_KEY);
};

/**
 * Sync unlocks from lightweight activity signals.
 * Call from profile / trophies screens.
 */
export const syncAchievementUnlocks = async ({
  hasCommunityPost = false,
  matchCount = 0,
  likeCountReceived = 0,
  followerCount = 0,
  hasLoggedActivity = false,
} = {}) => {
  const toUnlock = inferBadgeIdsFromSignals({
    hasCommunityPost,
    matchCount,
    likeCountReceived,
    followerCount,
    hasLoggedActivity,
  });
  return unlockBadges(toUnlock);
};

/** Pure inference — does not persist (safe for viewing other profiles). */
export const inferBadgeIdsFromSignals = ({
  hasCommunityPost = false,
  matchCount = 0,
  likeCountReceived = 0,
  followerCount = 0,
  hasLoggedActivity = false,
} = {}) => {
  const ids = [];
  if (hasCommunityPost) ids.push("first_post");
  if (hasLoggedActivity || matchCount > 0) ids.push("first_match");
  if (matchCount >= 100) ids.push("matches_100");
  if (likeCountReceived >= 1000) ids.push("fan_favorite");
  if (followerCount >= 50) ids.push("influencer");
  return ids;
};

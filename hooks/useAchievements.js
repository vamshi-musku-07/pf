import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Asset } from "expo-asset";
import {
  getEarnedBadgesMap,
  syncAchievementUnlocks,
} from "@/lib/achievementsStore";
import {
  ACHIEVEMENT_BADGES,
  TROPHY_CASE_FEATURED_IDS,
  BADGE_BY_ID,
} from "@/lib/achievementBadges";
import { BADGE_IMAGES } from "@/lib/badgeImages";
import { listCommunityPostsAPI } from "@/services/CommunityPostApi";
import { useBackendAuth } from "@/context/BackendAuthContext";

let badgesPrefetched = false;

/** Warm Metro asset cache for featured (and optionally all) badge stickers. */
export async function prefetchBadgeAssets({ all = false } = {}) {
  if (badgesPrefetched && !all) return;
  const ids = all
    ? Object.keys(BADGE_IMAGES)
    : TROPHY_CASE_FEATURED_IDS.filter((id) => BADGE_IMAGES[id]);
  const modules = ids.map((id) => BADGE_IMAGES[id]).filter(Boolean);
  if (!modules.length) return;
  try {
    await Asset.loadAsync(modules);
    if (!all) badgesPrefetched = true;
  } catch {
    // non-blocking
  }
}

/**
 * Instant local unlock map + background sync. Badges render immediately.
 */
export function useAchievements() {
  const { backendUser, isSignedIn } = useBackendAuth();
  const [earnedMap, setEarnedMap] = useState({});
  const [loading, setLoading] = useState(true);

  const myId = String(
    backendUser?._id || backendUser?.id || backendUser?.userId || "",
  );

  const loadLocal = useCallback(async () => {
    if (!isSignedIn) {
      setEarnedMap({});
      setLoading(false);
      return;
    }
    // Prefetch featured stickers in parallel with storage read
    prefetchBadgeAssets({ all: false });
    try {
      const map = await getEarnedBadgesMap();
      setEarnedMap(map || {});
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  const syncRemote = useCallback(async () => {
    if (!isSignedIn || !myId) return;
    try {
      let hasCommunityPost = false;
      let likeCountReceived = 0;
      try {
        const res = await listCommunityPostsAPI({
          page: 1,
          limit: 20,
          authorId: myId,
        });
        const mine = res?.data || [];
        hasCommunityPost = mine.length > 0;
        likeCountReceived = mine.reduce(
          (sum, p) => sum + (Number(p.likeCount) || 0),
          0,
        );
      } catch {
        // ignore
      }

      await syncAchievementUnlocks({
        hasCommunityPost,
        likeCountReceived,
        hasLoggedActivity: false,
        matchCount: 0,
      });
      const map = await getEarnedBadgesMap();
      setEarnedMap(map || {});
    } catch {
      // keep local map
    }
  }, [isSignedIn, myId]);

  const refresh = useCallback(async () => {
    await loadLocal();
    await syncRemote();
  }, [loadLocal, syncRemote]);

  useFocusEffect(
    useCallback(() => {
      loadLocal();
      // network sync after paint — don't block trophy UI
      const t = setTimeout(() => {
        syncRemote();
      }, 0);
      return () => clearTimeout(t);
    }, [loadLocal, syncRemote]),
  );

  const isEarned = useCallback(
    (badgeId) => Boolean(earnedMap[badgeId]),
    [earnedMap],
  );

  const earnedBadges = ACHIEVEMENT_BADGES.filter((b) => earnedMap[b.id]);

  const caseSlots = TROPHY_CASE_FEATURED_IDS.map((id) => ({
    badge: BADGE_BY_ID[id],
    earned: Boolean(earnedMap[id]),
  })).filter((s) => s.badge);

  return {
    loading,
    earnedMap,
    earnedBadges,
    isEarned,
    caseSlots,
    refresh,
  };
}

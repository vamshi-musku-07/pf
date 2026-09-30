import { useCallback, useEffect, useState } from "react";
import { listFollowsAPI } from "@/services/CommunityPostApi";

/**
 * Following feed scope: only users the viewer explicitly follows.
 * Teammates / team rosters are not auto-included (Discover covers that).
 */
export function useFeedAuthorScope(isSignedIn) {
  const [followedUserIds, setFollowedUserIds] = useState(() => new Set());
  const [ready, setReady] = useState(false);

  const refreshScope = useCallback(async () => {
    if (!isSignedIn) {
      setFollowedUserIds(new Set());
      setReady(true);
      return;
    }

    try {
      const followsRes = await listFollowsAPI({ limit: 200 }).catch(() => ({
        data: [],
      }));
      const follows = followsRes?.data || [];
      const followedUsers = new Set(
        follows
          .filter((f) => f.targetType === "user")
          .map((f) => String(f.targetId)),
      );
      setFollowedUserIds(followedUsers);
    } catch {
      setFollowedUserIds(new Set());
    } finally {
      setReady(true);
    }
  }, [isSignedIn]);

  useEffect(() => {
    refreshScope();
  }, [refreshScope]);

  return {
    includeAuthorIds: "",
    followedUserIds,
    followedCount: followedUserIds.size,
    ready,
    refreshScope,
  };
}

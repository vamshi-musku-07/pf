import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { getMyStreakAPI, pingStreakAPI } from "@/services/StreakApi";
import {
  cacheStreakPayload,
  readCachedStreakPayload,
  normalizeStreakPayload,
} from "@/lib/streakSync";
import {
  recordStreakActivity as recordLocalStreak,
  getStreakDaysMap,
} from "@/lib/streakStore";

const emptyState = () => normalizeStreakPayload({ activeDays: {}, dayStreak: 0, monthActivities: 0 });

/**
 * Server-backed streak with local cache.
 */
export function useStreak() {
  const { isSignedIn } = useBackendAuth();
  const [state, setState] = useState(emptyState);
  const [loading, setLoading] = useState(true);

  const applyPayload = useCallback((payload) => {
    const next = normalizeStreakPayload(payload || {});
    setState(next);
    return next;
  }, []);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setState(emptyState());
      setLoading(false);
      return;
    }

    // Fast paint from cache
    const cached = await readCachedStreakPayload();
    if (cached?.activeDays) {
      applyPayload(cached);
    }

    try {
      const res = await getMyStreakAPI();
      const data = res?.data;
      if (data && typeof data === "object") {
        applyPayload(data);
        await cacheStreakPayload(data);
      }
    } catch {
      // keep cache / empty
      if (!cached) {
        try {
          const localDays = await getStreakDaysMap();
          applyPayload({ activeDays: localDays });
        } catch {
          // ignore
        }
      }
    } finally {
      setLoading(false);
    }
  }, [applyPayload, isSignedIn]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  /** Record today (server + local). Idempotent. */
  const ping = useCallback(async (source = "client_ping") => {
    try {
      await recordLocalStreak();
    } catch {
      // ignore
    }
    try {
      const res = await pingStreakAPI(source);
      const data = res?.data;
      if (data) {
        applyPayload(data);
        await cacheStreakPayload(data);
        return;
      }
    } catch {
      // offline: local only
    }
    await refresh();
  }, [applyPayload, refresh]);

  return {
    loading,
    daysMap: state.daysMap,
    dayStreak: state.dayStreak,
    weekStreak: state.dayStreak,
    monthActivities: state.monthActivities,
    monthCells: state.monthCells,
    monthTitle: state.monthTitle,
    year: state.year,
    monthIndex: state.monthIndex,
    todayKey: state.todayKey,
    timezone: state.timezone,
    refresh,
    ping,
  };
}

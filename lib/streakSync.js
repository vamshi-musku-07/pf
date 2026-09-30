import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  computeDayStreak,
  countActivitiesInMonth,
  buildMonthGrid,
  monthLabel,
  toDateKey,
} from "@/lib/streakStore";

const CACHE_KEY = "@playflash/streak_cache_v2";

/** Persist last known server streak for offline/fast paint. */
export const cacheStreakPayload = async (payload) => {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...payload, cachedAt: new Date().toISOString() }),
    );
  } catch {
    // ignore
  }
};

export const readCachedStreakPayload = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Normalize API / cache into UI-ready streak state.
 */
export const normalizeStreakPayload = (payload, now = new Date()) => {
  const daysMap = { ...(payload?.activeDays || {}) };
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const dayStreak =
    typeof payload?.dayStreak === "number"
      ? payload.dayStreak
      : typeof payload?.weekStreak === "number"
        ? payload.weekStreak
        : computeDayStreak(daysMap, now);
  const monthActivities =
    typeof payload?.monthActivities === "number"
      ? payload.monthActivities
      : countActivitiesInMonth(daysMap, year, monthIndex);

  return {
    daysMap,
    dayStreak,
    /** @deprecated alias */
    weekStreak: dayStreak,
    monthActivities,
    monthCells: buildMonthGrid(year, monthIndex, now),
    monthTitle: monthLabel(year, monthIndex),
    year,
    monthIndex,
    todayKey: payload?.todayKey || toDateKey(now),
    timezone: payload?.timezone || "UTC",
  };
};

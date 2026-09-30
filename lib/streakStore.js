import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@playflash/streak_v1";

/** @type {{ days: Record<string, true> } | null} */
let memoryCache = null;

const pad = (n) => String(n).padStart(2, "0");

/** Local calendar date key YYYY-MM-DD */
export const toDateKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const parseDateKey = (key) => {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Monday-start week id: YYYY-Www via Monday's date key */
export const weekStartKey = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateKey(d);
};

const addDays = (date, n) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
};

const readStore = async () => {
  if (memoryCache) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    memoryCache = raw ? JSON.parse(raw) : { days: {} };
    if (!memoryCache.days || typeof memoryCache.days !== "object") {
      memoryCache = { days: {} };
    }
  } catch {
    memoryCache = { days: {} };
  }
  return memoryCache;
};

const writeStore = async (data) => {
  memoryCache = data;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

/** Mark today (or a given day) as an active streak day. Returns whether newly added. */
export const recordStreakActivity = async (date = new Date()) => {
  const key = toDateKey(date);
  const store = { ...(await readStore()) };
  store.days = { ...(store.days || {}) };
  if (store.days[key]) return false;
  store.days[key] = true;
  await writeStore(store);
  return true;
};

/** Clear all streak activity (testing). */
export const clearStreakActivity = async () => {
  await writeStore({ days: {} });
};

/**
 * Seed a realistic demo streak for UI testing:
 * - activity most days recently so day streak looks non-zero
 */
export const seedDemoStreak = async (now = new Date()) => {
  const days = {};
  // Last ~12 days with a few gaps so it looks real
  for (let i = 0; i < 14; i += 1) {
    if (i > 3 && i % 4 === 0) continue;
    const d = addDays(now, -i);
    days[toDateKey(d)] = true;
  }
  // Always include today
  days[toDateKey(now)] = true;
  await writeStore({ days });
  return days;
};

export const getStreakDaysMap = async () => {
  const store = await readStore();
  return { ...(store.days || {}) };
};

/**
 * Consecutive calendar days with activity (production-style).
 * Today counts if active; otherwise yesterday can keep the streak alive until midnight.
 */
export const computeDayStreak = (daysMap, now = new Date()) => {
  const days = daysMap || {};
  let cursor = toDateKey(now);

  if (!days[cursor]) {
    cursor = toDateKey(addDays(now, -1));
    if (!days[cursor]) return 0;
  }

  let streak = 0;
  while (days[cursor]) {
    streak += 1;
    cursor = toDateKey(addDays(parseDateKey(cursor), -1));
    if (streak > 4000) break;
  }
  return streak;
};

/** @deprecated Use computeDayStreak */
export const computeWeekStreak = computeDayStreak;

export const countActivitiesInMonth = (daysMap, year, monthIndex) => {
  const days = daysMap || {};
  let count = 0;
  const prefix = `${year}-${pad(monthIndex + 1)}-`;
  Object.keys(days).forEach((key) => {
    if (key.startsWith(prefix) && days[key]) count += 1;
  });
  return count;
};

/** Build month cells for calendar (Mon-first). */
export const buildMonthGrid = (year, monthIndex, now = new Date()) => {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDow = first.getDay(); // 0 Sun
  const mondayOffset = firstDow === 0 ? 6 : firstDow - 1;

  const todayKey = toDateKey(now);
  const cells = [];

  // Leading days from previous month
  for (let i = 0; i < mondayOffset; i += 1) {
    const d = addDays(first, -(mondayOffset - i));
    cells.push({
      date: d,
      key: toDateKey(d),
      day: d.getDate(),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, monthIndex, day);
    cells.push({
      date: d,
      key: toDateKey(d),
      day,
      inMonth: true,
    });
  }

  // Trailing to complete weeks (rows of 7)
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const d = addDays(last, 1);
    cells.push({
      date: d,
      key: toDateKey(d),
      day: d.getDate(),
      inMonth: false,
    });
  }

  return cells.map((c) => {
    const isToday = c.key === todayKey;
    const isFuture = c.date > now && !isToday;
    const isPast = c.date < now && !isToday;
    return { ...c, isToday, isFuture, isPast };
  });
};

export const monthLabel = (year, monthIndex) => {
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${names[monthIndex]} ${year}`;
};

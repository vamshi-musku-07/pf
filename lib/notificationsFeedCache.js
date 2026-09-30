import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_BASE = "cache:notifications_feed_v1";
const TTL_MS = 60 * 1000; // 1 minute — feed is dynamic but rebuilds are expensive

const memory = new Map(); // userId → { items, ts }

const keyFor = (userId) => `${STORAGE_KEY_BASE}:${userId || "anon"}`;

export function readMemoryNotificationsCache(userId) {
  const entry = memory.get(userId || "anon");
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) return null;
  return entry.items;
}

export function writeMemoryNotificationsCache(userId, items) {
  memory.set(userId || "anon", { items, ts: Date.now() });
}

export async function readNotificationsCache(userId) {
  const mem = readMemoryNotificationsCache(userId);
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const { items, ts } = JSON.parse(raw);
    if (!Array.isArray(items)) return null;
    // Even if disk cache is stale, expose it so the page can render instantly;
    // the caller is expected to revalidate in the background.
    writeMemoryNotificationsCache(userId, items);
    if (Date.now() - ts > TTL_MS) return items; // stale-while-revalidate
    return items;
  } catch {
    return null;
  }
}

export function isNotificationsCacheFresh(userId) {
  const entry = memory.get(userId || "anon");
  if (!entry) return false;
  return Date.now() - entry.ts <= TTL_MS;
}

export async function writeNotificationsCache(userId, items) {
  writeMemoryNotificationsCache(userId, items);
  try {
    await AsyncStorage.setItem(
      keyFor(userId),
      JSON.stringify({ items, ts: Date.now() }),
    );
  } catch {
    /* non-fatal */
  }
}

export async function clearNotificationsCache(userId) {
  memory.delete(userId || "anon");
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    /* non-fatal */
  }
}

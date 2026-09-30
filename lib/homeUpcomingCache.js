import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cache:home_upcoming_cards_v5";
const TTL_MS = 2 * 60 * 1000; // 2 minutes

let memory = { cards: null, ts: 0 };

export function readMemoryUpcomingCache() {
  if (!memory.cards || Date.now() - memory.ts > TTL_MS) return null;
  return memory.cards;
}

export function writeMemoryUpcomingCache(cards) {
  memory = { cards, ts: Date.now() };
}

export async function readUpcomingCache() {
  const mem = readMemoryUpcomingCache();
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { cards, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) return null;
    if (!Array.isArray(cards)) return null;
    writeMemoryUpcomingCache(cards);
    return cards;
  } catch {
    return null;
  }
}

export async function writeUpcomingCache(cards) {
  writeMemoryUpcomingCache(cards);
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ cards, ts: Date.now() }),
    );
  } catch {
    /* non-fatal */
  }
}

export function isCacheFresh() {
  return Boolean(memory.cards && Date.now() - memory.ts <= TTL_MS);
}

export async function clearUpcomingCache() {
  memory = { cards: null, ts: 0 };
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}

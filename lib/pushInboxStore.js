import * as SecureStore from "expo-secure-store";
import { getNotificationUserId } from "@/lib/notificationsStore";
import { getTricountInboxDedupeKey } from "@/lib/tricountNotifications";

const PUSH_INBOX_KEY = "push_inbox_items";
const MAX_ITEMS = 80;

const scopeKey = (userId) => `${PUSH_INBOX_KEY}_${userId}`;

const getItem = async (key) => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const setItem = async (key, value) => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {}
};

const parseList = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const appendPushInboxItem = async (backendUser, notification) => {
  const userId = getNotificationUserId(backendUser);
  if (!userId) return;

  const title = String(notification?.title || "").trim();
  if (!title) return;

  const data = notification?.data || {};
  const createdAt = notification?.createdAt || new Date().toISOString();

  const entry = {
    id: notification?.id,
    title,
    body: String(notification?.body || "").trim(),
    data: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value)])
    ),
    createdAt,
  };

  const dedupeKey = getTricountInboxDedupeKey(entry);
  entry.id = dedupeKey ? `tricount_${dedupeKey}` : `push_${Date.now()}`;

  const key = scopeKey(userId);
  const current = parseList(await getItem(key));
  const next = [
    entry,
    ...current.filter((item) => getTricountInboxDedupeKey(item) !== dedupeKey && item?.id !== entry.id),
  ].slice(0, MAX_ITEMS);
  await setItem(key, JSON.stringify(next));
};

export const getPushInboxItems = async (backendUser) => {
  const userId = getNotificationUserId(backendUser);
  if (!userId) return [];
  return parseList(await getItem(scopeKey(userId)));
};

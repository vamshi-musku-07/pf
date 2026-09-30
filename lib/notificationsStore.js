import * as SecureStore from "expo-secure-store";

const READ_IDS_KEY = "notifications_read_ids";
const DELETED_IDS_KEY = "notifications_deleted_ids";
const NOTIFICATIONS_ENABLED_KEY = "notifications_enabled";

export const getNotificationUserId = (backendUser) => {
  const id = backendUser?.id || backendUser?._id || backendUser?.userId;
  return id ? String(id) : null;
};

const scopeKey = (baseKey, userId) => (userId ? `${baseKey}_${userId}` : baseKey);

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

const deleteItem = async (key) => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {}
};

const parseArray = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const unique = (arr) => Array.from(new Set(arr));

const migrateLegacyIds = async (baseKey, userId) => {
  if (!userId) return;
  const scopedKey = scopeKey(baseKey, userId);
  const scopedRaw = await getItem(scopedKey);
  if (scopedRaw) return;

  const legacyRaw = await getItem(baseKey);
  if (!legacyRaw) return;

  await setItem(scopedKey, legacyRaw);
};

export const getReadNotificationIds = async (userId) => {
  await migrateLegacyIds(READ_IDS_KEY, userId);
  const raw = await getItem(scopeKey(READ_IDS_KEY, userId));
  return parseArray(raw);
};

export const getDeletedNotificationIds = async (userId) => {
  await migrateLegacyIds(DELETED_IDS_KEY, userId);
  const raw = await getItem(scopeKey(DELETED_IDS_KEY, userId));
  return parseArray(raw);
};

export const markNotificationRead = async (id, userId) => {
  const current = await getReadNotificationIds(userId);
  const next = unique([...current, id]);
  await setItem(scopeKey(READ_IDS_KEY, userId), JSON.stringify(next));
  return next;
};

export const deleteNotificationById = async (id, userId) => {
  const current = await getDeletedNotificationIds(userId);
  const next = unique([...current, id]);
  await setItem(scopeKey(DELETED_IDS_KEY, userId), JSON.stringify(next));
  return next;
};

export const clearAllNotifications = async (ids = [], userId) => {
  if (!ids.length) return [];
  const current = await getDeletedNotificationIds(userId);
  const next = unique([...current, ...ids]);
  await setItem(scopeKey(DELETED_IDS_KEY, userId), JSON.stringify(next));
  return next;
};

export const markAllNotificationsRead = async (ids = [], userId) => {
  if (!ids.length) return [];
  const current = await getReadNotificationIds(userId);
  const next = unique([...current, ...ids]);
  await setItem(scopeKey(READ_IDS_KEY, userId), JSON.stringify(next));
  return next;
};

export const clearNotificationStoreForUser = async (userId) => {
  if (!userId) return;
  await Promise.all([
    deleteItem(scopeKey(READ_IDS_KEY, userId)),
    deleteItem(scopeKey(DELETED_IDS_KEY, userId)),
  ]);
};

export const filterNotificationsByStore = async (notifications, userId) => {
  const [readIds, deletedIds] = await Promise.all([
    getReadNotificationIds(userId),
    getDeletedNotificationIds(userId),
  ]);

  const deletedSet = new Set(deletedIds);
  const readSet = new Set(readIds);

  const visible = notifications
    .filter((n) => !deletedSet.has(n.id))
    .map((n) => ({ ...n, isRead: readSet.has(n.id) }));

  return {
    notifications: visible,
    unreadCount: visible.filter((n) => !n.isRead).length,
  };
};

export const getNotificationsEnabled = async () => {
  const raw = await getItem(NOTIFICATIONS_ENABLED_KEY);
  if (raw === null || raw === undefined) return true;
  return raw !== "false";
};

export const setNotificationsEnabled = async (enabled) => {
  await setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? "true" : "false");
};

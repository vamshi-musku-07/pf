import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEYS = {
  ACCESS_TOKEN: "backend_access_token",
  REFRESH_TOKEN: "backend_refresh_token",
  USER: "backend_user",
};

const webMemoryStore = new Map();

const getWebSessionStorage = () => {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  return window.sessionStorage;
};

const getItem = async (key) => {
  try {
    if (Platform.OS === "web") {
      if (key === KEYS.REFRESH_TOKEN) {
        return webMemoryStore.get(key) ?? null;
      }

      const sessionStore = getWebSessionStorage();
      return sessionStore?.getItem(key) ?? webMemoryStore.get(key) ?? null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const setItem = async (key, value) => {
  try {
    if (Platform.OS === "web") {
      if (key === KEYS.REFRESH_TOKEN) {
        webMemoryStore.set(key, value);
        return;
      }

      const sessionStore = getWebSessionStorage();
      if (sessionStore) {
        sessionStore.setItem(key, value);
      } else {
        webMemoryStore.set(key, value);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Silently fail
  }
};

const deleteItem = async (key) => {
  try {
    if (Platform.OS === "web") {
      webMemoryStore.delete(key);
      const sessionStore = getWebSessionStorage();
      sessionStore?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Silently fail
  }
};

export const getAccessToken = () => getItem(KEYS.ACCESS_TOKEN);
export const setAccessToken = (token) => setItem(KEYS.ACCESS_TOKEN, token);

export const getRefreshToken = () => getItem(KEYS.REFRESH_TOKEN);
export const setRefreshToken = (token) => setItem(KEYS.REFRESH_TOKEN, token);

export const getBackendUser = async () => {
  const json = await getItem(KEYS.USER);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const setBackendUser = (user) =>
  setItem(KEYS.USER, JSON.stringify(user));

export const clearAllTokens = async () => {
  await Promise.all([
    deleteItem(KEYS.ACCESS_TOKEN),
    deleteItem(KEYS.REFRESH_TOKEN),
    deleteItem(KEYS.USER),
  ]);
};

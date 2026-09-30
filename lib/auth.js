import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Token cache for Clerk using expo-secure-store.
 * Persists auth tokens securely on device so users stay logged in.
 * Falls back gracefully on web where SecureStore isn't available.
 */
export const tokenCache = {
  async getToken(key) {
    try {
      if (Platform.OS === "web") return null;
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      if (Platform.OS === "web") return;
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Silently fail — token won't persist but app still works
    }
  },
};

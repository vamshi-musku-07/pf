import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Localization from "expo-localization";
import { Platform } from "react-native";
import Constants from "expo-constants";
import createApiService from "@/lib/apiService";
import { PLAYER_API_URL } from "@/config/api";
import { getNotificationsEnabled } from "@/lib/notificationsStore";

const playerApi = createApiService(PLAYER_API_URL);
let registerPromise = null;

const getDeviceTimezone = () => {
  try {
    return (
      Localization.getCalendars?.()?.[0]?.timeZone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC"
    );
  } catch {
    return "UTC";
  }
};

const RETRYABLE_PUSH_ERROR_PATTERN = /SERVICE_NOT_AVAILABLE|java\.io\.IOException|timeout|temporarily unavailable/i;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryablePushError = (error) => {
  const message = String(error?.message || error || "");
  return RETRYABLE_PUSH_ERROR_PATTERN.test(message);
};

const getTokenWithRetry = async (label, getter, attempts = 4) => {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getter();
    } catch (error) {
      lastError = error;

      if (!isRetryablePushError(error) || attempt === attempts) {
        throw error;
      }

      console.warn(
        `[PushNotifications] ${label} temporarily unavailable (${attempt}/${attempts}), retrying...`,
      );
      await wait(1000 * attempt);
    }
  }

  throw lastError;
};

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const enabled = await getNotificationsEnabled();
    return {
      shouldShowAlert: enabled,
      shouldPlaySound: enabled,
      shouldSetBadge: enabled,
    };
  },
});

const createAndroidChannels = async () => {
  const channels = [
    { id: "community", name: "Community", color: "#38BDF8" },
    { id: "assignments", name: "Assignments",    color: "#B7FF57" },
    { id: "events",     name: "Events",          color: "#BAF072" },
    { id: "groups",     name: "Bill Splitter",   color: "#9AEA62" },
    { id: "general",    name: "General",         color: "#9AEA62" },
    { id: "engagement", name: "Comebacks",       color: "#B7FF57" },
    { id: "competitive", name: "Leaderboards",   color: "#FACC15" },
    { id: "funny",      name: "Fun Nudges",      color: "#FB7185" },
    { id: "rewards",    name: "Rewards",         color: "#22C55E" },
    { id: "fomo",       name: "Don't Miss Out",  color: "#F97316" },
  ];
  for (const ch of channels) {
    await Notifications.setNotificationChannelAsync(ch.id, {
      name: ch.name,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: ch.color,
      sound: true,
    });
  }
};

export const registerForPushNotifications = async () => {
  if (registerPromise) {
    return registerPromise;
  }

  registerPromise = (async () => {
    if (!Device.isDevice) return null;

    const notificationsEnabled = await getNotificationsEnabled();
    if (!notificationsEnabled) {
      console.log("[PushNotifications] Notifications disabled by user — skipping registration.");
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      await createAndroidChannels();
    }

    const projectId =
      process.env.EXPO_PUBLIC_PROJECT_ID ||
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId;

    let expoToken = null;
    let fcmToken = null;

    console.log("[PushNotifications] Starting token fetch, projectId:", projectId);

    try {
      const tokenData = await getTokenWithRetry(
        "Expo token",
        () => Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined),
      );
      expoToken = tokenData?.data || null;
      console.log("[PushNotifications] Expo token:", expoToken ? expoToken.substring(0, 30) + "..." : "null");
    } catch (err) {
      console.warn("[PushNotifications] Expo token failed:", err.message);
    }

    try {
      const deviceToken = await getTokenWithRetry(
        "FCM device token",
        () => Notifications.getDevicePushTokenAsync(),
      );
      if (deviceToken?.data) {
        fcmToken = deviceToken.data;
      }
      console.log("[PushNotifications] FCM token:", fcmToken ? fcmToken.substring(0, 30) + "..." : "null");
    } catch (err) {
      console.warn("[PushNotifications] FCM device token failed:", err.message);
    }

    if (!expoToken && !fcmToken) {
      console.warn(
        "[PushNotifications] No push token could be fetched from the device. If this persists, check Google Play Services/network availability on Android.",
      );
      return null;
    }

    const payload = {
      lastAppOpenAt: new Date().toISOString(),
      timezone: getDeviceTimezone(),
    };
    if (expoToken) payload.pushToken = expoToken;
    if (fcmToken) payload.fcmToken = fcmToken;

    const MAX_ATTEMPTS = 3;
    let registered = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await wait(1000 * attempt);
      }
      try {
        await playerApi.post("/push-token", payload);
        registered = true;
        break;
      } catch (err) {
        if (attempt < MAX_ATTEMPTS - 1) {
          console.warn(
            `[PushNotifications] Token upload attempt ${attempt + 1}/${MAX_ATTEMPTS} failed, retrying:`,
            err.message,
          );
        } else {
          console.error(
            "[PushNotifications] Token upload failed after",
            MAX_ATTEMPTS,
            "attempts — user will NOT receive push notifications this session.",
            "\nError:", err.message,
            "\nStatus:", err.response?.status,
            "\nURL:", err.config?.url,
          );
        }
      }
    }

    if (!registered) {
      return expoToken || fcmToken;
    }

    return expoToken || fcmToken;
  })().finally(() => {
    registerPromise = null;
  });

  return registerPromise;
};

export const pingPushPresence = async () => {
  const notificationsEnabled = await getNotificationsEnabled();
  if (!notificationsEnabled) return;

  try {
    await playerApi.post("/push-token/heartbeat", {
      lastAppOpenAt: new Date().toISOString(),
      timezone: getDeviceTimezone(),
    });
  } catch {
    /* best-effort */
  }
};

export const showLocalNotification = async ({ title, body, data = {}, channelId = "general" }) => {
  const enabled = await getNotificationsEnabled();
  if (!enabled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      ...(Platform.OS === "android" && { channelId }),
    },
    trigger: null,
  });
};

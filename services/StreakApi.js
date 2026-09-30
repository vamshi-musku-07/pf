import createApiService from "@/lib/apiService";
import { PLAYER_API_URL } from "@/config/api";
import * as Localization from "expo-localization";

const playerApi = createApiService(PLAYER_API_URL);

export const getDeviceTimezone = () => {
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

/** GET /streak/me → { success, data } */
export const getMyStreakAPI = async () => {
  const timezone = getDeviceTimezone();
  const response = await playerApi.get("/streak/me", { params: { timezone } });
  return response.data;
};

/** GET /streak/:userId → { success, data } */
export const getUserStreakAPI = async (userId) => {
  const timezone = getDeviceTimezone();
  const response = await playerApi.get(
    `/streak/${encodeURIComponent(String(userId))}`,
    { params: { timezone } },
  );
  return response.data;
};

/** POST /streak/ping → { success, data } */
export const pingStreakAPI = async (source = "client_ping") => {
  const timezone = getDeviceTimezone();
  const response = await playerApi.post("/streak/ping", { timezone, source });
  return response.data;
};

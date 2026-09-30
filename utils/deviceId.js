// Stable per-install device id. Used by the server for idempotent
// (deviceId, clientSeq) dedupe of event batches.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "playflash.deviceId";
let cached = null;

function uuidv4() {
  // RFC4122 v4 — no crypto dep required
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId() {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
    const fresh = uuidv4();
    await AsyncStorage.setItem(KEY, fresh);
    cached = fresh;
    return fresh;
  } catch {
    cached = uuidv4(); // last-resort ephemeral id
    return cached;
  }
}

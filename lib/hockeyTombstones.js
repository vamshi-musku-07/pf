import AsyncStorage from "@react-native-async-storage/async-storage";

const storageKey = (gameId) => `hockey-card-tombstones:${gameId}`;

export async function loadHockeyTombstones(gameId) {
  if (!gameId) return [];
  try {
    const raw = await AsyncStorage.getItem(storageKey(gameId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function saveHockeyTombstones(gameId, fingerprints) {
  if (!gameId) return;
  const list = [...(fingerprints instanceof Set ? fingerprints : [])].filter(Boolean);
  await AsyncStorage.setItem(storageKey(gameId), JSON.stringify(list));
}

export async function addHockeyTombstone(gameId, fingerprint, refSet) {
  if (!gameId || !fingerprint) return;
  refSet.add(fingerprint);
  await saveHockeyTombstones(gameId, refSet);
}

export async function pruneHockeyTombstonesFromStorage(gameId, refSet, serverFingerprints = new Set()) {
  if (!gameId || !refSet?.size) return false;
  let changed = false;
  refSet.forEach((fingerprint) => {
    if (!serverFingerprints.has(fingerprint)) {
      refSet.delete(fingerprint);
      changed = true;
    }
  });
  if (changed) {
    await saveHockeyTombstones(gameId, refSet);
  }
  return changed;
}

export function logHockeyCardDebug(stage, payload = {}) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  console.log(`[HockeyCard][${stage}]`, payload);
}

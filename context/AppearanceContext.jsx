import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "playflash_appearance_mode";

/** @typedef {"light" | "dark"} AppearanceMode */

const AppearanceContext = createContext({
  mode: /** @type {AppearanceMode} */ ("light"),
  isDark: false,
  setMode: /** @type {(mode: AppearanceMode) => void} */ (() => {}),
  ready: false,
});

export function AppearanceProvider({ children }) {
  const [mode, setModeState] = useState(/** @type {AppearanceMode} */ ("light"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (stored === "light" || stored === "dark")) {
          setModeState(stored);
        }
      } catch {
        // keep default light
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next) => {
    const value = next === "dark" ? "dark" : "light";
    setModeState(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === "dark",
      setMode,
      ready,
    }),
    [mode, setMode, ready],
  );

  return (
    <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}

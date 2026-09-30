import { useCallback } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { StatusBar as ExpoStatusBar, setStatusBarStyle } from "expo-status-bar";

let SystemBars = null;
try {
  SystemBars = require("react-native-edge-to-edge").SystemBars;
} catch {
  // Native module available after dev-client rebuild with react-native-edge-to-edge plugin.
}

/**
 * Forces light status-bar icons (battery, WiFi, time) on dark headers.
 * Works across Android OEMs with edge-to-edge enabled — RN StatusBar alone is unreliable.
 */
export default function LightOnDarkStatusBar({ restoreStyle = "dark" }) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => {
        setStatusBarStyle(restoreStyle);
      };
    }, [restoreStyle]),
  );

  if (SystemBars) {
    return (
      <SystemBars
        style={{
          statusBar: "light",
          navigationBar: Platform.OS === "android" ? "dark" : undefined,
        }}
      />
    );
  }

  return <ExpoStatusBar style="light" translucent />;
}

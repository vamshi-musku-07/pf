/**
 * Dynamic Expo config for EAS builds.
 * Local `.env` is gitignored — EAS cloud builds only see vars from:
 *   EAS Dashboard → Environment variables (preview / production), or
 *   `.\scripts\push-eas-preview-env.ps1 -Environment preview|production`
 *
 * @see eas.env.example
 */
const path = require("path");
const appJson = require("./app.json");

// EAS CLI runs `expo config` before Expo loads .env — load it here so local
// `eas build` picks up the same EXPO_PUBLIC_* URLs as `npx expo start`.
try {
  const { load } = require("@expo/env");
  load(path.resolve(__dirname));
} catch {
  // @expo/env ships with expo; ignore if unavailable
}

const REQUIRED_API_ENV_KEYS = [
  "EXPO_PUBLIC_AUTH_API_URL",
  "EXPO_PUBLIC_TEAM_API_URL",
  "EXPO_PUBLIC_PLAYER_API_URL",
  "EXPO_PUBLIC_SCHEDULE_API_URL",
  "EXPO_PUBLIC_EVENT_API_URL",
  "EXPO_PUBLIC_GAME_API_URL",
  "EXPO_PUBLIC_COMMUNITY_POST_API_URL",
];

const REQUIRED_GOOGLE_ENV_KEYS = [
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
];

module.exports = () => {
  const profile =
    process.env.EAS_BUILD_PROFILE || process.env.APP_ENV || "development";
  const isEasCloud = Boolean(process.env.EAS_BUILD_ID);

  // Only validate on EAS cloud (no .env file). Skip for local `eas build` / `eas env:push`.
  if (isEasCloud && profile !== "development") {
    const missing = [...REQUIRED_API_ENV_KEYS, ...REQUIRED_GOOGLE_ENV_KEYS].filter(
      (key) => !String(process.env[key] || "").trim(),
    );
    if (missing.length > 0) {
      const hint = isEasCloud
        ? `Set them in EAS Dashboard → Environment variables (${profile}), or run:\n  .\\scripts\\push-eas-preview-env.ps1 -Environment ${profile}`
        : `Ensure play_flash_application/app/.env defines them, or push to EAS:\n  .\\scripts\\push-eas-preview-env.ps1 -Environment ${profile}`;
      throw new Error(
        `[PlayFlash] EAS build profile "${profile}" is missing API URLs:\n` +
          `${missing.map((k) => `  - ${k}`).join("\n")}\n\n` +
          `${hint}\n\n` +
          "Use the same backend hosts where you deployed the latest team, event, and schedule services.",
      );
    }
  }

  const isReleaseApkProfile = ["preview", "production-apk"].includes(profile);
  const plugins = [...(appJson.expo.plugins || [])];

  try {
    const edgeToEdge = require("react-native-edge-to-edge/expo");
    const hasEdgePlugin = plugins.some(
      (entry) =>
        entry === "react-native-edge-to-edge" ||
        (Array.isArray(entry) && entry[0] === "react-native-edge-to-edge"),
    );
    if (!hasEdgePlugin) {
      plugins.unshift(
        edgeToEdge({
          android: {
            parentTheme: "Default",
            enforceNavigationBarContrast: false,
          },
        }),
      );
    }
  } catch {
    // Optional until native rebuild
  }

  const webClientId = String(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "").trim();
  const iosClientId = String(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "").trim();
  // iOS must register the reversed *iOS* OAuth client, not the web client.
  // Using the web client here is why Google login returned to the app as a failure.
  const schemeSource = iosClientId || webClientId;
  const iosUrlScheme = schemeSource
    ? `com.googleusercontent.apps.${schemeSource.replace(/\.apps\.googleusercontent\.com$/i, "")}`
    : null;

  if (iosUrlScheme) {
    const googlePluginIndex = plugins.findIndex(
      (entry) => Array.isArray(entry) && entry[0] === "@react-native-google-signin/google-signin",
    );
    if (googlePluginIndex >= 0) {
      plugins[googlePluginIndex] = [
        "@react-native-google-signin/google-signin",
        { iosUrlScheme },
      ];
    }
  }

  // Preview APK: one ABI + shrink native libs (universal APK with all ABIs is often 400MB+).
  if (isReleaseApkProfile) {
    plugins.push([
      "expo-build-properties",
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          buildArchs: ["arm64-v8a"],
        },
      },
    ]);
  }

  return {
    ...appJson.expo,
    plugins,
    extra: {
      ...appJson.expo.extra,
      appEnv: profile,
      buildApiHosts: {
        team: process.env.EXPO_PUBLIC_TEAM_API_URL || "",
        event: process.env.EXPO_PUBLIC_EVENT_API_URL || "",
        schedule: process.env.EXPO_PUBLIC_SCHEDULE_API_URL || "",
      },
    },
  };
};

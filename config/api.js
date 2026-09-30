import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

const IS_DEV =
  typeof __DEV__ === "boolean"
    ? __DEV__
    : process.env.NODE_ENV !== "production";

const WEB_HOST =
  typeof window !== "undefined" && window.location?.hostname
    ? window.location.hostname
    : null;

const WEB_PROTOCOL =
  typeof window !== "undefined" && window.location?.protocol
    ? window.location.protocol
    : null;

const DISABLE_DEV_HOST_REWRITE =
  process.env.EXPO_PUBLIC_DISABLE_DEV_HOST_REWRITE === "true";

const isPrivateIpv4 = (hostname) =>
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

const isLoopbackHost = (hostname) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";

const isLocalDevHost = (hostname) =>
  Boolean(
    hostname &&
      (hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "10.0.2.2" ||
        hostname.endsWith(".local") ||
        isPrivateIpv4(hostname)),
  );

const extractHost = (value) => {
  if (!value || typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    return new URL(normalized).hostname || null;
  } catch {
    return trimmed.split(":")[0] || null;
  }
};

const normalizeRuntimeHost = (hostname) => {
  if (!hostname) return null;

  if (
    Platform.OS === "android" &&
    (hostname === "localhost" || hostname === "127.0.0.1")
  ) {
    return "10.0.2.2";
  }

  return hostname;
};

const getExpoHost = () => {
  const hostCandidates = [
    Constants?.expoConfig?.hostUri,
    Constants?.expoGoConfig?.debuggerHost,
    Constants?.manifest2?.extra?.expoClient?.hostUri,
    Constants?.manifest?.debuggerHost,
    Constants?.manifest?.hostUri,
    NativeModules?.SourceCode?.scriptURL,
  ];

  const resolvedHosts = hostCandidates
    .map((candidate) => {
      const host = extractHost(candidate);
      return host ? normalizeRuntimeHost(host) : null;
    })
    .filter(Boolean);

  if (!resolvedHosts.length) return null;

  // USB / adb reverse often exposes Metro as 127.0.0.1 — keep LAN IP for API calls.
  if (Platform.OS !== "web") {
    const lanHost = resolvedHosts.find(
      (host) => !isLoopbackHost(host) && host !== "10.0.2.2",
    );
    if (lanHost) return lanHost;
  }

  return resolvedHosts[0];
};

const getRuntimeHost = () => WEB_HOST || getExpoHost();

const isRuntimeRewriteCandidate = (hostname) =>
  Boolean(
    hostname &&
      (hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "10.0.2.2" ||
        isPrivateIpv4(hostname)),
  );

const maybeRewriteDevHost = (parsed) => {
  if (DISABLE_DEV_HOST_REWRITE || !IS_DEV) {
    return parsed;
  }

  const runtimeHost = getRuntimeHost();
  if (!runtimeHost || runtimeHost === parsed.hostname) {
    return parsed;
  }

  if (
    !isRuntimeRewriteCandidate(parsed.hostname) ||
    !isLocalDevHost(runtimeHost)
  ) {
    return parsed;
  }

  // Physical devices cannot reach the dev machine via loopback.
  if (
    Platform.OS !== "web" &&
    isLoopbackHost(runtimeHost) &&
    isPrivateIpv4(parsed.hostname)
  ) {
    return parsed;
  }

  const next = new URL(parsed.toString());
  next.hostname = runtimeHost;
  return next;
};

const normalizeConfiguredUrl = (value, label) => {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`[config/api] ${label} must be an absolute URL.`);
  }

  parsed = maybeRewriteDevHost(parsed);

  const isSecureProtocol =
    parsed.protocol === "https:" || parsed.protocol === "wss:";
  const isLocalProtocol =
    isLocalDevHost(parsed.hostname) &&
    (parsed.protocol === "http:" ||
      parsed.protocol === "ws:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "wss:");

  if (!IS_DEV && !isSecureProtocol) {
    throw new Error(
      `[config/api] ${label} must use HTTPS/WSS outside local development.`,
    );
  }

  if (IS_DEV && !(isSecureProtocol || isLocalProtocol)) {
    throw new Error(
      `[config/api] ${label} must use HTTPS/WSS or point to a local dev host.`,
    );
  }

  return parsed.toString().replace(/\/$/, "");
};

const getDevFallbackHost = () =>
  Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1";

const getDevUrl = (port, path) => {
  const runtimeHost = getRuntimeHost();

  if (WEB_HOST) {
    const protocol = WEB_PROTOCOL === "https:" ? "https" : "http";
    return `${protocol}://${WEB_HOST}:${port}${path}`;
  }

  if (runtimeHost) {
    const protocol = isLocalDevHost(runtimeHost) ? "http" : "https";
    return `${protocol}://${runtimeHost}:${port}${path}`;
  }

  return `http://${getDevFallbackHost()}:${port}${path}`;
};

const getApiUrl = (port, path, envValue, label) => {
  if (envValue) {
    return normalizeConfiguredUrl(envValue.trim(), label);
  }

  if (!IS_DEV) {
    console.error(
      `[config/api] Missing ${label} for a production build. API calls to this service will fail.`,
    );
    return `https://localhost:${port}${path}`;
  }

  return getDevUrl(port, path);
};

const AUTH_API_URL = getApiUrl(
  3000,
  "/api/v1/auth",
  process.env.EXPO_PUBLIC_AUTH_API_URL,
  "EXPO_PUBLIC_AUTH_API_URL",
);

const PROFILE_API_URL = getApiUrl(
  3000,
  "/api/v1/profile",
  process.env.EXPO_PUBLIC_PROFILE_API_URL,
  "EXPO_PUBLIC_PROFILE_API_URL",
);

const POST_API_URL = getApiUrl(
  3000,
  "/api/v1/post",
  process.env.EXPO_PUBLIC_POST_API_URL,
  "EXPO_PUBLIC_POST_API_URL",
);

/** Community feed posts (post-service). Separate from team posts on auth-service. */
const COMMUNITY_POST_API_URL = getApiUrl(
  3009,
  "/api/v1/posts",
  process.env.EXPO_PUBLIC_COMMUNITY_POST_API_URL,
  "EXPO_PUBLIC_COMMUNITY_POST_API_URL",
);

const CHATBOT_API_URL = getApiUrl(
  3000,
  "/api/v1/chatbot",
  process.env.EXPO_PUBLIC_CHATBOT_API_URL,
  "EXPO_PUBLIC_CHATBOT_API_URL",
);

const TEAM_API_URL = getApiUrl(
  3001,
  "/api/v1/team",
  process.env.EXPO_PUBLIC_TEAM_API_URL,
  "EXPO_PUBLIC_TEAM_API_URL",
);

const PLAYER_API_URL = getApiUrl(
  3002,
  "/api/v1/players",
  process.env.EXPO_PUBLIC_PLAYER_API_URL,
  "EXPO_PUBLIC_PLAYER_API_URL",
);

const MESSAGE_API_URL = getApiUrl(
  3002,
  "/api/v1/messages",
  process.env.EXPO_PUBLIC_MESSAGE_API_URL,
  "EXPO_PUBLIC_MESSAGE_API_URL",
);

const AVAILABILITY_API_URL = getApiUrl(
  3002,
  "/api/v1/availability",
  process.env.EXPO_PUBLIC_AVAILABILITY_API_URL,
  "EXPO_PUBLIC_AVAILABILITY_API_URL",
);

const ASSIGNMENT_API_URL = getApiUrl(
  3002,
  "/api/v1/assignments",
  process.env.EXPO_PUBLIC_ASSIGNMENT_API_URL,
  "EXPO_PUBLIC_ASSIGNMENT_API_URL",
);

const SCHEDULE_API_URL = getApiUrl(
  3003,
  "/api/v1/schedule",
  process.env.EXPO_PUBLIC_SCHEDULE_API_URL,
  "EXPO_PUBLIC_SCHEDULE_API_URL",
);

const EVENT_API_URL = getApiUrl(
  3005,
  "/api/v1/events",
  process.env.EXPO_PUBLIC_EVENT_API_URL,
  "EXPO_PUBLIC_EVENT_API_URL",
);

const GAME_API_URL = getApiUrl(
  5005,
  "/api/v1/game",
  process.env.EXPO_PUBLIC_GAME_API_URL,
  "EXPO_PUBLIC_GAME_API_URL",
);

const GAME_WS_URL = getApiUrl(
  5005,
  "",
  process.env.EXPO_PUBLIC_GAME_WS_URL,
  "EXPO_PUBLIC_GAME_WS_URL",
);

const TRICOUNT_API_URL = getApiUrl(
  3006,
  "/api/v1/tricount",
  process.env.EXPO_PUBLIC_TRICOUNT_API_URL,
  "EXPO_PUBLIC_TRICOUNT_API_URL",
);

const PLAYER_WS_URL = getApiUrl(
  3002,
  "",
  process.env.EXPO_PUBLIC_PLAYER_WS_URL,
  "EXPO_PUBLIC_PLAYER_WS_URL",
);

const LIVE_STREAM_API_URL = getApiUrl(
  5000,
  "",
  process.env.EXPO_PUBLIC_LIVE_STREAM_API_URL,
  "EXPO_PUBLIC_LIVE_STREAM_API_URL",
);

const SUPPORT_API_URL = getApiUrl(
  3008,
  "/api/v1/support",
  process.env.EXPO_PUBLIC_SUPPORT_API_URL,
  "EXPO_PUBLIC_SUPPORT_API_URL",
);

const SUPPORT_WS_URL = getApiUrl(
  3008,
  "",
  process.env.EXPO_PUBLIC_SUPPORT_WS_URL,
  "EXPO_PUBLIC_SUPPORT_WS_URL",
);

export {
  ASSIGNMENT_API_URL,
  AUTH_API_URL,
  AVAILABILITY_API_URL,
  CHATBOT_API_URL,
  COMMUNITY_POST_API_URL,
  EVENT_API_URL,
  GAME_API_URL,
  GAME_WS_URL,
  LIVE_STREAM_API_URL,
  MESSAGE_API_URL,
  PLAYER_API_URL,
  PLAYER_WS_URL,
  POST_API_URL,
  PROFILE_API_URL,
  SCHEDULE_API_URL,
  SUPPORT_API_URL,
  SUPPORT_WS_URL,
  TEAM_API_URL,
  TRICOUNT_API_URL,
};

if (__DEV__) {
  console.log("[config/api] Resolved API URLs:", {
    AUTH_API_URL,
    PROFILE_API_URL,
    TEAM_API_URL,
    PLAYER_API_URL,
    GAME_API_URL,
  });
}

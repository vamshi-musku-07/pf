import * as ExpoLinking from "expo-linking";
import { Platform, Share } from "react-native";

const ANDROID_PACKAGE = "com.eagleiitech.playflash";
const DEFAULT_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export const getPlayStoreUrl = () =>
  String(process.env.EXPO_PUBLIC_PLAY_STORE_URL || DEFAULT_PLAY_STORE_URL).trim();

/** True only when you host a real redirect page (Cloudflare tunnel, production domain, etc.). */
export const hasConfiguredWebInviteBase = () =>
  Boolean(String(process.env.EXPO_PUBLIC_APP_LINK_BASE_URL || "").trim());

/** e.g. http://10.22.67.154:3006/api/v1/tricount → http://10.22.67.154:3006 */
const getInviteBaseFromTricountApi = () => {
  const tricountApi = String(process.env.EXPO_PUBLIC_TRICOUNT_API_URL || "").trim();
  if (!tricountApi) return "";
  const match = tricountApi.match(/^(https?:\/\/[^/]+)/i);
  return match?.[1] || "";
};

export const getWebInviteBaseUrl = () => {
  const explicit = String(
    process.env.EXPO_PUBLIC_APP_LINK_BASE_URL ||
      process.env.APP_LINK_BASE_URL ||
      ""
  )
    .trim()
    .replace(/\/$/, "");

  if (explicit && !explicit.includes("trycloudflare.com")) {
    return explicit;
  }

  const fromTricount = getInviteBaseFromTricountApi();
  if (fromTricount) return fromTricount;

  return explicit.replace(/\/$/, "");
};

/** HTTPS invite page — only when EXPO_PUBLIC_APP_LINK_BASE_URL is set. */
export const createGroupWebShareLink = (shareId) => {
  const normalizedShareId = String(shareId || "").trim();
  const base = getWebInviteBaseUrl();
  if (!normalizedShareId || !base) return "";
  return `${base}/join/tricount/${encodeURIComponent(normalizedShareId)}`;
};

/** playflash:// — opens the installed app from most link handlers. */
export const createGroupAppDeepLink = (shareId) => {
  const normalizedShareId = String(shareId || "").trim();
  if (!normalizedShareId) return "";
  return ExpoLinking.createURL("/tricount", {
    queryParams: { shareId: normalizedShareId },
  });
};

/**
 * Android: tries the app first, then Play Store — does not use playflash.app.
 * @see https://developer.chrome.com/docs/android/intents
 */
export const createGroupAndroidIntentLink = (shareId) => {
  const normalizedShareId = String(shareId || "").trim();
  if (!normalizedShareId) return "";
  const fallback = encodeURIComponent(getPlayStoreUrl());
  return `intent://tricount?shareId=${encodeURIComponent(normalizedShareId)}#Intent;scheme=playflash;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
};

/** Best link for QR + share — prefers HTTPS (clickable in WhatsApp). */
export const createGroupShareLink = (shareId) => {
  const normalizedShareId = String(shareId || "").trim();
  if (!normalizedShareId) return "";

  const webLink = createGroupWebShareLink(normalizedShareId);
  if (webLink) return webLink;

  if (Platform.OS === "android") {
    return createGroupAndroidIntentLink(normalizedShareId);
  }
  return createGroupAppDeepLink(normalizedShareId);
};

/** HTTPS event invite — uses same tunnel base as Split Bill. */
export const createEventWebShareLink = (shareId) => {
  const normalizedShareId = String(shareId || "").trim();
  const base = getWebInviteBaseUrl();
  if (!normalizedShareId || !base) return "";
  return `${base}/join/events/${encodeURIComponent(normalizedShareId)}`;
};

export const createEventAppDeepLink = (shareId) => {
  const normalizedShareId = String(shareId || "").trim();
  if (!normalizedShareId) return "";
  return ExpoLinking.createURL("/events", {
    queryParams: { shareId: normalizedShareId },
  });
};

export const createEventAndroidIntentLink = (shareId) => {
  const normalizedShareId = String(shareId || "").trim();
  if (!normalizedShareId) return "";
  const fallback = encodeURIComponent(getPlayStoreUrl());
  return `intent://events?shareId=${encodeURIComponent(normalizedShareId)}#Intent;scheme=playflash;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
};

const EVENT_SHARE_ID_PATTERN = /^[a-f0-9]{12}$/i;

/**
 * Parse invite codes from QR scans, pasted URLs, raw codes, or check-in QRs.
 * Supports:
 *  - Bare code: "abc123def456"
 *  - Web link: "http(s)://host[:port]/join/events/abc123def456"
 *  - Deep link: "playflash://events?shareId=abc123def456"
 *  - Android intent: "intent://events?shareId=abc123def456#Intent;..."
 *  - Check-in QR: "checkin:<eventId>:abc123def456"
 *  - Plain "invite code: abc123def456"
 */
export const extractEventShareId = (input) => {
  if (typeof input !== "string") return "";

  const trimmed = input.trim();
  if (!trimmed) return "";

  if (EVENT_SHARE_ID_PATTERN.test(trimmed)) return trimmed;

  const contextualMatch = trimmed.match(
    /(?:shareId=|\/join\/events\/|\/events\/share\/|invite\s+code[:\s]+|checkin:[^:]+:)([a-f0-9]{12})(?![a-f0-9])/i
  );
  if (contextualMatch?.[1] && EVENT_SHARE_ID_PATTERN.test(contextualMatch[1])) {
    return contextualMatch[1];
  }

  try {
    const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
    const url = new URL(candidate);

    const queryShareId = (url.searchParams.get("shareId") || "").trim();
    if (EVENT_SHARE_ID_PATTERN.test(queryShareId)) return queryShareId;

    const segments = url.pathname.split("/").filter(Boolean);
    const joinIndex = segments.findIndex((s) => s.toLowerCase() === "join");
    if (joinIndex >= 0 && segments[joinIndex + 1]?.toLowerCase() === "events") {
      const pathShareId = segments[joinIndex + 2] || "";
      if (EVENT_SHARE_ID_PATTERN.test(pathShareId)) return pathShareId;
    }
  } catch {
    /* not a URL */
  }

  const anyHexMatch = trimmed.match(/([a-f0-9]{12})(?![a-f0-9])/i);
  if (anyHexMatch?.[1] && EVENT_SHARE_ID_PATTERN.test(anyHexMatch[1])) {
    return anyHexMatch[1];
  }

  return "";
};

/** Best link for QR + share — prefers HTTPS (clickable in WhatsApp). */
export const createEventShareLink = (shareId) => {
  const normalizedShareId = String(shareId || "").trim();
  if (!normalizedShareId) return "";

  const webLink = createEventWebShareLink(normalizedShareId);
  if (webLink) return webLink;

  if (Platform.OS === "android") {
    return createEventAndroidIntentLink(normalizedShareId);
  }
  return createEventAppDeepLink(normalizedShareId);
};

export const shareEventInvite = async ({ title, eventTitle, shareId }) => {
  const code = String(shareId || "").trim();
  if (!code) return;

  const shareLink = createEventShareLink(code);
  const webLink = createEventWebShareLink(code);
  const storeUrl = getPlayStoreUrl();
  const label = eventTitle || "this event";

  if (shareLink) {
    const message = [
      `Join "${label}" on PlayFlash`,
      shareLink,
      "",
      `Invite code: ${code}`,
      "",
      `Install PlayFlash: ${storeUrl}`,
    ].join("\n");

    return Share.share({
      title: title || label || "PlayFlash event",
      message,
      url: webLink || shareLink,
    });
  }

  const message = [
    `Join "${label}" on PlayFlash`,
    "",
    `Invite code: ${code}`,
    "",
    `Install PlayFlash: ${storeUrl}`,
    "",
    "Open PlayFlash → Events → Join, then paste the invite code.",
  ].join("\n");

  return Share.share({
    title: title || label || "PlayFlash event",
    message,
  });
};

export const createTeamJoinLink = (token) => {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return "";
  return ExpoLinking.createURL("/team-join", {
    queryParams: { token: normalizedToken },
  });
};

export const shareTricountGroupInvite = async ({ title, groupName, shareId }) => {
  const code = String(shareId || "").trim();
  if (!code) return;

  const webLink = createGroupWebShareLink(code);
  const storeUrl = getPlayStoreUrl();
  const groupLabel = groupName || "my group";

  // WhatsApp / SMS only auto-link https URLs — put that link on its own line.
  if (webLink) {
    const message = [
      `Join "${groupLabel}" on PlayFlash`,
      webLink,
      "",
      `Invite code: ${code}`,
      "",
      `Install PlayFlash: ${storeUrl}`,
    ].join("\n");

    return Share.share({
      title: title || groupLabel || "PlayFlash invite",
      message,
      url: webLink,
    });
  }

  const message = [
    `Join "${groupLabel}" on PlayFlash`,
    "",
    `Invite code: ${code}`,
    "",
    `Install PlayFlash: ${storeUrl}`,
    "",
    "Open PlayFlash → Split Bill → Join, then paste the invite code.",
  ].join("\n");

  return Share.share({
    title: title || groupLabel || "PlayFlash invite",
    message,
  });
};

/** @deprecated Use shareTricountGroupInvite */
export const sharePlayFlashInvite = async ({
  title,
  headline,
  webUrl,
  inviteCode,
}) => {
  const code = String(inviteCode || "").trim();
  const fromUrl = String(webUrl || "").match(/[a-f0-9]{12}/i)?.[0];
  return shareTricountGroupInvite({
    title,
    groupName: headline?.replace(/^Join "|" on PlayFlash$/g, "") || "my group",
    shareId: code || fromUrl,
  });
};

/** playflash://tournament/public/:code — opens read-only league page. */
export const createTournamentAppDeepLink = (code) => {
  const id = String(code || "").trim();
  if (!id) return "";
  return ExpoLinking.createURL(`/tournament/public/${encodeURIComponent(id)}`);
};

export const shareTournamentLink = async ({ name, shareCode, tournamentId }) => {
  const code = String(shareCode || tournamentId || "").trim();
  if (!code) return Share.share({ message: "Tournament link unavailable" });
  const deepLink = createTournamentAppDeepLink(code);
  const message = [
    `Follow "${name || "this tournament"}" on PlayFlash`,
    "",
    deepLink,
    "",
    `Share code: ${code}`,
  ].join("\n");
  return Share.share({ title: name || "Tournament", message });
};

import { useAppearance } from "@/context/AppearanceContext";

/**
 * Community posts theme — follows app light/dark appearance.
 */
export const COMMUNITY_POST_THEME = {
  light: {
    bg: "#F4F4F5",
    surface: "#FFFFFF",
    surfaceAlt: "#F0F0F0",
    text: "#111111",
    muted: "#6B7280",
    green: "#9AEA62",
    onGreen: "#0B1324",
    border: "#E5E5E5",
    borderStrong: "#D4D4D8",
    avatarBorder: "#9AEA62",
    menuBg: "#FFFFFF",
    inputBg: "#F4F4F5",
    skeleton: "#E8E8E8",
    iconDim: "#C4C4C4",
    danger: "#E5484D",
    likeHeart: "#FF4D6D",
    placeholder: "#9CA3AF",
    overlay: "rgba(0,0,0,0.45)",
    mediaOverlay: "rgba(0,0,0,0.55)",
    videoBg: "#111111",
    shadow: "#000000",
    publishDim: "#A1A1AA",
    threadLine: "#E5E5E5",
    headerBorder: "#E5E5E5",
    statusBar: "dark-content",
  },
  dark: {
    bg: "#000000",
    surface: "#141414",
    surfaceAlt: "#1A1A1A",
    text: "#FFFFFF",
    muted: "#A3A3A3",
    green: "#9AEA62",
    onGreen: "#0B1324",
    border: "#2A2A2A",
    borderStrong: "#333333",
    avatarBorder: "#9AEA62",
    menuBg: "#1C1C1E",
    inputBg: "#0F0F0F",
    skeleton: "#1A1A1A",
    iconDim: "#333333",
    danger: "#FF6B6B",
    likeHeart: "#FF4D6D",
    placeholder: "#666666",
    overlay: "rgba(0,0,0,0.65)",
    mediaOverlay: "rgba(0,0,0,0.55)",
    videoBg: "#000000",
    shadow: "#000000",
    publishDim: "#5C5C5C",
    threadLine: "#2A2A2A",
    headerBorder: "#1A1A1A",
    statusBar: "light-content",
  },
};

export function getCommunityPostTheme(isDark) {
  return isDark ? COMMUNITY_POST_THEME.dark : COMMUNITY_POST_THEME.light;
}

/** Prefer this in screens/components so posts follow system/app appearance. */
export function useCommunityPostTheme() {
  const { isDark } = useAppearance();
  return getCommunityPostTheme(isDark);
}

/** @deprecated use useCommunityPostTheme() — kept as light default for any stray imports */
export const communityPostTheme = COMMUNITY_POST_THEME.light;

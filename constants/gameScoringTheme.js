import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

export const getGameScoringTheme = (isDark) => {
  const base = getAppTheme(isDark);

  return {
    ...base,
    isDark,
    panel: base.bg,
    card: base.surface,
    cardElevated: base.surfaceAlt,
    muted: base.textDim,
    home: isDark ? "#47FEB7" : "#111827",
    away: isDark ? "#B8C3FF" : "#64748B",
    goal: "#22C55E",
    accent: isDark ? "#47FEB7" : "#111827",
    onAccent: isDark ? "#052E16" : "#FFFFFF",
    warning: isDark ? "#FACC15" : "#92400E",
    warningStrong: isDark ? "#EAB308" : "#78350F",
    warningBg: isDark ? "rgba(250,204,21,0.15)" : "#FEF3C7",
    warningBorder: isDark ? "rgba(250,204,21,0.45)" : "#D97706",
    tabBar: isDark ? "rgba(0,0,0,0.7)" : "#FFFFFF",
    activeTint: isDark ? "rgba(71,254,183,0.12)" : "rgba(17,24,39,0.08)",
  };
};

export const useGameScoringTheme = () => {
  const { isDark } = useAppearance();
  return getGameScoringTheme(isDark);
};

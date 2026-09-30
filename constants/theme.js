export const colors = {
    background: "#fff9e3",
    foreground: "#081126",
    card: "#fff8e7",
    muted: "#f6eecf",
    mutedForeground: "rgba(0, 0, 0, 0.6)",
    primary: "black",
    accent: "#ea7a53",
    border: "rgba(0, 0, 0, 0.1)",
    success: "#16a34a",
    destructive: "#dc2626",
    subscription: "#8fd1bd",

    // ── App-wide design tokens ──────────────────────────────
    // Use these instead of hardcoding hex values in components.
    appGreen: "#9AEA62",       // Primary accent — CTAs, badges, active states
    appDark: "#111827",        // Primary dark surface — headers, hero cards
    appBg: "#f8f9fa",          // Screen background (light)
    appBgDark: "#081126",      // Screen background (dark/auth)
    appGray: "#6B7280",        // Secondary text
    appGrayLight: "#9CA3AF",   // Placeholder text, muted icons
    appBorder: "#E5E7EB",      // Card borders, dividers
    appSurface: "#ffffff",     // Card/modal surfaces
    appOverlay: "rgba(0,0,0,0.4)", // Modal scrim

    // Semantic
    error: "#EF4444",
    warning: "#F59E0B",
    info: "#3B82F6",
    offline: "#EF4444",
} ;

export const spacing = {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    14: 56,
    16: 64,
    18: 72,
    20: 80,
    24: 96,
    30: 120,
} ;

export const components = {
    tabBar: {
        height: spacing[18],
        horizontalInset: spacing[5],
        radius: spacing[8],
        iconFrame: spacing[12],
        itemPaddingVertical: spacing[2],
    },
} ;

export const theme = {
    colors,
    spacing,
    components,
} ;
/**
 * App typography — locked custom fonts (ignore device system font).
 * - Manrope → default UI / body
 * - Plus Jakarta Sans → display / headings
 * Loaded in app/_layout.jsx via @expo-google-fonts/*.
 */
export const fonts = {
  // Manrope — body / UI
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semiBold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extraBold: "Manrope_800ExtraBold",

  // Plus Jakarta Sans — display / headings
  jakarta: "PlusJakartaSans_400Regular",
  jakartaMedium: "PlusJakartaSans_500Medium",
  jakartaSemiBold: "PlusJakartaSans_600SemiBold",
  jakartaBold: "PlusJakartaSans_700Bold",
  jakartaExtraBold: "PlusJakartaSans_800ExtraBold",
  display: "PlusJakartaSans_700Bold",

  /** Condensed display face for live scoreboards (broadcast / stadium feel). */
  scoreDisplay: "BebasNeue_400Regular",
};

export const fontWeights = {
  regular: "400",
  medium: "500",
  semiBold: "600",
  bold: "700",
  extraBold: "800",
};

/** Map RN fontWeight → loaded Manrope file (required on Android). */
export const fontFamilyForWeight = (weight) => {
  const w = weight == null ? "400" : String(weight).toLowerCase();
  if (w === "bold" || w === "700") return fonts.bold;
  if (w === "800" || w === "900" || w === "extrabold" || w === "black") {
    return fonts.extraBold;
  }
  if (w === "600" || w === "semibold") return fonts.semiBold;
  if (w === "500" || w === "medium") return fonts.medium;
  return fonts.regular;
};

/** Map RN fontWeight → Plus Jakarta Sans (for headings / display). */
export const jakartaFamilyForWeight = (weight) => {
  const w = weight == null ? "400" : String(weight).toLowerCase();
  if (w === "bold" || w === "700") return fonts.jakartaBold;
  if (w === "800" || w === "900" || w === "extrabold" || w === "black") {
    return fonts.jakartaExtraBold;
  }
  if (w === "600" || w === "semibold") return fonts.jakartaSemiBold;
  if (w === "500" || w === "medium") return fonts.jakartaMedium;
  return fonts.jakarta;
};

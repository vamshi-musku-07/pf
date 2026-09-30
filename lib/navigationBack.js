/**
 * Back navigation — returns to Home or Profile based on backTo param.
 * Use backTo: "home" | "profile" when pushing a screen.
 *
 * Valid tab routes in this app:
 *   Home    → /(tabs)           (NOT /(tabs)/index — that is unmatched)
 *   Profile → /(tabs)/settings
 */

export const HOME_BACK_TO = "/(tabs)";
export const SETTINGS_BACK_TO = "/(tabs)/settings";

/** Pass as params.backTo when opening from the home tab */
export const BACK_TO_HOME = "home";
/** Pass as params.backTo when opening from profile / settings */
export const BACK_TO_PROFILE = "profile";

export const getBackToParam = (params) => {
  const value = params?.backTo;
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.length > 0);
    return first || "";
  }
  return "";
};

export const resolveBackTarget = (backTo, fallback = BACK_TO_HOME) => {
  const raw =
    (typeof backTo === "string" && backTo.length > 0 ? backTo : "") || fallback;

  if (raw === BACK_TO_PROFILE || raw.includes("settings")) {
    return SETTINGS_BACK_TO;
  }
  if (
    raw === BACK_TO_HOME ||
    raw === HOME_BACK_TO ||
    raw === "/(tabs)" ||
    raw === "/(tabs)/index" ||
    raw.includes("(tabs)/index")
  ) {
    return HOME_BACK_TO;
  }
  return raw;
};

export const isHomeTarget = (backTo) =>
  resolveBackTarget(backTo, BACK_TO_HOME) === HOME_BACK_TO;

export const isProfileTarget = (backTo) =>
  resolveBackTarget(backTo, BACK_TO_PROFILE) === SETTINGS_BACK_TO;

export const getBackLabel = (backTo) => {
  if (isProfileTarget(backTo)) return "Profile";
  if (isHomeTarget(backTo)) return "Home";
  if (backTo?.includes("/teams")) return "Teams";
  if (backTo?.includes("/invitations")) return "Invitations";
  if (backTo?.includes("welcome") || backTo?.includes("(auth)")) return "Back";
  return "Back";
};

export const goBackTo = (router, backTo, fallback = BACK_TO_HOME) => {
  const destination = resolveBackTarget(backTo, fallback);

  if (router.canGoBack?.()) {
    router.back();
    // Tab switches (e.g. Home → Settings) don't create stack entries, so after
    // popping the pushed screen the tab navigator may still show the wrong tab.
    // Nudge it to the correct tab after the pop settles.
    if (destination === SETTINGS_BACK_TO) {
      setTimeout(() => router.navigate(destination), 50);
    }
    return;
  }

  router.replace(destination);
};

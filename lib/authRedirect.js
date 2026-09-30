const REDIRECT_PARAM = "redirect";

/** Routes that should not be restored after re-login (account, settings, legal). */
const AUTH_REDIRECT_BLOCKLIST = [
  "/delete-account",
  "/profile",
  "/settings",
  "/customer-support",
  "/help-center",
  "/data-protection",
  "/terms-of-use",
];

const normalizePathname = (pathname) => {
  if (!pathname || typeof pathname !== "string") return "";
  return pathname.split("?")[0].replace(/\/+$/, "") || "/";
};

export const shouldPreserveAuthRedirect = (pathname) => {
  const normalized = normalizePathname(pathname);
  if (!normalized) return false;

  if (
    normalized === "/" ||
    normalized === "/(tabs)" ||
    normalized === "/(tabs)/index" ||
    normalized === "/index"
  ) {
    return false;
  }

  return !AUTH_REDIRECT_BLOCKLIST.some(
    (blocked) => normalized === blocked || normalized.endsWith(blocked),
  );
};

const getFirstString = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.length > 0);
    return first || "";
  }
  return "";
};

const normalizeParams = (params = {}) => {
  if (!params || typeof params !== "object") return {};

  const safeParams = {};

  Object.entries(params).forEach(([key, value]) => {
    if (key === REDIRECT_PARAM) return;

    if (typeof value === "string") {
      if (value.length > 0) safeParams[key] = value;
      return;
    }

    if (Array.isArray(value)) {
      const strings = value.filter(
        (item) => typeof item === "string" && item.length > 0,
      );
      if (strings.length > 0) safeParams[key] = strings;
    }
  });

  return safeParams;
};

export const buildRedirectParam = (pathname, params = {}) => {
  if (!shouldPreserveAuthRedirect(pathname)) return "";

  if (!pathname || typeof pathname !== "string") return "";

  try {
    return encodeURIComponent(
      JSON.stringify({
        pathname,
        params: normalizeParams(params),
      }),
    );
  } catch {
    return "";
  }
};

export const parseRedirectParam = (value) => {
  const rawValue = getFirstString(value);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue));
    if (!parsed || typeof parsed.pathname !== "string" || !parsed.pathname) {
      return null;
    }

    if (!shouldPreserveAuthRedirect(parsed.pathname)) {
      return null;
    }

    return {
      pathname: parsed.pathname,
      params: normalizeParams(parsed.params),
    };
  } catch {
    return null;
  }
};

export const getAuthRedirectParams = (value) => {
  const redirect = getFirstString(value);
  return redirect ? { [REDIRECT_PARAM]: redirect } : {};
};

export const getRedirectParamValue = getFirstString;

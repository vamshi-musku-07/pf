/**
 * Lazy-load Google Sign-In so routes that import BackendAuthContext
 * do not crash when RNGoogleSignin is missing from the native binary.
 */

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let googleModule = undefined;
let configured = false;

const loadModule = () => {
  if (googleModule !== undefined) {
    return googleModule || null;
  }

  try {
    googleModule = require("@react-native-google-signin/google-signin");
    return googleModule;
  } catch (error) {
    console.warn(
      "[GoogleSignIn] Native module unavailable:",
      error?.message || error,
    );
    googleModule = null;
    return null;
  }
};

export const isGoogleSignInAvailable = () => Boolean(loadModule()?.GoogleSignin);

export const ensureGoogleSignInConfigured = () => {
  const mod = loadModule();
  if (!mod?.GoogleSignin) return false;

  if (!configured) {
    // webClientId is required so Google returns an id_token the backend can verify.
    // iosClientId is required on iOS when GoogleService-Info.plist has no CLIENT_ID
    // (this project's plist is a different Firebase app and is missing that key).
    mod.GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      offlineAccess: false,
      scopes: ["profile", "email"],
    });
    configured = true;
  }

  return true;
};

export const getGoogleSignIn = () => {
  if (!ensureGoogleSignInConfigured()) {
    return null;
  }
  return loadModule();
};

export const signOutGoogle = async () => {
  const mod = loadModule();
  if (!mod?.GoogleSignin) return;
  const { GoogleSignin } = mod;
  try {
    await GoogleSignin.signOut();
  } catch {
    /* not signed in with Google */
  }
  try {
    await GoogleSignin.revokeAccess();
  } catch {
    /* no granted access to revoke */
  }
};

/** Clears cached Google account so the next signIn() shows the account picker. */
export const prepareGoogleAccountPicker = async () => {
  const mod = loadModule();
  if (!mod?.GoogleSignin) return;
  const { GoogleSignin } = mod;

  try {
    const hasPrevious =
      typeof GoogleSignin.hasPreviousSignIn === "function"
        ? await GoogleSignin.hasPreviousSignIn()
        : false;
    if (hasPrevious) {
      await GoogleSignin.signOut();
    }
  } catch {
    try {
      await GoogleSignin.signOut();
    } catch {
      /* ignore */
    }
  }
};

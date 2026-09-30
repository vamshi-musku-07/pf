import { useCallback } from "react";
import {
  ensureGoogleSignInConfigured,
  getGoogleSignIn,
  isGoogleSignInAvailable,
  prepareGoogleAccountPicker,
} from "@/lib/googleSignIn";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

const getGoogleProjectNumber = (clientId) => String(clientId || "").trim().split("-")[0] || "";

const googleWebProjectNumber = getGoogleProjectNumber(GOOGLE_WEB_CLIENT_ID);
const googleAndroidProjectNumber = getGoogleProjectNumber(GOOGLE_ANDROID_CLIENT_ID);
const hasMismatchedGoogleProjects = !!(
  googleWebProjectNumber
  && googleAndroidProjectNumber
  && googleWebProjectNumber !== googleAndroidProjectNumber
);

export function useGoogleAuth() {
  const signIn = useCallback(async () => {
    if (!isGoogleSignInAvailable() || !ensureGoogleSignInConfigured()) {
      throw new Error(
        "Google Sign-In is not available in this build. Rebuild the app with: npx expo prebuild --clean && npx expo run:android",
      );
    }

    const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } =
      getGoogleSignIn();

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Always clear cached account so user can pick Google account after logout
      await prepareGoogleAccountPicker();

      const response = await GoogleSignin.signIn();

      if (!isSuccessResponse(response)) {
        return null;
      }

      const { idToken } = response.data;
      if (!idToken) {
        throw new Error(
          "Google did not return an id_token. " +
            "Make sure webClientId is a 'Web application' type OAuth client in Google Cloud Console.",
        );
      }

      return { googleIdToken: idToken };
    } catch (err) {
      if (
        isErrorWithCode(err) &&
        (err.code === statusCodes.SIGN_IN_CANCELLED ||
          err.code === statusCodes.IN_PROGRESS)
      ) {
        return null;
      }

      if (isErrorWithCode(err) && err.code === "DEVELOPER_ERROR") {
        const mismatchMessage = hasMismatchedGoogleProjects
          ? ` The app env is also mismatched: web client project ${googleWebProjectNumber} and Android client project ${googleAndroidProjectNumber}.`
          : "";
        throw new Error(
          "Google Sign-In is misconfigured for Android. In Google Cloud Console, the Android OAuth client must use package com.eagleiitech.playflash and the SHA-1 of the keystore used for this build. For this project, do not rely on Firebase config alone." +
            mismatchMessage,
        );
      }

      throw err;
    }
  }, []);

  return { signIn, isAvailable: isGoogleSignInAvailable() };
}

import { useCallback } from "react";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";

let AppleAuthentication = null;
try {
  AppleAuthentication = require("expo-apple-authentication");
} catch {
  AppleAuthentication = null;
}

export function useAppleAuth() {
  const isAvailable = Platform.OS === "ios" && !!AppleAuthentication;

  const signIn = useCallback(async () => {
    if (!isAvailable) {
      throw new Error("Sign in with Apple is only available on iOS.");
    }

    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      throw new Error("Sign in with Apple is not available on this device.");
    }

    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    let credential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
    } catch (err) {
      if (err?.code === "ERR_REQUEST_CANCELED") return null;
      throw err;
    }

    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token.");
    }

    return {
      identityToken: credential.identityToken,
      nonce: rawNonce,
      fullName: {
        givenName: credential.fullName?.givenName || "",
        familyName: credential.fullName?.familyName || "",
      },
      email: credential.email || null,
    };
  }, [isAvailable]);

  return { signIn, isAvailable };
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
// AppState already imported
import axios from "axios";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { signOutGoogle } from "@/lib/googleSignIn";
import { AUTH_API_URL } from "@/config/api";
import { setSessionExpiredCallback } from "@/lib/apiService";
import { decodeJwtPayload, willJwtExpireWithin } from "@/lib/jwt";
import {
  clearAllTokens,
  getAccessToken,
  getBackendUser,
  getRefreshToken,
  setAccessToken,
  setBackendUser as persistBackendUser,
  setRefreshToken,
} from "@/lib/tokenStorage";
import {
  forgotPasswordAPI,
  googleLoginAPI,
  loginAPI,
  logoutAPI,
  deleteAccountAPI,
  registerAPI,
  resendOTPAPI,
  resetPasswordAPI,
  verifyOTPAPI,
  verifyPasswordResetOTPAPI,
} from "@/services/AuthApi";
import {
  pingPushPresence,
  registerForPushNotifications,
} from "@/services/PushNotificationService";
import { handleIncomingPushNotification } from "@/lib/notificationSync";
import { isTricountPushNotification } from "@/lib/tricountNotifications";
import { openNotificationRoute } from "@/lib/notificationRouting";
import { appendPushInboxItem } from "@/lib/pushInboxStore";
import { refreshNotificationBadge } from "@/lib/notificationBadge";
import { clearMyTournamentsCache } from "@/hooks/useMyTournaments";

const BackendAuthContext = createContext(null);

// How many seconds before expiry we proactively refresh (2 minutes)
const REFRESH_BUFFER_SECONDS = 120;

export const useBackendAuth = () => {
  const ctx = useContext(BackendAuthContext);
  if (!ctx) {
    throw new Error("useBackendAuth must be used within BackendAuthProvider");
  }
  return ctx;
};

export const BackendAuthProvider = ({ children }) => {
  const [backendUser, setBackendUserState] = useState(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const refreshTimerRef = useRef(null);
  const handledColdStartRef = useRef(null);
  const pendingNotificationDataRef = useRef(null);

  // Proactively call /refresh before the access token expires.
  const scheduleTokenRefresh = useCallback((accessToken) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const payload = decodeJwtPayload(accessToken);
    if (!payload?.exp) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresInSec = Number(payload.exp) - nowSec;
    const refreshInMs = Math.max(
      (expiresInSec - REFRESH_BUFFER_SECONDS) * 1000,
      0,
    );

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) return;

        const response = await axios.post(
          `${AUTH_API_URL}/refresh`,
          { refreshToken },
          { timeout: 15000 },
        );

        const {
          accessToken: newAccess,
          refreshToken: newRefresh,
        } = response.data;

        if (newAccess) {
          await setAccessToken(newAccess);
          if (newRefresh) await setRefreshToken(newRefresh);
          scheduleTokenRefresh(newAccess);
        }
      } catch {
        // apiService interceptors handle retry/logout on hard failure
      }
    }, refreshInMs);
  }, []);

  // Refresh immediately when the app comes back after timers were suspended.
  const refreshNow = useCallback(async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return;

      const response = await axios.post(
        `${AUTH_API_URL}/refresh`,
        { refreshToken },
        { timeout: 15000 },
      );

      const {
        accessToken: newAccess,
        refreshToken: newRefresh,
      } = response.data;

      if (newAccess) {
        await setAccessToken(newAccess);
        if (newRefresh) await setRefreshToken(newRefresh);
        scheduleTokenRefresh(newAccess);
      }
    } catch {
      // apiService interceptors handle retry/logout on hard failure
    }
  }, [scheduleTokenRefresh]);

  useEffect(() => {
    const loadStored = async () => {
      try {
        const stored = await getBackendUser();
        const token = await getAccessToken();

        if (stored && token) {
          setBackendUserState(stored);
          setIsSignedIn(true);
          scheduleTokenRefresh(token);
        }
      } catch {
        // ignore bootstrap failures; app falls back to signed out
      } finally {
        setIsLoaded(true);
      }
    };

    loadStored();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleTokenRefresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextState) => {
        if (nextState !== "active") return;

        const token = await getAccessToken();
        if (!token) return;

        if (
          willJwtExpireWithin(token, REFRESH_BUFFER_SECONDS, {
            treatMissingExpAsExpired: false,
          })
        ) {
          refreshNow();
        }

        pingPushPresence().catch(() => {});
        refreshNotificationBadge();
      },
    );

    return () => subscription.remove();
  }, [refreshNow]);

  const handleAuthResponse = useCallback(
    async (result) => {
      await Promise.all([
        setAccessToken(result.accessToken),
        result.refreshToken
          ? setRefreshToken(result.refreshToken)
          : Promise.resolve(),
        persistBackendUser(result.data),
      ]);

      setBackendUserState(result.data);
      setIsSignedIn(true);
      clearMyTournamentsCache();

      if (result.accessToken) {
        scheduleTokenRefresh(result.accessToken);
      }
    },
    [scheduleTokenRefresh],
  );

  const updateBackendUser = useCallback(async (nextUser) => {
    await persistBackendUser(nextUser);
    setBackendUserState(nextUser);
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      registerForPushNotifications().catch(() => {});
    }
  }, [isSignedIn]);

  const queueOrOpenNotification = useCallback(
    (data) => {
      if (!data || typeof data !== "object") return;
      // AuthGate / router may not be ready yet on cold start — queue and retry.
      if (!isLoaded || !isSignedIn) {
        pendingNotificationDataRef.current = data;
        return;
      }
      pendingNotificationDataRef.current = null;
      openNotificationRoute(router, data);
    },
    [isLoaded, isSignedIn],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const pending = pendingNotificationDataRef.current;
    if (!pending) return;
    pendingNotificationDataRef.current = null;
    // Let AuthGate settle onto the signed-in tree before pushing the post.
    const timer = setTimeout(() => {
      openNotificationRoute(router, pending);
    }, 120);
    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const handleTap = (response) => {
      const content = response?.notification?.request?.content || {};
      const raw = content.data || {};
      const nested =
        raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
          ? raw.data
          : {};
      const data = { ...nested, ...raw };
      if (
        isTricountPushNotification(data) ||
        data.channelId === "community" ||
        String(data.type || "").startsWith("community_")
      ) {
        void appendPushInboxItem(backendUser, {
          title: content.title,
          body: content.body,
          data,
        }).then(() => refreshNotificationBadge());
      }
      queueOrOpenNotification(data);
    };

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        void handleIncomingPushNotification(backendUser, notification);
      },
    );

    const responseSub =
      Notifications.addNotificationResponseReceivedListener(handleTap);

    // Cold start: the tap that launched the app never reaches the listener.
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const id = response?.notification?.request?.identifier;
        if (!response || !id || handledColdStartRef.current === id) return;
        handledColdStartRef.current = id;
        handleTap(response);
      })
      .catch(() => {});

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [backendUser, queueOrOpenNotification]);

  const signInWithGoogle = useCallback(
    async (idToken) => {
      const result = await googleLoginAPI(idToken);
      await handleAuthResponse(result);
      return result;
    },
    [handleAuthResponse],
  );

  const signInWithEmail = useCallback(
    async (email, password) => {
      const result = await loginAPI(email, password);
      await handleAuthResponse(result);
      return result;
    },
    [handleAuthResponse],
  );

  const register = useCallback(async (username, email, password) => {
    return registerAPI(username, email, password);
  }, []);

  const verifyOTP = useCallback(
    async (email, otp) => {
      const result = await verifyOTPAPI(email, otp);
      await handleAuthResponse(result);
      return result;
    },
    [handleAuthResponse],
  );

  const resendOTP = useCallback(async (email) => {
    return resendOTPAPI(email);
  }, []);

  const forgotPassword = useCallback(async (email) => {
    return forgotPasswordAPI(email);
  }, []);

  const verifyPasswordResetOTP = useCallback(async (email, otp) => {
    return verifyPasswordResetOTPAPI(email, otp);
  }, []);

  const resetPassword = useCallback(
    async (email, otp, password, confirmPassword) => {
      return resetPasswordAPI(email, otp, password, confirmPassword);
    },
    [],
  );

  const signOut = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    try {
      await logoutAPI();
    } catch {
      // ignore logout API failures; local logout still wins
    } finally {
      // Clear Google sign-in session so account picker shows next time
      await signOutGoogle();
      await clearAllTokens();
      clearMyTournamentsCache();
      setBackendUserState(null);
      setIsSignedIn(false);
      router.replace("/(auth)/welcome");
    }
  }, []);

  const deleteAccount = useCallback(async () => {
      try {
        await deleteAccountAPI();
      } catch (error) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "Failed to delete account.";
        return { ok: false, message };
      }

      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      await signOutGoogle();
      await clearAllTokens();
      clearMyTournamentsCache();
      setBackendUserState(null);
      setIsSignedIn(false);
      return { ok: true };
  }, []);

  useEffect(() => {
    setSessionExpiredCallback(signOut);
    return () => setSessionExpiredCallback(null);
  }, [signOut]);

  const value = {
    backendUser,
    isLoaded,
    isSignedIn,
    forgotPassword,
    register,
    resendOTP,
    resetPassword,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    deleteAccount,
    updateBackendUser,
    verifyOTP,
    verifyPasswordResetOTP,
  };

  return (
    <BackendAuthContext.Provider value={value}>
      {children}
    </BackendAuthContext.Provider>
  );
};

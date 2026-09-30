import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearAllTokens,
} from "./tokenStorage";
import { willJwtExpireWithin } from "./jwt";
import { AUTH_API_URL } from "@/config/api";
import { showToast } from "@/context/ToastContext";

// Throttle network-error toasts — show at most once every 5 s
let lastNetworkToastAt = 0;
function showNetworkToast() {
  const now = Date.now();
  if (now - lastNetworkToastAt < 5000) return;
  lastNetworkToastAt = now;
  showToast("Slow or no internet connection", "warning");
}

// Single promise shared across all concurrent callers — eliminates check-then-set race
let refreshPromise = null;

// Global callback — set by BackendAuthContext to trigger logout when refresh fails
let sessionExpiredCallback = null;
export const setSessionExpiredCallback = (callback) => {
  sessionExpiredCallback = callback;
};

// Returns true if the token is already expired OR expires within the next 30 seconds.
// 30-second buffer prevents the race where a token valid right now expires mid-flight.
const isTokenExpiredOrExpiring = (token) => willJwtExpireWithin(token, 30);

const isFormDataPayload = (value) =>
  typeof FormData !== "undefined" && value instanceof FormData;

/**
 * Create a configured axios instance with auth interceptors.
 * Pattern adapted from frontend/src/utils/apiService.js
 */
const createApiService = (baseURL) => {
  const api = axios.create({
    baseURL,
    timeout: 30000,
    headers: { "Content-Type": "application/json" },
  });

  // Refresh access token using refresh token.
  // All concurrent callers share the same promise — no double-refresh possible.
  const refreshAccessToken = () => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error("No refresh token available");

        const response = await axios.post(
          `${AUTH_API_URL}/refresh`,
          { refreshToken },
          { timeout: 15000 }
        );

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          response.data;

        if (!newAccessToken) throw new Error("No access token from refresh");

        await setAccessToken(newAccessToken);
        if (newRefreshToken) await setRefreshToken(newRefreshToken);

        return newAccessToken;
      } catch (error) {
        // Network unreachable — don't clear tokens, keep user signed in for when network returns
        if (error.code === "ERR_NETWORK" || error.code === "ECONNABORTED") {
          throw error;
        }

        // Auth error — tokens are invalid, clear everything and force logout
        if (error.response) {
          const status = error.response.status;
          if (status === 400 || status === 401 || status === 403) {
            await clearAllTokens();
            try {
              sessionExpiredCallback?.();
            } catch {
              // callback must not crash the interceptor
            }
          }
        }
        throw error;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  };

  // Request interceptor: proactively refresh if token is near-expiry, then inject Bearer token.
  // This eliminates the round-trip: make request → get 401 → refresh → retry.
  api.interceptors.request.use(
    async (config) => {
      const isPublic = config.isPublic || false;

      if (isFormDataPayload(config.data)) {
        if (typeof config.headers?.delete === "function") {
          config.headers.delete("Content-Type");
        } else if (config.headers) {
          delete config.headers["Content-Type"];
          delete config.headers["content-type"];
        }
      }

      if (!isPublic) {
        let token = await getAccessToken();

        // Proactive refresh: if token expires within 30 s, refresh it before the request
        if (token && isTokenExpiredOrExpiring(token)) {
          try {
            token = await refreshAccessToken();
          } catch {
            // Refresh failed here — proceed with old token, response interceptor handles 401
          }
        }

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor: handle 401 → refresh → retry, and network errors → toast
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Network unreachable or timed out — show user-friendly toast, not raw error
      if (
        error.code === "ERR_NETWORK" ||
        error.code === "ECONNABORTED" ||
        error.message === "Network Error" ||
        !error.response
      ) {
        showNetworkToast();
        return Promise.reject(error);
      }

      const originalRequest = error.config;

      // 429 Too Many Requests — wait for Retry-After (capped at 8 s for UX) then retry once
      if (error.response?.status === 429 && !originalRequest._retry429) {
        originalRequest._retry429 = true;
        const retryAfterSec = parseInt(
          error.response.headers["retry-after"] || "5",
          10
        );
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(retryAfterSec, 8) * 1000)
        );
        return api(originalRequest);
      }

      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.isPublic
      ) {
        originalRequest._retry = true;

        try {
          const newToken = await refreshAccessToken();
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return api;
};

export default createApiService;

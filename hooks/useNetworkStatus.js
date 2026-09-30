import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reliable connectivity probe without external packages.
 *
 * Strategy:
 *   1. Try multiple well-known endpoints in parallel (Google 204, Cloudflare DNS)
 *   2. If ANY succeeds → online
 *   3. Require 2 consecutive failures before declaring offline (debounce false positives)
 *   4. Re-probe every INTERVAL_MS; faster after a failure
 */

const PROBE_ENDPOINTS = [
  // Google's no-content connectivity check — tiny, reliable, no payload
  "https://www.google.com/generate_204",
  // Cloudflare DNS over HTTPS — reliable fallback
  "https://1.1.1.1/cdn-cgi/trace",
];

const TIMEOUT_MS = 6000;
const INTERVAL_ONLINE_MS = 10000;   // probe every 10 s when online
const INTERVAL_OFFLINE_MS = 5000;  // probe every 5 s when offline (recover faster)
const FAILURE_THRESHOLD = 2;       // require N consecutive failures before going offline

async function probeOnce(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    clearTimeout(timer);
    // Accept any HTTP response as "online" — even 4xx means the network is up
    return res.status < 600;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

async function probeConnectivity() {
  // Race all endpoints — first success wins
  const results = await Promise.all(PROBE_ENDPOINTS.map(probeOnce));
  return results.some(Boolean);
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const failureCountRef = useRef(0);
  const timerRef = useRef(null);
  const isOnlineRef = useRef(true);

  const schedule = useCallback((delay) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(run, delay);
  }, []);

  const run = useCallback(async () => {
    const reachable = await probeConnectivity();

    if (reachable) {
      failureCountRef.current = 0;
      if (!isOnlineRef.current) {
        isOnlineRef.current = true;
        setIsOnline(true);
      }
      schedule(INTERVAL_ONLINE_MS);
    } else {
      failureCountRef.current += 1;
      if (failureCountRef.current >= FAILURE_THRESHOLD && isOnlineRef.current) {
        isOnlineRef.current = false;
        setIsOnline(false);
      }
      schedule(INTERVAL_OFFLINE_MS);
    }
  }, [schedule]);

  useEffect(() => {
    run();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [run]);

  return isOnline;
}

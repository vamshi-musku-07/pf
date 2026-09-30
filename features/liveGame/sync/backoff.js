// Exponential backoff with jitter. Returns ms to wait before next attempt.
export function backoff(attempts) {
  const base = 500;            // 0.5s
  const cap = 30_000;          // 30s ceiling
  const expo = Math.min(cap, base * Math.pow(2, Math.max(0, attempts - 1)));
  // Full jitter
  return Math.floor(Math.random() * expo);
}

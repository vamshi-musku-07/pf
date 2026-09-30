import { Buffer } from "buffer";

export const decodeJwtPayload = (token) => {
  if (typeof token !== "string") return null;

  try {
    const base64url = token.split(".")[1];
    if (!base64url) return null;

    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + (4 - (base64.length % 4)) % 4,
      "=",
    );

    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
};

export const willJwtExpireWithin = (
  token,
  bufferSeconds = 0,
  { treatMissingExpAsExpired = false } = {},
) => {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp);

  if (!Number.isFinite(exp)) {
    return treatMissingExpAsExpired;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  return exp - nowSec <= bufferSeconds;
};

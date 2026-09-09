import crypto from "node:crypto";

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function createShareToken(ttlMs) {
  const token = randomToken();
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) };
}

import crypto from "node:crypto";
import { env } from "../config/env.js";

export const ACCESS_COOKIE = "riq_access";
export const REFRESH_COOKIE = "riq_refresh";
export const CSRF_COOKIE = "riq_csrf";

function serialize(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || "/"}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge / 1000))}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

function cookieOptions(httpOnly, maxAge) {
  return { httpOnly, maxAge, secure: env.isProd, sameSite: env.isProd ? "None" : "Lax" };
}

export function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([name, value]) => name && value !== undefined).map(([name, ...value]) => {
    const raw = value.join("=");
    try { return [name, decodeURIComponent(raw)]; } catch { return [name, raw]; }
  }));
}

export function getCookie(req, name) {
  return parseCookies(req.headers.cookie || "")[name];
}

export function setAuthCookies(res, tokens) {
  res.append("Set-Cookie", serialize(ACCESS_COOKIE, tokens.accessToken, cookieOptions(true, 15 * 60 * 1000)));
  res.append("Set-Cookie", serialize(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(true, 7 * 24 * 60 * 60 * 1000)));
  res.append("Set-Cookie", serialize(CSRF_COOKIE, crypto.randomBytes(32).toString("base64url"), cookieOptions(false, 7 * 24 * 60 * 60 * 1000)));
}

export function clearAuthCookies(res) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
    res.append("Set-Cookie", serialize(name, "", { ...cookieOptions(name === CSRF_COOKIE ? false : true, 0) }));
  }
}

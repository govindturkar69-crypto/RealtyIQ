import crypto from "node:crypto";
import { CSRF_COOKIE, getCookie } from "../utils/authCookies.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const hasAuthCookie = Boolean(getCookie(req, "riq_access") || getCookie(req, "riq_refresh"));
  if (!hasAuthCookie) return next();
  const cookieToken = getCookie(req, CSRF_COOKIE);
  const headerToken = req.get("X-CSRF-Token");
  const cookieBytes = Buffer.from(cookieToken || "");
  const headerBytes = Buffer.from(headerToken || "");
  if (!cookieToken || !headerToken || cookieBytes.length !== headerBytes.length || !crypto.timingSafeEqual(cookieBytes, headerBytes)) {
    return res.status(403).json({ error: "CSRF validation failed", requestId: req.id });
  }
  next();
}

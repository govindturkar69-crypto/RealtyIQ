import { verifyAccessToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.js";
import { ACCESS_COOKIE, getCookie } from "../utils/authCookies.js";

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : getCookie(req, ACCESS_COOKIE);
  if (!token) return next(ApiError.unauthorized("Missing bearer token"));
  try {
    req.user = verifyAccessToken(token);
    const account = await User.findOne({ _id: req.user.sub, isActive: { $ne: false } }).select("role tokenVersion").lean();
    if (!account) {
      throw ApiError.forbidden("Account disabled or unavailable");
    }
    if ((req.user.ver || 0) !== (account.tokenVersion || 0)) {
      throw ApiError.unauthorized("Token revoked");
    }
    req.user.role = account.role;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden("Insufficient permissions"));
    }
    next();
  };
}

export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : getCookie(req, ACCESS_COOKIE);
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      const account = await User.findOne({ _id: decoded.sub, isActive: { $ne: false } }).select("role tokenVersion").lean();
      if (account && (decoded.ver || 0) === (account.tokenVersion || 0)) req.user = { ...decoded, role: account.role };
    } catch { /* Public routes ignore invalid or revoked optional credentials. */ }
  }
  next();
}

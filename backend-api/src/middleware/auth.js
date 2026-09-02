import { verifyAccessToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.js";

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized("Missing bearer token"));
  try {
    req.user = verifyAccessToken(token);
    const account = await User.findOne({ _id: req.user.sub, isActive: { $ne: false } }).select("role").lean();
    if (!account) {
      throw ApiError.forbidden("Account disabled or unavailable");
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

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) { try { req.user = verifyAccessToken(token); } catch {  } }
  next();
}

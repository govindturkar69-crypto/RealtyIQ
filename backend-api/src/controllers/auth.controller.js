import mongoose from "mongoose";
import { User } from "../models/User.js";
import { randomUUID } from "node:crypto";
import { Prediction } from "../models/Prediction.js";
import { SavedSearch } from "../models/SavedSearch.js";
import { Inquiry } from "../models/Inquiry.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import { getCookie, REFRESH_COOKIE, CSRF_COOKIE, setAuthCookies, setCsrfCookie, clearAuthCookies } from "../utils/authCookies.js";
import { hashToken } from "../utils/tokenHash.js";
import { recordSecurityEvent } from "../utils/securityEvent.js";
import { logger } from "../utils/logger.js";

function tokensFor(user) {
  const payload = { sub: String(user._id), role: user.role, email: user.email, ver: user.tokenVersion || 0, jti: randomUUID() };
  return { accessToken: signAccessToken(payload), refreshToken: signRefreshToken(payload) };
}

function authResponse(user, tokens) {
  return env.authCookieOnly ? { user } : { user, ...tokens };
}

function refreshRotationConflict(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "VersionError"
    || error?.code === 112
    || error?.hasErrorLabel?.("TransientTransactionError")
    || /write conflict|transient.?transaction.?error/.test(message);
}

async function invalidateRefreshSession(userId, req, user) {
  try {
    await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 }, $set: { refreshTokens: [], refreshTokenHashes: [] } });
  } catch (error) {
    logger.error("refresh_invalidation_failed", { requestId: req?.id, errorType: error?.name || "Error" });
  }
  await recordSecurityEvent(req, "refresh_token_reuse", user, {}, {
    actorUserId: null, targetUserId: userId, resourceType: "session", action: "refresh_reuse",
    result: "denied", reasonCode: "token_reuse",
  });
}

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.findOne({ email })) throw ApiError.conflict("Email already registered");
  const user = new User({ name, email });
  await user.setPassword(password);
  const { accessToken, refreshToken } = tokensFor(user);
  user.refreshTokens = [];
  user.refreshTokenHashes = [hashToken(refreshToken)];
  await user.save();
  setAuthCookies(res, { accessToken, refreshToken }, getCookie(req, CSRF_COOKIE));
  await recordSecurityEvent(req, "signup", user, {}, {
    actorUserId: null, targetUserId: user._id, resourceType: "user", resourceId: user._id,
    action: "create", result: "success",
  });
  res.status(201).json(authResponse(user, { accessToken, refreshToken }));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+passwordHash +refreshTokens +refreshTokenHashes");
  if (!user || !(await user.verifyPassword(password))) {
    await recordSecurityEvent(req, "login_failed", null, {}, {
      actorUserId: null, targetUserId: null, resourceType: "authentication", action: "login",
      result: "failure", reasonCode: "invalid_credentials",
    });
    throw ApiError.unauthorized("Invalid credentials");
  }
  if (!user.isActive) throw ApiError.forbidden("Account disabled");
  const { accessToken, refreshToken } = tokensFor(user);
  user.refreshTokens = [];
  user.refreshTokenHashes = [...(user.refreshTokenHashes || []), hashToken(refreshToken)].slice(-5);
  await user.save();
  setAuthCookies(res, { accessToken, refreshToken }, getCookie(req, CSRF_COOKIE));
  await recordSecurityEvent(req, "login_success", user, {}, {
    actorUserId: user._id, targetUserId: user._id, resourceType: "authentication", action: "login", result: "success",
  });
  res.json(authResponse(user, { accessToken, refreshToken }));
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = getCookie(req, REFRESH_COOKIE) || req.body?.refreshToken;
  if (!refreshToken) { clearAuthCookies(res); throw ApiError.unauthorized("Invalid refresh token"); }
  let decoded;
  try { decoded = verifyRefreshToken(refreshToken); } catch { clearAuthCookies(res); throw ApiError.unauthorized("Invalid refresh token"); }
  const user = await User.findById(decoded.sub).select("+refreshTokens +refreshTokenHashes");
  if (!user) { clearAuthCookies(res); throw ApiError.unauthorized("Refresh token revoked"); }
  if (!user.isActive) { clearAuthCookies(res); throw ApiError.forbidden("Account disabled"); }
  if ((decoded.ver || 0) !== (user.tokenVersion || 0)) { clearAuthCookies(res); throw ApiError.unauthorized("Refresh token revoked"); }
  const presentedHash = hashToken(refreshToken);
  const matches = (user.refreshTokenHashes || []).includes(presentedHash) || (user.refreshTokens || []).includes(refreshToken);
  if (!matches) {
    await invalidateRefreshSession(user._id, req, user);
    clearAuthCookies(res);
    throw ApiError.unauthorized("Refresh token revoked");
  }
  const tokens = tokensFor(user);
  const nextHashes = [...(user.refreshTokenHashes || []).filter((hash) => hash !== presentedHash), hashToken(tokens.refreshToken)].slice(-5);
  let rotated;
  try {
    rotated = await User.updateOne(
      { _id: user._id, tokenVersion: user.tokenVersion || 0, $or: [{ refreshTokenHashes: presentedHash }, { refreshTokens: refreshToken }] },
      { $set: { refreshTokens: [], refreshTokenHashes: nextHashes } },
    );
  } catch (error) {
    if (!refreshRotationConflict(error)) throw error;
    await invalidateRefreshSession(user._id, req, user);
    clearAuthCookies(res);
    throw ApiError.unauthorized("Refresh token revoked");
  }
  if (rotated.modifiedCount !== 1) {
    await invalidateRefreshSession(user._id, req, user);
    clearAuthCookies(res);
    throw ApiError.unauthorized("Refresh token revoked");
  }
  setAuthCookies(res, tokens, getCookie(req, CSRF_COOKIE));
  res.json(env.authCookieOnly ? {} : tokens);
});

export const csrf = asyncHandler(async (req, res) => {
  const csrfToken = setCsrfCookie(res, getCookie(req, CSRF_COOKIE));
  res.json({ csrfToken });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.sub);
  if (!user) throw ApiError.notFound("User not found");
  res.json({ user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.sub, { name: req.body.name }, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound("User not found");
  res.json({ user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.sub).select("+passwordHash +refreshTokens");
  if (!user || !(await user.verifyPassword(req.body.currentPassword))) {
    throw ApiError.unauthorized("Current password is incorrect");
  }
  await user.setPassword(req.body.newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.refreshTokens = [];
  user.refreshTokenHashes = [];
  await user.save();
  clearAuthCookies(res);
  await recordSecurityEvent(req, "password_changed", user, {}, {
    actorUserId: user._id, targetUserId: user._id, resourceType: "user", resourceId: user._id,
    action: "password_change", result: "success",
  });
  res.json({ success: true });
});

export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).select("name email role isActive createdAt").lean();
  res.json({ users: users.map((user) => ({ ...user, isActive: user.isActive !== false })) });
});

export const manageUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  const removesAdmin = user.role === "admin" && (req.body.role === "user" || req.body.isActive === false);
  if (removesAdmin && await User.countDocuments({ role: "admin", isActive: { $ne: false } }) <= 1) {
    throw ApiError.badRequest("The last active admin cannot be demoted or disabled");
  }
  if (req.body.role !== undefined) user.role = req.body.role;
  if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
  user.refreshTokens = [];
  await user.save();
  res.json({ user });
});

export const logout = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.sub).select("+refreshTokens +refreshTokenHashes");
  if (user) {
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.refreshTokens = [];
    user.refreshTokenHashes = [];
    await user.save();
    await recordSecurityEvent(req, "logout", user, {}, {
      actorUserId: user._id, targetUserId: user._id, resourceType: "session", resourceId: user._id,
      action: "logout", result: "success",
    });
  }
  clearAuthCookies(res);
  res.json({ success: true });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  let session;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const user = await User.findById(userId).select("role isActive").session(session).lean();
      let adminAnchor;
      if (user?.role === "admin" && user.isActive !== false) {
        const activeAdmins = await User.find({ role: "admin", isActive: { $ne: false } })
          .sort({ _id: 1 }).select("_id").session(session).lean();
        if (activeAdmins.length <= 1) throw ApiError.badRequest("The last active admin cannot be deleted");
        adminAnchor = activeAdmins[0]?._id;
      }
      await Prediction.deleteMany({ user: userId }).session(session);
      await SavedSearch.deleteMany({ user: userId }).session(session);
      await Inquiry.deleteMany({ user: userId }).session(session);
      if (adminAnchor) await User.updateOne({ _id: adminAnchor }, { $inc: { adminMutationVersion: 1 } }).session(session);
      await User.findByIdAndDelete(userId).session(session);
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Account deletion temporarily unavailable");
  } finally {
    if (session) await session.endSession();
  }
  clearAuthCookies(res);
  res.json({ success: true, message: "Account and all associated data have been deleted" });
});

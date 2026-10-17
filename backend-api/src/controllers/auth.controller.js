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
import { recordSecurityEvent, sanitizeSecurityEventMetadata } from "../utils/securityEvent.js";
import { SecurityEvent } from "../models/SecurityEvent.js";
import { paginate } from "../lib/queryBuilder.js";
import { dateRangeValue, MAX_DATE_RANGE_MS } from "../validators/adminQueue.schema.js";
import { logger } from "../utils/logger.js";

function tokensFor(user) {
  const payload = { sub: String(user._id), role: user.role, email: user.email, ver: user.tokenVersion || 0, jti: randomUUID() };
  return { accessToken: signAccessToken(payload), refreshToken: signRefreshToken(payload) };
}

function authResponse(user, tokens) {
  return env.authCookieOnly ? { user } : { user, ...tokens };
}

export function isAdminSetMutation(user, patch = {}) {
  return user?.role === "admin" || patch.role === "admin";
}

function transactionUnavailable(error) {
  const message = String(error?.message || "").toLowerCase();
  return /transaction numbers are only allowed|replica set|transaction.*not supported|transactions are not supported/.test(message);
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
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 20, maxLimit: 100 });
  const [users, total] = await Promise.all([
    User.find().sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).select("name email role isActive createdAt").lean(),
    User.countDocuments(),
  ]);
  const items = users.map((user) => ({ ...user, isActive: user.isActive !== false }));
  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

export const manageUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  let updatedUser = user;
  if (!isAdminSetMutation(user, req.body)) {
    if (req.body.role !== undefined) user.role = req.body.role;
    if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.refreshTokens = [];
    user.refreshTokenHashes = [];
    await user.save();
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const current = await User.findById(req.params.id).session(session);
        if (!current) throw ApiError.notFound("User not found");
        const removesAdmin = current.role === "admin" && current.isActive !== false
          && (req.body.role === "user" || req.body.role === "agent" || req.body.role === "broker" || req.body.isActive === false);
        if (removesAdmin && String(current._id) === String(req.user?.sub)) {
          throw ApiError.badRequest("Administrators cannot remove their own admin access");
        }
        const activeAdmins = await User.find({ role: "admin", isActive: { $ne: false } }).sort({ _id: 1 }).select("_id").session(session).lean();
        if (removesAdmin && activeAdmins.length <= 1) {
          throw ApiError.badRequest("The last active admin cannot be demoted or disabled");
        }
        if (req.body.role !== undefined) current.role = req.body.role;
        if (req.body.isActive !== undefined) current.isActive = req.body.isActive;
        current.tokenVersion = (current.tokenVersion || 0) + 1;
        current.refreshTokens = [];
        current.refreshTokenHashes = [];
        await current.save({ session });
        const anchor = activeAdmins[0]?._id || current._id;
        await User.updateOne({ _id: anchor }, { $inc: { adminMutationVersion: 1 } }).session(session);
        updatedUser = current;
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (transactionUnavailable(error)) throw new ApiError(503, "Admin role/status change temporarily unavailable");
      throw error;
    } finally {
      await session.endSession();
    }
  }
  await recordSecurityEvent(req, "admin_user_updated", req.user, {
    action: "update",
    result: "success",
    resourceType: "user",
    resourceId: String(updatedUser._id),
    targetUserId: String(updatedUser._id),
    role: updatedUser.role,
    isActive: updatedUser.isActive !== false,
  }, {
    actorUserId: req.user, targetUserId: updatedUser._id, resourceType: "user", resourceId: updatedUser._id,
    action: "update", result: "success",
  });
  res.json({ user: updatedUser });
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

const LEGACY_ACTOR_EVENTS = [
  "login_success", "password_changed", "logout", "admin_user_updated",
  "admin_listing_created", "admin_listings_imported", "admin_listing_updated",
  "admin_listing_deleted", "admin_listing_restored", "admin_inquiry_status_updated",
];
const LEGACY_TARGET_EVENTS = [
  "signup", "login_success", "refresh_token_reuse", "password_changed", "logout", "admin_bootstrap",
];

function addEventFieldFilter(clauses, normalizedField, legacyField, value, legacyTypes) {
  if (!value) return;
  const legacyMatch = legacyTypes.includes("*")
    ? { [legacyField]: value }
    : { type: { $in: legacyTypes }, [legacyField]: value };
  clauses.push({
    $or: [
      { [normalizedField]: value },
      legacyMatch,
    ],
  });
}

export function buildSecurityEventFilter(query = {}, now = new Date()) {
  const filter = {};
  const clauses = [];
  if (query.type) filter.type = query.type;
  if (query.actorUserId) addEventFieldFilter(clauses, "actorUserId", "user", query.actorUserId, LEGACY_ACTOR_EVENTS);
  if (query.targetUserId) {
    clauses.push({ $or: [
      { targetUserId: query.targetUserId },
      { type: "admin_user_updated", "metadata.targetUserId": query.targetUserId },
      { type: { $in: LEGACY_TARGET_EVENTS }, user: query.targetUserId },
    ] });
  }
  if (query.action) addEventFieldFilter(clauses, "action", "metadata.action", query.action, ["*"]);
  if (query.resourceType) addEventFieldFilter(clauses, "resourceType", "metadata.resourceType", query.resourceType, ["*"]);
  if (query.result) addEventFieldFilter(clauses, "result", "metadata.result", query.result, ["*"]);
  if (query.resourceId) addEventFieldFilter(clauses, "resourceId", "metadata.resourceId", query.resourceId, ["*"]);
  if (query.requestId) filter.requestId = query.requestId;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = dateRangeValue(query.from);
    if (query.to && !query.from) filter.createdAt.$gte = new Date(new Date(now).getTime() - MAX_DATE_RANGE_MS);
    if (query.to) filter.createdAt.$lt = dateRangeValue(query.to, true);
  }
  if (clauses.length) filter.$and = clauses;
  return filter;
}

function publicId(value) {
  return value == null ? null : String(value);
}

function legacyActorUserId(event) {
  return LEGACY_ACTOR_EVENTS.includes(event.type) ? publicId(event.user) : null;
}

function legacyTargetUserId(event) {
  if (event.targetUserId) return publicId(event.targetUserId);
  if (event.type === "admin_user_updated") return publicId(event.metadata?.targetUserId);
  return LEGACY_TARGET_EVENTS.includes(event.type) ? publicId(event.user) : null;
}

export function sanitizeSecurityEvent(event) {
  const metadata = sanitizeSecurityEventMetadata(event.metadata);
  return {
    _id: event._id,
    type: event.type,
    user: publicId(event.user),
    actorUserId: publicId(event.actorUserId) || legacyActorUserId(event),
    targetUserId: publicId(event.targetUserId) || legacyTargetUserId(event),
    resourceType: event.resourceType || metadata.resourceType || null,
    resourceId: event.resourceId || metadata.resourceId || null,
    action: event.action || metadata.action || null,
    result: event.result || metadata.result || null,
    reasonCode: event.reasonCode || metadata.reasonCode || null,
    requestId: event.requestId,
    ip: event.ip,
    userAgent: event.userAgent,
    metadata,
    createdAt: event.createdAt,
  };
}

export const listSecurityEvents = asyncHandler(async (req, res) => {
  const filter = buildSecurityEventFilter(req.query);
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 20, maxLimit: 100 });
  const [events, total] = await Promise.all([
    SecurityEvent.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).select("type user actorUserId targetUserId resourceType resourceId action result reasonCode requestId ip userAgent metadata createdAt").lean(),
    SecurityEvent.countDocuments(filter),
  ]);
  res.json({ items: events.map(sanitizeSecurityEvent), page, limit, total, totalPages: Math.ceil(total / limit) });
});

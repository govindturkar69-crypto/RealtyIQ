import { User } from "../models/User.js";
import { Prediction } from "../models/Prediction.js";
import { SavedSearch } from "../models/SavedSearch.js";
import { Inquiry } from "../models/Inquiry.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";

function tokensFor(user) {
  const payload = { sub: String(user._id), role: user.role, email: user.email };
  return { accessToken: signAccessToken(payload), refreshToken: signRefreshToken(payload) };
}

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.findOne({ email })) throw ApiError.conflict("Email already registered");
  const user = new User({ name, email });
  await user.setPassword(password);
  const { accessToken, refreshToken } = tokensFor(user);
  user.refreshTokens = [refreshToken];
  await user.save();
  res.status(201).json({ user, accessToken, refreshToken });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+passwordHash +refreshTokens");
  if (!user || !(await user.verifyPassword(password))) throw ApiError.unauthorized("Invalid credentials");
  if (!user.isActive) throw ApiError.forbidden("Account disabled");
  const { accessToken, refreshToken } = tokensFor(user);
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
  await user.save();
  res.json({ user, accessToken, refreshToken });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  let decoded;
  try { decoded = verifyRefreshToken(refreshToken); } catch { throw ApiError.unauthorized("Invalid refresh token"); }
  const user = await User.findById(decoded.sub).select("+refreshTokens");
  if (!user || !(user.refreshTokens || []).includes(refreshToken)) throw ApiError.unauthorized("Refresh token revoked");
  if (!user.isActive) throw ApiError.forbidden("Account disabled");
  const tokens = tokensFor(user);
  user.refreshTokens = [...user.refreshTokens.filter((t) => t !== refreshToken).slice(-4), tokens.refreshToken];
  await user.save();
  res.json(tokens);
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
  user.refreshTokens = [];
  await user.save();
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
  const { refreshToken } = req.body || {};
  const user = await User.findById(req.user.sub).select("+refreshTokens");
  if (user && refreshToken) {
    user.refreshTokens = (user.refreshTokens || []).filter((t) => t !== refreshToken);
    await user.save();
  }
  res.json({ success: true });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const user = await User.findById(userId).select("role isActive");
  if (user?.role === "admin" && user.isActive !== false && await User.countDocuments({ role: "admin", isActive: { $ne: false } }) <= 1) {
    throw ApiError.badRequest("The last active admin cannot be deleted");
  }
  await Promise.all([
    Prediction.deleteMany({ user: userId }),
    SavedSearch.deleteMany({ user: userId }),
    Inquiry.deleteMany({ user: userId }),
    User.findByIdAndDelete(userId),
  ]);
  res.json({ success: true, message: "Account and all associated data have been deleted" });
});

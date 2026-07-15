import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export const listFavorites = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.sub).populate("favorites");
  res.json({ items: user?.favorites ?? [] });
});

export const favoriteIds = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.sub).select("favorites");
  res.json({ ids: (user?.favorites ?? []).map((id) => String(id)) });
});

export const addFavorite = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.sub,
    { $addToSet: { favorites: req.params.id } },
    { new: true }
  ).select("favorites");
  if (!user) throw ApiError.notFound("User not found");
  res.json({ ids: user.favorites.map((id) => String(id)) });
});

export const removeFavorite = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.sub,
    { $pull: { favorites: req.params.id } },
    { new: true }
  ).select("favorites");
  if (!user) throw ApiError.notFound("User not found");
  res.json({ ids: user.favorites.map((id) => String(id)) });
});

import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Listing } from "../models/Listing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { activeListingFilter, paginate } from "../lib/queryBuilder.js";
import { env } from "../config/env.js";

export const boundedFavoriteIds = (ids, max) => (Array.isArray(ids) ? ids : []).slice(0, max).map((id) => String(id));

export const buildFavoriteAdmissionFilter = (userId, listingId, max) => ({
  _id: userId,
  $or: [
    { favorites: listingId },
    { $expr: { $lt: [{ $size: { $ifNull: ["$favorites", []] } }, max] } },
  ],
});

export const listFavorites = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 24, maxLimit: 100 });
  const [summary] = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.user.sub) } },
    {
      $lookup: {
        from: "listings",
        localField: "favorites",
        foreignField: "_id",
        pipeline: [{ $match: activeListingFilter() }, { $project: { _id: 1 } }],
        as: "activeListings",
      },
    },
    {
      $set: {
        activeFavoriteIds: {
          $filter: {
            input: { $ifNull: ["$favorites", []] },
            as: "favoriteId",
            cond: { $in: ["$$favoriteId", "$activeListings._id"] },
          },
        },
      },
    },
    {
      $project: {
        favorites: { $slice: ["$activeFavoriteIds", skip, limit] },
        total: { $size: "$activeFavoriteIds" },
      },
    },
  ]);
  if (!summary) throw ApiError.notFound("User not found");
  const ids = summary.favorites ?? [];
  const listings = await Listing.find({ _id: { $in: ids }, ...activeListingFilter() }).lean();
  const byId = new Map(listings.map((listing) => [String(listing._id), listing]));
  const items = ids.map((id) => byId.get(String(id))).filter(Boolean);
  res.json({ items, page, limit, total: summary.total, totalPages: Math.ceil(summary.total / limit) });
});

export const favoriteIds = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.sub).select("favorites");
  res.json({ ids: boundedFavoriteIds(user?.favorites, env.favoriteLimit) });
});

export const addFavorite = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound("Listing not found");
  if (!(await Listing.exists({ _id: req.params.id, ...activeListingFilter() }))) throw ApiError.notFound("Listing not found");
  const user = await User.findByIdAndUpdate(
    buildFavoriteAdmissionFilter(req.user.sub, req.params.id, env.favoriteLimit),
    { $addToSet: { favorites: req.params.id } },
    { new: true }
  ).select("favorites");
  if (!user) {
    const account = await User.exists({ _id: req.user.sub });
    if (!account) throw ApiError.notFound("User not found");
    throw ApiError.badRequest(`Favorite limit reached (${env.favoriteLimit})`);
  }
  res.json({ ids: boundedFavoriteIds(user.favorites, env.favoriteLimit) });
});

export const removeFavorite = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound("Listing not found");
  const user = await User.findByIdAndUpdate(
    req.user.sub,
    { $pull: { favorites: req.params.id } },
    { new: true }
  ).select("favorites");
  if (!user) throw ApiError.notFound("User not found");
  res.json({ ids: boundedFavoriteIds(user.favorites, env.favoriteLimit) });
});

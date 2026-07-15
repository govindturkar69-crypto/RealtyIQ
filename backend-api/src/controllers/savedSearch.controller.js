import { SavedSearch } from "../models/SavedSearch.js";
import { Listing } from "../models/Listing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { buildListingQuery } from "../lib/queryBuilder.js";

export const listSaved = asyncHandler(async (req, res) => {
  const items = await SavedSearch.find({ user: req.user.sub }).sort({ createdAt: -1 }).lean();
  const withCounts = await Promise.all(items.map(async (s) => {
    const count = await Listing.countDocuments(buildListingQuery(s.filters));
    return { ...s, matchCount: count, newMatches: Math.max(0, count - (s.lastNotifiedCount || 0)) };
  }));
  res.json({ items: withCounts });
});

export const createSaved = asyncHandler(async (req, res) => {
  const count = await Listing.countDocuments(buildListingQuery(req.body.filters));
  const saved = await SavedSearch.create({ ...req.body, user: req.user.sub, lastNotifiedCount: count });
  res.status(201).json(saved);
});

export const deleteSaved = asyncHandler(async (req, res) => {
  const saved = await SavedSearch.findOneAndDelete({ _id: req.params.id, user: req.user.sub });
  if (!saved) throw ApiError.notFound("Saved search not found");
  res.json({ success: true });
});

export const markNotified = asyncHandler(async (req, res) => {
  const saved = await SavedSearch.findOne({ _id: req.params.id, user: req.user.sub });
  if (!saved) throw ApiError.notFound("Saved search not found");
  saved.lastNotifiedCount = await Listing.countDocuments(buildListingQuery(saved.filters));
  await saved.save();
  res.json(saved);
});

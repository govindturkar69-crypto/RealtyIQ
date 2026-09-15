import { SavedSearch } from "../models/SavedSearch.js";
import { Listing } from "../models/Listing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { buildListingQuery } from "../lib/queryBuilder.js";
import { savedSearchSchema } from "../validators/savedSearch.schema.js";

const hasValidFilters = (filters) => savedSearchSchema.shape.filters.safeParse(filters).success;

const quarantinedSavedSearch = (saved) => ({
  _id: String(saved._id),
  name: typeof saved.name === "string" ? saved.name : "Saved search",
  status: "quarantined",
  quarantineReason: "INVALID_FILTERS",
  ...(saved.createdAt ? { createdAt: saved.createdAt } : {}),
  ...(saved.updatedAt ? { updatedAt: saved.updatedAt } : {}),
});

export const listSaved = asyncHandler(async (req, res) => {
  const items = await SavedSearch.find({ user: req.user.sub }).sort({ createdAt: -1 }).lean();
  const entries = items.map((saved) => hasValidFilters(saved.filters) ? { saved, valid: true } : { saved: quarantinedSavedSearch(saved), valid: false });
  const validItems = entries.filter((entry) => entry.valid).map((entry) => entry.saved);
  const facets = Object.fromEntries(validItems.map((s, index) => [
    `search_${index}`,
    [{ $match: buildListingQuery(s.filters) }, { $count: "count" }],
  ]));
  const [counts] = validItems.length ? await Listing.aggregate([{ $facet: facets }]) : [{}];
  let validIndex = 0;
  const withCounts = entries.map(({ saved, valid }) => {
    if (!valid) return saved;
    const count = counts[`search_${validIndex}`]?.[0]?.count || 0;
    const result = { ...saved, matchCount: count, newMatches: Math.max(0, count - (saved.lastNotifiedCount || 0)) };
    validIndex += 1;
    return result;
  });
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
  if (!hasValidFilters(saved.filters)) throw ApiError.conflict("Saved search is unavailable");
  saved.lastNotifiedCount = await Listing.countDocuments(buildListingQuery(saved.filters));
  await saved.save();
  res.json(saved);
});

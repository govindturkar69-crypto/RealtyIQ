import { createHmac } from "node:crypto";
import mongoose from "mongoose";
import { SavedSearch } from "../models/SavedSearch.js";
import { User } from "../models/User.js";
import { Listing } from "../models/Listing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { buildActiveListingQuery } from "../lib/queryBuilder.js";
import { env } from "../config/env.js";
import { savedSearchSchema } from "../validators/savedSearch.schema.js";
import { logger } from "../utils/logger.js";

const isTransactionUnavailable = (error) => /transaction numbers are only allowed|replica set|transactions are not supported|transaction not supported|standalone|does not support sessions|topology does not support/i.test(String(error?.message || ""));
const MAX_ACK_COUNT = 1_000_000_000;
const MAX_ACK_DURATION_MS = 60_000;

const boundedCount = (value) => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, MAX_ACK_COUNT) : undefined;
const boundedRequestId = (value) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : "invalid";
};
const savedSearchFingerprint = (value) => {
  try {
    return createHmac("sha256", env.jwt.accessSecret).update(String(value)).digest("hex").slice(0, 12);
  } catch {
    return undefined;
  }
};
const acknowledgementOutcome = (error) => {
  if (error?.statusCode === 404) return "not_found";
  if (error?.statusCode === 409) return "quarantined";
  if (["MongoError", "MongoServerError", "MongoNetworkError", "MongooseError"].includes(error?.name)) return "database_error";
  return "error";
};
const acknowledgementDirection = (previousAnchor, computedCount) => {
  if (previousAnchor === undefined || computedCount === undefined) return undefined;
  if (computedCount > previousAnchor) return "increased";
  if (computedCount < previousAnchor) return "decreased";
  return "unchanged";
};
const emitAcknowledgementTelemetry = (fields) => {
  try {
    logger.info("saved_search_acknowledgement", fields);
  } catch {
    // Telemetry must never alter acknowledgement semantics.
  }
};

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
    [{ $match: buildActiveListingQuery(s.filters) }, { $count: "count" }],
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
  const session = await mongoose.startSession();
  let saved;
  try {
    await session.withTransaction(async () => {
      const account = await User.findById(req.user.sub).select("_id").session(session);
      if (!account) throw ApiError.notFound("User not found");
      const anchored = await User.updateOne(
        { _id: req.user.sub },
        { $inc: { savedSearchMutationVersion: 1 } },
        { session }
      );
      if (anchored.matchedCount !== 1) throw ApiError.notFound("User not found");
      if (await SavedSearch.countDocuments({ user: req.user.sub }).session(session) >= env.savedSearchLimit) {
        throw ApiError.badRequest(`Saved search limit reached (${env.savedSearchLimit})`);
      }
      const count = await Listing.countDocuments(buildActiveListingQuery(req.body.filters)).session(session);
      [saved] = await SavedSearch.create([{ ...req.body, user: req.user.sub, lastNotifiedCount: count }], { session });
    });
  } catch (error) {
    if (isTransactionUnavailable(error)) throw new ApiError(503, "Saved search creation temporarily unavailable");
    throw error;
  } finally {
    await session.endSession();
  }
  res.status(201).json(saved);
});

export const deleteSaved = asyncHandler(async (req, res) => {
  const saved = await SavedSearch.findOneAndDelete({ _id: req.params.id, user: req.user.sub });
  if (!saved) throw ApiError.notFound("Saved search not found");
  res.json({ success: true });
});

export const markNotified = asyncHandler(async (req, res) => {
  const startedAtMs = Date.now();
  const startedAt = process.hrtime.bigint();
  const routeId = req.params?.id;
  let savedSearchId = routeId;
  let previousAnchor;
  let computedCount;
  let outcome = "error";
  try {
    const saved = await SavedSearch.findOne({ _id: routeId, user: req.user.sub });
    if (!saved) {
      outcome = "not_found";
      throw ApiError.notFound("Saved search not found");
    }
    savedSearchId = saved._id;
    previousAnchor = boundedCount(saved.lastNotifiedCount);
    if (!hasValidFilters(saved.filters)) {
      outcome = "quarantined";
      throw ApiError.conflict("Saved search is unavailable");
    }
    const nextAcknowledgementCount = await Listing.countDocuments(buildActiveListingQuery(saved.filters));
    computedCount = boundedCount(nextAcknowledgementCount);
    saved.lastNotifiedCount = nextAcknowledgementCount;
    await saved.save();
    outcome = "success";
    res.json(saved);
  } catch (error) {
    if (outcome === "error") outcome = acknowledgementOutcome(error);
    throw error;
  } finally {
    const completedAtMs = Date.now();
    const durationMs = Math.min(MAX_ACK_DURATION_MS, Math.max(0, Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6)));
    emitAcknowledgementTelemetry({
      requestId: boundedRequestId(req.id),
      ...(outcome === "success" || outcome === "database_error" ? { savedSearchFingerprint: savedSearchFingerprint(savedSearchId) } : {}),
      startedAtMs,
      completedAtMs,
      durationMs,
      outcome,
      previousAnchor,
      computedCount,
      countDirection: acknowledgementDirection(previousAnchor, computedCount),
      replayOrConflict: "unknown",
    });
  }
});

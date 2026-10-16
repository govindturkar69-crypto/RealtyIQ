import { Listing } from "../models/Listing.js";
import { Prediction } from "../models/Prediction.js";
import { mlService } from "../services/ml.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { computeDealVerdict } from "../lib/deal.js";
import { env } from "../config/env.js";
import { createShareToken } from "../utils/tokenHash.js";
import { activeListingFilter } from "../lib/queryBuilder.js";

export const compare = asyncHandler(async (req, res) => {
  const { listingIds } = req.body;
  const found = await Listing.find({ _id: { $in: listingIds }, ...activeListingFilter() }).lean();
  const byId = new Map(found.map((listing) => [String(listing._id), listing]));
  const listings = listingIds.map((id) => byId.get(id));
  if (listings.some((listing) => !listing)) throw ApiError.badRequest("One or more listings not found");

  const items = await Promise.all(
    listings.map(async (l) => {
      let predicted = null;
      let predictionStatus = "unavailable";
      try {
        const p = await mlService.predict({
          location: l.locality,
          area_type: l.areaType || "Super built-up Area",
          availability_status: l.availabilityStatus || "Ready To Move",
          total_sqft: l.totalSqft, bhk: l.bhk, bath: l.bath, balcony: l.balcony || 0,
        }, req.id);
        predicted = p;
        predictionStatus = "available";
      } catch {
        // Keep successful comparison items usable when an ML estimate is unavailable.
      }
      if (predicted && req.user) {
        try {
          const share = createShareToken(env.shareTokenTtlMs);
          await Prediction.create({
            user: req.user.sub,
            input: { listingId: l._id, locality: l.locality }, locality: l.locality,
            predictedPrice: predicted.predicted_price, confidenceLow: predicted.confidence_low,
            confidenceHigh: predicted.confidence_high, pricePerSqft: predicted.price_per_sqft, modelName: predicted.model_name,
            shareTokenHash: share.hash,
            shareExpiresAt: share.expiresAt,
            expiresAt: new Date(Date.now() + env.predictionRetentionDays * 24 * 60 * 60 * 1000),
          });
        } catch {
          // Prediction history is best-effort and must not hide a valid estimate.
        }
      }
      const deal = predicted ? computeDealVerdict(l.price, predicted.predicted_price) : { verdict: "unknown", deltaPct: null };
      return {
        listing: l,
        listedPrice: l.price,
        predictedPrice: predicted?.predicted_price ?? null,
        confidenceLow: predicted?.confidence_low ?? null,
        confidenceHigh: predicted?.confidence_high ?? null,
        predictionStatus,
        deal,
      };
    })
  );
  res.json({ items, degraded: items.some((item) => item.predictionStatus === "unavailable") });
});

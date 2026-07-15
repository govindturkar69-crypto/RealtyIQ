import { Listing } from "../models/Listing.js";
import { Prediction } from "../models/Prediction.js";
import { mlService } from "../services/ml.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { computeDealVerdict } from "../lib/deal.js";

export const compare = asyncHandler(async (req, res) => {
  const { listingIds } = req.body;
  const listings = await Listing.find({ _id: { $in: listingIds } }).lean();
  if (listings.length !== listingIds.length) throw ApiError.badRequest("One or more listings not found");

  const items = await Promise.all(
    listings.map(async (l) => {
      let predicted = null;
      try {
        const p = await mlService.predict({
          location: l.locality,
          area_type: l.areaType || "Super built-up Area",
          availability_status: l.availabilityStatus || "Ready To Move",
          total_sqft: l.totalSqft, bhk: l.bhk, bath: l.bath, balcony: l.balcony || 0,
        });
        predicted = p;
        await Prediction.create({
          input: { listingId: l._id, locality: l.locality }, locality: l.locality,
          predictedPrice: p.predicted_price, confidenceLow: p.confidence_low,
          confidenceHigh: p.confidence_high, pricePerSqft: p.price_per_sqft, modelName: p.model_name,
        });
      } catch { /* ML optional in compare */ }
      const deal = predicted ? computeDealVerdict(l.price, predicted.predicted_price) : { verdict: "unknown", deltaPct: null };
      return {
        listing: l,
        listedPrice: l.price,
        predictedPrice: predicted?.predicted_price ?? null,
        confidenceLow: predicted?.confidence_low ?? null,
        confidenceHigh: predicted?.confidence_high ?? null,
        deal,
      };
    })
  );
  res.json({ items });
});

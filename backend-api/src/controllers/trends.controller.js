import { Listing } from "../models/Listing.js";
import { Prediction } from "../models/Prediction.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildTrendPipeline, buildLocalityRankingPipeline } from "../lib/trends.js";

export const priceTrends = asyncHandler(async (req, res) => {
  const series = await Listing.aggregate(buildTrendPipeline({
    locality: req.query.locality, propertyType: req.query.propertyType,
    city: req.query.city, months: Number(req.query.months || 24),
  }));
  res.json({ series });
});

export const localityRanking = asyncHandler(async (req, res) => {
  const ranking = await Listing.aggregate(buildLocalityRankingPipeline({ limit: Number(req.query.limit || 10) }));
  res.json({ ranking });
});

export const adminStats = asyncHandler(async (req, res) => {
  const [listings, predictions, users, topSearched] = await Promise.all([
    Listing.countDocuments(),
    Prediction.countDocuments(),
    User.countDocuments(),
    Prediction.aggregate([
      { $match: { locality: { $ne: null } } },
      { $group: { _id: "$locality", searches: { $sum: 1 }, avgPredicted: { $avg: "$predictedPrice" } } },
      { $sort: { searches: -1 } }, { $limit: 10 },
      { $project: { _id: 0, locality: "$_id", searches: 1, avgPredicted: { $round: ["$avgPredicted", 0] } } },
    ]),
  ]);
  res.json({ totals: { listings, predictions, users }, topSearchedLocalities: topSearched });
});

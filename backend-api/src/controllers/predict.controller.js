import { Prediction } from "../models/Prediction.js";
import { mlService } from "../services/ml.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const predict = asyncHandler(async (req, res) => {
  const result = await mlService.predict(req.body);
  const record = await Prediction.create({
    user: req.user?.sub,
    input: req.body,
    predictedPrice: result.predicted_price,
    confidenceLow: result.confidence_low,
    confidenceHigh: result.confidence_high,
    pricePerSqft: result.price_per_sqft,
    modelName: result.model_name,
    locality: req.body.location,
  });
  res.json({ ...result, predictionId: record._id });
});

export const featureImportance = asyncHandler(async (req, res) => {
  const top = Number(req.query.top || 15);
  res.json(await mlService.featureImportance(top));
});

export const options = asyncHandler(async (req, res) => {
  res.json(await mlService.localities());
});

export const history = asyncHandler(async (req, res) => {
  const items = await Prediction.find({ user: req.user.sub }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ items });
});

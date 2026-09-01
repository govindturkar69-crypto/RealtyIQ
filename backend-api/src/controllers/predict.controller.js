import { Prediction } from "../models/Prediction.js";
import { mlService } from "../services/ml.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Listing } from "../models/Listing.js";

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
  try {
    res.json(await mlService.localities());
  } catch {
    const location = (await Listing.distinct("locality")).sort();
    res.json({ categorical: {
      location,
      area_type: ["Built-up Area", "Carpet Area", "Plot Area", "Super built-up Area"],
      availability_status: ["Ready To Move", "Under Construction"],
    } });
  }
});

export const history = asyncHandler(async (req, res) => {
  const items = await Prediction.find({ user: req.user.sub }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ items });
});

export const getPredictionById = asyncHandler(async (req, res) => {
  const record = await Prediction.findById(req.params.id).lean();
  if (!record) throw ApiError.notFound("Prediction not found");
  res.json({
    input: record.input,
    predicted_price: record.predictedPrice,
    confidence_low: record.confidenceLow,
    confidence_high: record.confidenceHigh,
    price_per_sqft: record.pricePerSqft,
    model_name: record.modelName,
    locality: record.locality,
    createdAt: record.createdAt,
  });
});

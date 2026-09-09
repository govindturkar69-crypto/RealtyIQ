import { Prediction } from "../models/Prediction.js";
import mongoose from "mongoose";
import { mlService } from "../services/ml.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Listing } from "../models/Listing.js";
import { env } from "../config/env.js";
import { createShareToken, hashToken } from "../utils/tokenHash.js";

export const predict = asyncHandler(async (req, res) => {
  const result = await mlService.predict(req.body);
  const share = createShareToken(env.shareTokenTtlMs);
  const record = await Prediction.create({
    user: req.user?.sub,
    isAnonymous: !req.user,
    input: req.body,
    predictedPrice: result.predicted_price,
    confidenceLow: result.confidence_low,
    confidenceHigh: result.confidence_high,
    pricePerSqft: result.price_per_sqft,
    modelName: result.model_name,
    locality: req.body.location,
    shareTokenHash: share.hash,
    shareExpiresAt: share.expiresAt,
    expiresAt: new Date(Date.now() + (req.user ? env.predictionRetentionDays : 1) * 24 * 60 * 60 * 1000),
  });
  res.json({ ...result, predictionId: share.token });
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

export function isLegacyShareable(record, now = new Date(), graceMs = env.legacyShareGraceMs) {
  return Boolean(
    record &&
    !record.shareTokenHash &&
    !record.shareRevokedAt &&
    (!record.expiresAt || new Date(record.expiresAt) > now) &&
    now - new Date(record.createdAt) <= graceMs,
  );
}

export async function findPublicPrediction(id, now = new Date(), model = Prediction) {
  if (/^[A-Za-z0-9_-]{40,}$/.test(id)) {
    return model.findOne({
      shareTokenHash: hashToken(id),
      shareRevokedAt: { $exists: false },
      shareExpiresAt: { $gt: now },
      expiresAt: { $gt: now },
    }).select("+shareTokenHash").lean();
  }
  if (/^[a-f\d]{24}$/i.test(id)) {
    const record = await model.findById(id).select("+shareTokenHash").lean();
    return isLegacyShareable(record, now) ? record : null;
  }
  return null;
}

export const getPredictionById = asyncHandler(async (req, res) => {
  const record = await findPublicPrediction(req.params.id);
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

async function ownedPrediction(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound("Prediction not found");
  const record = await Prediction.findById(req.params.id).select("+shareTokenHash");
  if (!record || (req.user.role !== "admin" && String(record.user) !== String(req.user.sub))) throw ApiError.notFound("Prediction not found");
  if (record.expiresAt && record.expiresAt <= new Date()) throw ApiError.notFound("Prediction not found");
  return record;
}

export const sharePrediction = asyncHandler(async (req, res) => {
  const record = await ownedPrediction(req);
  const share = createShareToken(env.shareTokenTtlMs);
  record.shareTokenHash = share.hash;
  record.shareExpiresAt = share.expiresAt;
  record.shareRevokedAt = undefined;
  await record.save();
  res.json({ shareToken: share.token, expiresAt: record.shareExpiresAt });
});

export const revokeShare = asyncHandler(async (req, res) => {
  const record = await ownedPrediction(req);
  record.shareRevokedAt = new Date();
  await record.save();
  res.json({ success: true });
});

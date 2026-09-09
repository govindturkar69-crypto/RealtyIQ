import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    input: { type: Object, required: true },
    predictedPrice: { type: Number, required: true },
    confidenceLow: { type: Number, required: true },
    confidenceHigh: { type: Number, required: true },
    pricePerSqft: { type: Number },
    modelName: { type: String },
    locality: { type: String, index: true },
    isAnonymous: { type: Boolean, default: false, index: true },
    shareTokenHash: { type: String, index: true, select: false },
    shareExpiresAt: { type: Date },
    shareRevokedAt: { type: Date },
    expiresAt: { type: Date, index: true, expires: 0 },
  },
  { timestamps: true }
);

export const Prediction = mongoose.model("Prediction", predictionSchema);

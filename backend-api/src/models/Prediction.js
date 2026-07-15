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
  },
  { timestamps: true }
);

export const Prediction = mongoose.model("Prediction", predictionSchema);

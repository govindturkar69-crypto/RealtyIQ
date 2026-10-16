import mongoose from "mongoose";

const savedSearchSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    filters: { type: Object, required: true },
    lastNotifiedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

savedSearchSchema.index({ user: 1, createdAt: -1 });

export const SavedSearch = mongoose.model("SavedSearch", savedSearchSchema);

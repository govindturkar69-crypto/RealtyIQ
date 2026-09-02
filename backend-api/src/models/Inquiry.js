import mongoose from "mongoose";

const inquirySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ["new", "contacted", "closed"], default: "new", index: true },
}, { timestamps: true });

export const Inquiry = mongoose.model("Inquiry", inquirySchema);

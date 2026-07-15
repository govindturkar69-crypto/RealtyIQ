import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    city: { type: String, default: "Bengaluru", index: true },
    locality: { type: String, required: true, index: true },
    propertyType: { type: String, enum: ["Apartment", "Villa", "Plot"], default: "Apartment", index: true },
    areaType: { type: String },
    availabilityStatus: { type: String, enum: ["Ready To Move", "Under Construction"], default: "Ready To Move" },
    totalSqft: { type: Number, required: true },
    bhk: { type: Number, required: true, index: true },
    bath: { type: Number, required: true },
    balcony: { type: Number, default: 0 },
    price: { type: Number, required: true, index: true },
    pricePerSqft: { type: Number, required: true },
    location: { lat: Number, lng: Number },
    images: { type: [String], default: [] },
    description: { type: String, default: "" },
    listedDate: { type: Date, default: Date.now, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

listingSchema.index({ locality: 1, price: 1 });

export const Listing = mongoose.model("Listing", listingSchema);

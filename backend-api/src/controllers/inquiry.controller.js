import { Inquiry } from "../models/Inquiry.js";
import { Listing } from "../models/Listing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

const populate = ["listing", "title locality", "user", "name email"];

export const createInquiry = asyncHandler(async (req, res) => {
  if (!(await Listing.exists({ _id: req.body.listingId }))) throw ApiError.notFound("Listing not found");
  const inquiry = await Inquiry.create({ user: req.user.sub, listing: req.body.listingId, message: req.body.message });
  res.status(201).json(inquiry);
});

export const myInquiries = asyncHandler(async (req, res) => {
  const items = await Inquiry.find({ user: req.user.sub }).populate(populate[0], populate[1]).sort({ createdAt: -1 }).lean();
  res.json({ items });
});

export const allInquiries = asyncHandler(async (req, res) => {
  const items = await Inquiry.find().populate(populate[0], populate[1]).populate(populate[2], populate[3]).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ items });
});

export const updateInquiry = asyncHandler(async (req, res) => {
  const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate(populate[0], populate[1]).populate(populate[2], populate[3]);
  if (!inquiry) throw ApiError.notFound("Inquiry not found");
  res.json(inquiry);
});

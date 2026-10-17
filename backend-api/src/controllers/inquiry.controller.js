import mongoose from "mongoose";
import { Inquiry } from "../models/Inquiry.js";
import { Listing } from "../models/Listing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { activeListingFilter, paginate } from "../lib/queryBuilder.js";
import { recordAdminMutationEvent } from "../utils/securityEvent.js";

const populate = ["listing", "title locality", "user", "name email"];

export const createInquiry = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.body.listingId)) throw ApiError.badRequest("Invalid listing identifier");
  if (!(await Listing.exists({ _id: req.body.listingId, ...activeListingFilter() }))) throw ApiError.notFound("Listing not found");
  const inquiry = await Inquiry.create({ user: req.user.sub, listing: req.body.listingId, message: req.body.message });
  res.status(201).json(inquiry);
});

export const myInquiries = asyncHandler(async (req, res) => {
  const filter = { user: req.user.sub };
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 20, maxLimit: 100 });
  const [items, total] = await Promise.all([
    Inquiry.find(filter).populate(populate[0], populate[1]).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Inquiry.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

export function buildAdminInquiryFilter({ status } = {}) {
  return status ? { status } : {};
}

export const allInquiries = asyncHandler(async (req, res) => {
  const filter = buildAdminInquiryFilter(req.query);
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 20, maxLimit: 100 });
  const [items, total] = await Promise.all([
    Inquiry.find(filter).populate(populate[0], populate[1]).populate(populate[2], populate[3]).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Inquiry.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

export const updateInquiry = asyncHandler(async (req, res) => {
  const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate(populate[0], populate[1]).populate(populate[2], populate[3]);
  if (!inquiry) throw ApiError.notFound("Inquiry not found");
  await recordAdminMutationEvent(req, "admin_inquiry_status_updated", {
    resourceType: "inquiry", resourceId: inquiry._id, action: "update", targetUserId: inquiry.user?._id || inquiry.user,
    metadata: { status: inquiry.status },
  });
  res.json(inquiry);
});

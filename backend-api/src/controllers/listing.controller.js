import { Listing } from "../models/Listing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { buildListingQuery, buildSort, paginate } from "../lib/queryBuilder.js";
import { mlService } from "../services/ml.service.js";
import { computeDealVerdict } from "../lib/deal.js";
import { parse } from "csv-parse/sync";
import { createListingSchema } from "../validators/listing.schema.js";

export function parseListingCsv(csv) {
  let rows;
  try { rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }); }
  catch { throw ApiError.badRequest("Invalid CSV file"); }
  if (!rows.length || rows.length > 1000) throw ApiError.badRequest("CSV must contain 1–1000 listings");
  return rows.map((row, index) => {
    const result = createListingSchema.safeParse({
      title: row.title, city: row.city || "Bengaluru", locality: row.locality,
      propertyType: row.propertyType || "Apartment", areaType: row.areaType || undefined,
      availabilityStatus: row.availabilityStatus || "Ready To Move",
      totalSqft: Number(row.totalSqft), bhk: Number(row.bhk), bath: Number(row.bath),
      balcony: Number(row.balcony || 0), price: Number(row.price),
      description: row.description || undefined,
      images: row.images ? row.images.split(";").map((url) => url.trim()).filter(Boolean) : undefined,
    });
    if (!result.success) throw ApiError.badRequest(`Invalid CSV row ${index + 2}`, result.error.issues);
    return result.data;
  });
}

export const listListings = asyncHandler(async (req, res) => {
  const filter = buildListingQuery(req.query);
  const sort = buildSort(req.query.sort);
  const { page, limit, skip } = paginate(req.query);
  const [items, total] = await Promise.all([
    Listing.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Listing.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

export const getListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id).lean();
  if (!listing) throw ApiError.notFound("Listing not found");
  res.json(listing);
});

export const createListing = asyncHandler(async (req, res) => {
  const pricePerSqft = Math.round(req.body.price / req.body.totalSqft);
  const listing = await Listing.create({ ...req.body, pricePerSqft, createdBy: req.user?.sub });
  res.status(201).json(listing);
});

export const importListings = asyncHandler(async (req, res) => {
  const rows = parseListingCsv(req.body).map((row) => ({
    ...row, pricePerSqft: Math.round(row.price / row.totalSqft), createdBy: req.user.sub,
  }));
  await Listing.insertMany(rows);
  res.status(201).json({ imported: rows.length });
});

export const updateListing = asyncHandler(async (req, res) => {
  const patch = { ...req.body };
  if (patch.price || patch.totalSqft) {
    const current = await Listing.findById(req.params.id).select("price totalSqft").lean();
    if (!current) throw ApiError.notFound("Listing not found");
    patch.pricePerSqft = Math.round((patch.price ?? current.price) / (patch.totalSqft ?? current.totalSqft));
  }
  const listing = await Listing.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
  if (!listing) throw ApiError.notFound("Listing not found");
  res.json(listing);
});

export const deleteListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findByIdAndDelete(req.params.id);
  if (!listing) throw ApiError.notFound("Listing not found");
  res.json({ success: true });
});

export const localityOptions = asyncHandler(async (req, res) => {
  const localities = await Listing.distinct("locality");
  res.json({ localities: localities.sort() });
});

export const listingDeal = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id).lean();
  if (!listing) throw ApiError.notFound("Listing not found");
  const prediction = await mlService.predict({
    location: listing.locality,
    area_type: listing.areaType || "Super built-up Area",
    availability_status: listing.availabilityStatus || "Ready To Move",
    total_sqft: listing.totalSqft, bhk: listing.bhk, bath: listing.bath, balcony: listing.balcony || 0,
  });
  const deal = computeDealVerdict(listing.price, prediction.predicted_price);
  res.json({
    listedPrice: listing.price,
    predictedPrice: prediction.predicted_price,
    confidenceLow: prediction.confidence_low,
    confidenceHigh: prediction.confidence_high,
    deal,
  });
});

import { z } from "zod";

const listingSortSchema = z.enum(["newest", "price_asc", "price_desc", "sqft_desc", "ppsf_asc"]);

export const createListingSchema = z.object({
  title: z.string().min(3),
  city: z.string().default("Bengaluru"),
  locality: z.string().min(1),
  propertyType: z.enum(["Apartment", "Villa", "Plot"]).default("Apartment"),
  areaType: z.string().optional(),
  availabilityStatus: z.enum(["Ready To Move", "Under Construction"]).default("Ready To Move"),
  totalSqft: z.number().positive(),
  bhk: z.number().int().min(0).max(20),
  bath: z.number().int().min(0).max(20),
  balcony: z.number().int().min(0).max(10).default(0),
  price: z.number().positive(),
  images: z.array(z.string().url()).optional(),
  description: z.string().optional(),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export const updateListingSchema = createListingSchema.partial();

export const listingQuerySchema = z.object({
  city: z.string().trim().max(80).optional(),
  locality: z.string().trim().max(80).optional(),
  propertyType: z.enum(["Apartment", "Villa", "Plot"]).optional(),
  areaType: z.string().trim().max(80).optional(),
  bhk: z.coerce.number().int().min(0).max(20).optional(),
  bath: z.coerce.number().int().min(0).max(20).optional(),
  availabilityStatus: z.enum(["Ready To Move", "Under Construction"]).optional(),
  minPrice: z.coerce.number().finite().min(0).max(1_000_000_000_000).optional(),
  maxPrice: z.coerce.number().finite().min(0).max(1_000_000_000_000).optional(),
  minSqft: z.coerce.number().finite().min(0).max(50_000).optional(),
  maxSqft: z.coerce.number().finite().min(0).max(50_000).optional(),
  search: z.string().trim().max(100).optional(),
  sort: listingSortSchema.default("newest"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
}).strict().superRefine((value, ctx) => {
  if (value.minPrice !== undefined && value.maxPrice !== undefined && value.minPrice > value.maxPrice) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["minPrice"], message: "minPrice cannot exceed maxPrice" });
  }
  if (value.minSqft !== undefined && value.maxSqft !== undefined && value.minSqft > value.maxSqft) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["minSqft"], message: "minSqft cannot exceed maxSqft" });
  }
});

export const adminListingQuerySchema = z.object({
  lifecycle: z.enum(["active", "archived", "all"]).default("all"),
  sort: listingSortSchema.default("newest"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
}).strict();

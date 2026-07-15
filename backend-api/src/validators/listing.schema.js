import { z } from "zod";

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
  city: z.string().optional(),
  locality: z.string().optional(),
  propertyType: z.enum(["Apartment", "Villa", "Plot"]).optional(),
  areaType: z.string().optional(),
  bhk: z.coerce.number().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minSqft: z.coerce.number().optional(),
  maxSqft: z.coerce.number().optional(),
  search: z.string().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "sqft_desc", "ppsf_asc"]).default("newest"),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(12),
});

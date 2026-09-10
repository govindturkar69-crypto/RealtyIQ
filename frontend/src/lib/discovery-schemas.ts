import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const finiteNumber = z.number().finite();

export const listingSchema = z.object({
  _id: objectId,
  title: z.string(),
  city: z.string(),
  locality: z.string(),
  propertyType: z.enum(["Apartment", "Villa", "Plot"]),
  areaType: z.string().optional(),
  availabilityStatus: z.string(),
  totalSqft: finiteNumber,
  bhk: finiteNumber,
  bath: finiteNumber,
  balcony: finiteNumber,
  price: finiteNumber,
  pricePerSqft: finiteNumber,
  location: z.object({ lat: finiteNumber, lng: finiteNumber }).nullable().optional(),
  images: z.array(z.string()),
  description: z.string(),
  listedDate: z.string(),
  deletedAt: z.string().nullable().optional(),
}).passthrough();

export const paginatedListingSchema = z.object({
  items: z.array(listingSchema),
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
}).passthrough();

const nullableNumber = finiteNumber.nullable();

export const compareItemSchema = z.object({
  listing: listingSchema,
  listedPrice: finiteNumber,
  predictedPrice: nullableNumber,
  confidenceLow: nullableNumber,
  confidenceHigh: nullableNumber,
  predictionStatus: z.enum(["available", "unavailable"]).optional(),
  deal: z.object({
    verdict: z.enum(["underpriced", "overpriced", "fair", "unknown"]),
    deltaPct: nullableNumber,
  }).passthrough(),
}).passthrough();

export const compareResponseSchema = z.object({
  items: z.array(compareItemSchema).min(2).max(3),
  degraded: z.boolean().optional(),
}).passthrough();

export const dealResultSchema = z.object({
  listedPrice: finiteNumber,
  predictedPrice: finiteNumber,
  confidenceLow: finiteNumber,
  confidenceHigh: finiteNumber,
  deal: z.object({
    verdict: z.enum(["underpriced", "overpriced", "fair", "unknown"]),
    deltaPct: nullableNumber,
  }).passthrough(),
}).passthrough();

export const trendPointSchema = z.object({
  period: z.string(),
  avgPrice: finiteNumber,
  avgPricePerSqft: finiteNumber,
  count: z.number().int().min(0),
}).passthrough();

export const trendsResponseSchema = z.object({
  series: z.array(trendPointSchema),
}).passthrough();

export const rankingResponseSchema = z.object({
  ranking: z.array(z.object({
    locality: z.string(),
    avgPricePerSqft: finiteNumber,
    listings: z.number().int().min(0),
  }).passthrough()),
}).passthrough();

export const localityOptionsSchema = z.object({
  localities: z.array(z.string()),
}).passthrough();

export function parseDiscoveryPayload<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid discovery response");
  return parsed.data;
}

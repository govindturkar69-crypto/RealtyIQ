import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const scalar = z.union([z.string(), z.number().finite(), z.boolean()]);

const savedSearchItemSchema = z.object({
  _id: objectId,
  name: z.string(),
  filters: z.record(scalar),
  matchCount: z.number().int().min(0),
  newMatches: z.number().int().min(0),
  createdAt: z.string(),
  status: z.never().optional(),
}).passthrough();

const quarantinedSavedSearchItemSchema = z.object({
  _id: objectId,
  name: z.string(),
  status: z.literal("quarantined"),
  quarantineReason: z.literal("INVALID_FILTERS"),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).strict();

const savedSearchResponseItemSchema = z.union([savedSearchItemSchema, quarantinedSavedSearchItemSchema]);

export const savedSearchesResponseSchema = z.object({
  items: z.array(savedSearchResponseItemSchema).max(100),
}).passthrough();

export const favoriteIdsResponseSchema = z.object({
  ids: z.array(objectId).max(100),
}).passthrough();

const inquiryListingSchema = z.object({
  _id: objectId,
  title: z.string(),
  locality: z.string(),
}).passthrough();

const inquirySchema = z.object({
  _id: objectId,
  message: z.string(),
  status: z.enum(["new", "contacted", "closed"]),
  createdAt: z.string(),
  listing: inquiryListingSchema.nullable().optional(),
  user: z.object({ _id: objectId, name: z.string(), email: z.string() }).passthrough().optional(),
}).passthrough();

export const inquiryResponseSchema = inquirySchema;

export const inquiriesResponseSchema = z.object({
  items: z.array(inquirySchema).max(100),
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
}).passthrough();

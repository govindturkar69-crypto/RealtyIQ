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

export const adminUserRoleSchema = z.enum(["user", "agent", "broker", "admin"]);

export const adminUserSchema = z.object({
  _id: objectId,
  name: z.string(),
  email: z.string(),
  role: adminUserRoleSchema,
  isActive: z.boolean(),
  createdAt: z.string().optional(),
}).passthrough();

export const adminUsersPaginatedSchema = z.object({
  items: z.array(adminUserSchema),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  total: z.number().int().min(0).optional(),
  totalPages: z.number().int().min(0).optional(),
}).passthrough();

export const adminUsersLegacySchema = z.object({
  users: z.array(adminUserSchema),
}).passthrough();

export const adminUsersResponseSchema = z.union([
  adminUsersPaginatedSchema,
  adminUsersLegacySchema.transform((val) => ({
    items: val.users,
    page: 1,
    limit: val.users.length,
    total: val.users.length,
    totalPages: 1,
  })),
]);

export function safelyParseAdminUsers(payload: unknown): { items: z.infer<typeof adminUserSchema>[] } | null {
  const result = adminUsersResponseSchema.safeParse(payload);
  return result.success ? result.data : null;
}

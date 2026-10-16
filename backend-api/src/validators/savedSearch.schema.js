import { z } from "zod";

export const savedSearchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: z.object({
    search: z.string().trim().max(120).optional(),
    city: z.string().trim().max(80).optional(),
    locality: z.string().trim().max(120).optional(),
    propertyType: z.enum(["Apartment", "Villa", "Plot"]).optional(),
    areaType: z.string().trim().max(80).optional(),
    availabilityStatus: z.enum(["Ready To Move", "Under Construction"]).optional(),
    bhk: z.number().int().min(0).max(20).optional(),
    bath: z.number().int().min(0).max(20).optional(),
    minPrice: z.number().finite().nonnegative().max(1e12).optional(),
    maxPrice: z.number().finite().nonnegative().max(1e12).optional(),
    minSqft: z.number().finite().positive().max(1e7).optional(),
    maxSqft: z.number().finite().positive().max(1e7).optional(),
  }).strict(),
});

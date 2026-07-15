import { z } from "zod";

export const savedSearchSchema = z.object({
  name: z.string().min(1).max(80),
  filters: z.object({
    city: z.string().optional(),
    locality: z.string().optional(),
    propertyType: z.string().optional(),
    bhk: z.number().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
  }).passthrough(),
});

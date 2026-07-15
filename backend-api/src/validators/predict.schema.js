import { z } from "zod";

export const predictSchema = z.object({
  location: z.string().min(1),
  area_type: z.string().default("Super built-up Area"),
  availability_status: z.enum(["Ready To Move", "Under Construction"]).default("Ready To Move"),
  total_sqft: z.number().positive(),
  bhk: z.number().int().min(1).max(20),
  bath: z.number().int().min(1).max(20),
  balcony: z.number().int().min(0).max(10).default(0),
});

export const compareSchema = z.object({
  listingIds: z.array(z.string()).min(2).max(3),
});

import { z } from "zod";

const optionalText = (max) => z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().trim().max(max).optional(),
);

const boundedInt = (min, max, fallback) => z.preprocess(
  (value) => value === "" ? undefined : value,
  z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int().min(min).max(max)).default(fallback),
);

const optionalPropertyType = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.enum(["Apartment", "Villa", "Plot"]).optional(),
);

export const trendsQuerySchema = z.object({
  locality: optionalText(80),
  propertyType: optionalPropertyType,
  city: optionalText(80),
  months: boundedInt(1, 120, 24),
}).strict();

export const rankingQuerySchema = z.object({
  limit: boundedInt(1, 100, 10),
}).strict();

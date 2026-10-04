import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password required"),
});

export const signupSchema = z.object({
  name: z.string().min(2, "Name too short"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Minimum 8 characters"),
});

export const predictSchema = z.object({
  location: z.string().min(1, "Select a locality"),
  area_type: z.string().min(1),
  availability_status: z.enum(["Ready To Move", "Under Construction"]),
  total_sqft: z.coerce.number().min(100, "Min 100 sqft").max(30000),
  bhk: z.coerce.number().int().min(1, "Min 1").max(20),
  bath: z.coerce.number().int().min(1, "Min 1").max(20),
  balcony: z.coerce.number().int().min(0).max(10),
});

const predictionInputResponseSchema = predictSchema.strict();
const predictionIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
const responseNumber = z.number().finite();
const responseTimestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid timestamp");

export const predictionDetailSchema = z.object({
  recordId: predictionIdSchema,
  input: predictionInputResponseSchema,
  predicted_price: responseNumber,
  confidence_low: responseNumber,
  confidence_high: responseNumber,
  confidence_interval_pct: z.literal(95),
  price_per_sqft: responseNumber,
  currency: z.literal("INR"),
  model_name: z.string().min(1),
  locality: z.string().min(1),
  createdAt: responseTimestamp,
}).strict();

export const predictionHistoryItemSchema = z.object({
  _id: predictionIdSchema,
  input: predictionInputResponseSchema,
  predictedPrice: responseNumber,
  confidenceLow: responseNumber,
  confidenceHigh: responseNumber,
  pricePerSqft: responseNumber.optional(),
  locality: z.string().min(1),
  createdAt: responseTimestamp,
}).strict();

export const predictionHistorySchema = z.object({
  items: z.array(predictionHistoryItemSchema),
}).strict();

export const publicPredictionSchema = z.object({
  input: predictionInputResponseSchema,
  predicted_price: responseNumber,
  confidence_low: responseNumber,
  confidence_high: responseNumber,
  price_per_sqft: responseNumber,
  model_name: z.string().min(1),
  locality: z.string().min(1),
  createdAt: responseTimestamp,
}).strict();

export const predictionShareSchema = z.object({
  shareToken: z.string().regex(/^[A-Za-z0-9_-]{40,}$/),
  expiresAt: responseTimestamp,
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type PredictInput = z.infer<typeof predictSchema>;

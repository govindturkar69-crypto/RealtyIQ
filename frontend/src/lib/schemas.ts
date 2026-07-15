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

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type PredictInput = z.infer<typeof predictSchema>;

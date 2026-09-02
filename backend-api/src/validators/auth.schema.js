import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(80),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const manageUserSchema = z.object({
  role: z.enum(["user", "agent", "broker", "admin"]).optional(),
  isActive: z.boolean().optional(),
}).refine((v) => v.role !== undefined || v.isActive !== undefined, "No changes supplied");

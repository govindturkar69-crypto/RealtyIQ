import { z } from "zod";

export const createInquirySchema = z.object({
  listingId: z.string().min(1),
  message: z.string().trim().min(10).max(1000),
});

export const updateInquirySchema = z.object({
  status: z.enum(["new", "contacted", "closed"]),
});

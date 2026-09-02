import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createInquirySchema, updateInquirySchema } from "../validators/inquiry.schema.js";
import { allInquiries, createInquiry, myInquiries, updateInquiry } from "../controllers/inquiry.controller.js";

const router = Router();
router.use(authenticate);
router.get("/", myInquiries);
router.post("/", validate(createInquirySchema), createInquiry);
router.get("/admin", requireRole("admin"), allInquiries);
router.patch("/admin/:id", requireRole("admin"), validate(updateInquirySchema), updateInquiry);
export default router;

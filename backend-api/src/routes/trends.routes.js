import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { rankingQuerySchema, trendsQuerySchema } from "../validators/trends.schema.js";
import { priceTrends, localityRanking, adminStats, mlStatus } from "../controllers/trends.controller.js";

const router = Router();
router.get("/", validate(trendsQuerySchema, "query"), priceTrends);
router.get("/ranking", validate(rankingQuerySchema, "query"), localityRanking);
router.get("/admin/stats", authenticate, requireRole("admin"), adminStats);
router.get("/admin/ml-status", authenticate, requireRole("admin"), mlStatus);
export default router;

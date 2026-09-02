import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { priceTrends, localityRanking, adminStats, mlStatus } from "../controllers/trends.controller.js";

const router = Router();
router.get("/", priceTrends);
router.get("/ranking", localityRanking);
router.get("/admin/stats", authenticate, requireRole("admin"), adminStats);
router.get("/admin/ml-status", authenticate, requireRole("admin"), mlStatus);
export default router;

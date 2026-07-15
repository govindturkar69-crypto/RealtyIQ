import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { priceTrends, localityRanking, adminStats } from "../controllers/trends.controller.js";

const router = Router();
router.get("/", priceTrends);
router.get("/ranking", localityRanking);
router.get("/admin/stats", authenticate, requireRole("admin"), adminStats);
export default router;

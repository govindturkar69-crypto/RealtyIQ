import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate, optionalAuth, requireRole } from "../middleware/auth.js";
import { predictSchema } from "../validators/predict.schema.js";
import { predict, featureImportance, history, options, getPredictionById, sharePrediction, revokeShare } from "../controllers/predict.controller.js";

const router = Router();
router.post("/", optionalAuth, validate(predictSchema), predict);
router.post("/:id/share", authenticate, requireRole("user", "admin"), sharePrediction);
router.delete("/:id/share", authenticate, requireRole("user", "admin"), revokeShare);
router.get("/feature-importance", featureImportance);
router.get("/options", options);
router.get("/history", authenticate, requireRole("user", "admin"), history);
router.get("/:id", getPredictionById);
export default router;

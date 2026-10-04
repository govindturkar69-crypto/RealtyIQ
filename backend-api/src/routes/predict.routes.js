import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate, optionalAuth, requireRole } from "../middleware/auth.js";
import { predictSchema } from "../validators/predict.schema.js";
import { objectIdParamSchema } from "../validators/params.schema.js";
import { ApiError } from "../utils/ApiError.js";
import { predict, featureImportance, history, getPredictionDetail, options, getPredictionById, sharePrediction, revokeShare } from "../controllers/predict.controller.js";

const router = Router();
const validatePredictionId = (req, res, next) => {
  const parsed = objectIdParamSchema.safeParse(req.params);
  if (!parsed.success) return next(ApiError.notFound("Prediction not found"));
  req.params = parsed.data;
  next();
};
const privateNoStore = (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
};

router.post("/", optionalAuth, validate(predictSchema), predict);
router.post("/:id/share", authenticate, requireRole("user", "admin"), sharePrediction);
router.delete("/:id/share", authenticate, requireRole("user", "admin"), revokeShare);
router.get("/feature-importance", featureImportance);
router.get("/options", options);
router.get("/history", authenticate, requireRole("user", "admin"), history);
router.get("/history/:id", privateNoStore, authenticate, requireRole("user", "admin"), validatePredictionId, getPredictionDetail);
router.get("/:id", getPredictionById);
export default router;

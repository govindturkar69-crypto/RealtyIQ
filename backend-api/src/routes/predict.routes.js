import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";
import { predictSchema } from "../validators/predict.schema.js";
import { predict, featureImportance, history, options } from "../controllers/predict.controller.js";

const router = Router();
router.post("/", optionalAuth, validate(predictSchema), predict);
router.get("/feature-importance", featureImportance);
router.get("/options", options);
router.get("/history", authenticate, history);
export default router;

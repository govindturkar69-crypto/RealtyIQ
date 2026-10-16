import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { compareSchema } from "../validators/predict.schema.js";
import { compare } from "../controllers/compare.controller.js";
import { optionalAuth } from "../middleware/auth.js";
import { predictionLimiter } from "../middleware/rateLimiters.js";

const router = Router();
router.post("/", predictionLimiter, optionalAuth, validate(compareSchema), compare);
export default router;

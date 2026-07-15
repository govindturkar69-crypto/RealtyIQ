import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { compareSchema } from "../validators/predict.schema.js";
import { compare } from "../controllers/compare.controller.js";

const router = Router();
router.post("/", validate(compareSchema), compare);
export default router;

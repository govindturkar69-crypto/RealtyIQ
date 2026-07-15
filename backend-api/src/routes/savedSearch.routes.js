import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { savedSearchSchema } from "../validators/savedSearch.schema.js";
import { listSaved, createSaved, deleteSaved, markNotified } from "../controllers/savedSearch.controller.js";

const router = Router();
router.use(authenticate);
router.get("/", listSaved);
router.post("/", validate(savedSearchSchema), createSaved);
router.delete("/:id", deleteSaved);
router.post("/:id/mark-notified", markNotified);
export default router;

import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import { signupSchema, loginSchema, refreshSchema } from "../validators/auth.schema.js";
import { signup, login, refresh, me, logout, deleteAccount } from "../controllers/auth.controller.js";

const router = Router();
router.post("/signup", authLimiter, validate(signupSchema), signup);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh", authLimiter, validate(refreshSchema), refresh);
router.get("/me", authenticate, me);
router.delete("/me", authenticate, deleteAccount);
router.post("/logout", authenticate, logout);
export default router;

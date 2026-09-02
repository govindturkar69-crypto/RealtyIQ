import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { listFavorites, favoriteIds, addFavorite, removeFavorite } from "../controllers/favorites.controller.js";

const router = Router();
router.use(authenticate, requireRole("user", "admin"));
router.get("/", listFavorites);
router.get("/ids", favoriteIds);
router.post("/:id", addFavorite);
router.delete("/:id", removeFavorite);
export default router;

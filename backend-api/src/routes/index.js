import { Router } from "express";
import authRoutes from "./auth.routes.js";
import listingRoutes from "./listing.routes.js";
import predictRoutes from "./predict.routes.js";
import compareRoutes from "./compare.routes.js";
import savedSearchRoutes from "./savedSearch.routes.js";
import trendRoutes from "./trends.routes.js";

const router = Router();
router.use("/auth", authRoutes);
router.use("/listings", listingRoutes);
router.use("/predict", predictRoutes);
router.use("/compare", compareRoutes);
router.use("/saved-searches", savedSearchRoutes);
router.use("/trends", trendRoutes);
export default router;

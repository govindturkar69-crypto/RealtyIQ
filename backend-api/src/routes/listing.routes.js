import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { createListingSchema, updateListingSchema, listingQuerySchema } from "../validators/listing.schema.js";
import { listListings, getListing, createListing, updateListing, deleteListing, localityOptions, listingDeal } from "../controllers/listing.controller.js";

const router = Router();
router.get("/", validate(listingQuerySchema, "query"), listListings);
router.get("/meta/localities", localityOptions);
router.get("/:id", getListing);
router.get("/:id/deal", listingDeal);
router.post("/", authenticate, requireRole("admin"), validate(createListingSchema), createListing);
router.patch("/:id", authenticate, requireRole("admin"), validate(updateListingSchema), updateListing);
router.delete("/:id", authenticate, requireRole("admin"), deleteListing);
export default router;

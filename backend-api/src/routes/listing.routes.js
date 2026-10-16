import { Router, text } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { adminListingQuerySchema, createListingSchema, updateListingSchema, listingQuerySchema } from "../validators/listing.schema.js";
import { objectIdParamSchema } from "../validators/params.schema.js";
import { listAdminListings, listListings, getListing, createListing, importListings, updateListing, deleteListing, localityOptions, listingDeal, restoreListing } from "../controllers/listing.controller.js";

const router = Router();
router.get("/", validate(listingQuerySchema, "query"), listListings);
router.get("/meta/localities", localityOptions);
router.get("/admin", authenticate, requireRole("admin"), validate(adminListingQuerySchema, "query"), listAdminListings);
router.post("/import", authenticate, requireRole("admin"), text({ type: "text/csv", limit: "5mb" }), importListings);
router.get("/:id", validate(objectIdParamSchema, "params"), getListing);
router.get("/:id/deal", validate(objectIdParamSchema, "params"), listingDeal);
router.post("/", authenticate, requireRole("admin"), validate(createListingSchema), createListing);
router.patch("/:id/restore", authenticate, requireRole("admin"), validate(objectIdParamSchema, "params"), restoreListing);
router.patch("/:id", authenticate, requireRole("admin"), validate(objectIdParamSchema, "params"), validate(updateListingSchema), updateListing);
router.delete("/:id", authenticate, requireRole("admin"), validate(objectIdParamSchema, "params"), deleteListing);
export default router;

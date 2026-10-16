import test from "node:test";
import assert from "node:assert/strict";
import { Listing } from "../models/Listing.js";
import { activeListingFilter, archivedListingFilter, buildActiveListingQuery } from "../lib/queryBuilder.js";
import { adminListingQuerySchema } from "../validators/listing.schema.js";

test("Listing lifecycle uses a nullable Date field without a migration", () => {
  const path = Listing.schema.path("deletedAt");
  assert.equal(path.instance, "Date");
  assert.equal(path.defaultValue, null);
  assert.deepEqual(activeListingFilter(), { deletedAt: null });
  assert.deepEqual(archivedListingFilter(), { deletedAt: { $type: "date" } });
});

test("active listing queries preserve supported filters and exclude archived records", () => {
  const query = buildActiveListingQuery({ locality: "Whitefield", minPrice: "100" });
  assert.equal(query.locality.source, "^Whitefield$");
  assert.deepEqual(query.price, { $gte: 100 });
  assert.deepEqual(query.deletedAt, null);
});

test("admin lifecycle query is bounded and allowlisted", () => {
  const parsed = adminListingQuerySchema.safeParse({ lifecycle: "archived", page: "2", limit: "100", sort: "newest" });
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data, { lifecycle: "archived", page: 2, limit: 100, sort: "newest" });
  assert.equal(adminListingQuerySchema.safeParse({ lifecycle: "all", unknown: "x" }).success, false);
  assert.equal(adminListingQuerySchema.safeParse({ lifecycle: "deleted" }).success, false);
  assert.equal(adminListingQuerySchema.safeParse({ limit: 101 }).success, false);
});

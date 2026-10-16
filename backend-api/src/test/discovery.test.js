import test from "node:test";
import assert from "node:assert/strict";
import { listingQuerySchema } from "../validators/listing.schema.js";
import { compareSchema } from "../validators/predict.schema.js";

const ids = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"];

test("listing queries accept supported bounded filters and normalize values", () => {
  const result = listingQuerySchema.safeParse({ search: "  Whitefield ", minPrice: "100", maxPrice: "500", limit: "100" });
  assert.equal(result.success, true);
  assert.equal(result.data.search, "Whitefield");
  assert.equal(result.data.limit, 100);
});

test("listing queries reject unknown fields and inverted ranges", () => {
  assert.equal(listingQuerySchema.safeParse({ unknown: "injected" }).success, false);
  assert.equal(listingQuerySchema.safeParse({ minSqft: 2000, maxSqft: 1000 }).success, false);
  assert.equal(listingQuerySchema.safeParse({ minPrice: 500, maxPrice: 100 }).success, false);
  assert.equal(listingQuerySchema.safeParse({ limit: 101 }).success, false);
});

test("compare payloads reject malformed and duplicate listing IDs", () => {
  assert.equal(compareSchema.safeParse({ listingIds: ids.slice(0, 2) }).success, true);
  assert.equal(compareSchema.safeParse({ listingIds: [ids[0], ids[0]] }).success, false);
  assert.equal(compareSchema.safeParse({ listingIds: ["not-an-object-id", ids[1]] }).success, false);
  assert.equal(compareSchema.safeParse({ listingIds: ids }).success, true);
  assert.equal(compareSchema.safeParse({ listingIds: [...ids, "507f1f77bcf86cd799439014"] }).success, false);
});

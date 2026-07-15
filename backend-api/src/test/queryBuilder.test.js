import { test } from "node:test";
import assert from "node:assert/strict";
import { buildListingQuery, buildSort, paginate, escapeRegex } from "../lib/queryBuilder.js";

test("price + sqft ranges", () => {
  const q = buildListingQuery({ minPrice: "1000000", maxPrice: "5000000", minSqft: "800" });
  assert.deepEqual(q.price, { $gte: 1000000, $lte: 5000000 });
  assert.deepEqual(q.totalSqft, { $gte: 800 });
});

test("bhk coerced to number, propertyType passthrough", () => {
  const q = buildListingQuery({ bhk: "3", propertyType: "Villa" });
  assert.equal(q.bhk, 3);
  assert.equal(q.propertyType, "Villa");
});

test("search builds case-insensitive $or", () => {
  const q = buildListingQuery({ search: "white" });
  assert.equal(q.$or.length, 2);
  assert.ok(q.$or[0].title instanceof RegExp);
});

test("empty query -> empty filter", () => {
  assert.deepEqual(buildListingQuery({}), {});
});

test("sort keys map correctly", () => {
  assert.deepEqual(buildSort("price_asc"), { price: 1 });
  assert.deepEqual(buildSort("price_desc"), { price: -1 });
  assert.deepEqual(buildSort("weird"), { listedDate: -1 });
});

test("paginate clamps limit and computes skip", () => {
  assert.deepEqual(paginate({ page: 3, limit: 20 }), { page: 3, limit: 20, skip: 40 });
  assert.equal(paginate({ limit: 9999 }).limit, 100);
  assert.equal(paginate({ page: -5 }).page, 1);
});

test("escapeRegex neutralizes special chars", () => {
  assert.equal(escapeRegex("a.b*c"), "a\\.b\\*c");
});

test("bath filter uses $gte", () => {
  const q = buildListingQuery({ bath: "2" });
  assert.deepEqual(q.bath, { $gte: 2 });
});

test("availabilityStatus passthrough", () => {
  const q = buildListingQuery({ availabilityStatus: "Ready To Move" });
  assert.equal(q.availabilityStatus, "Ready To Move");
});

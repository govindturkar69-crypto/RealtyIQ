import test from "node:test";
import assert from "node:assert/strict";
import { favoriteIdsResponseSchema, inquiriesResponseSchema, savedSearchesResponseSchema } from "../src/lib/account-schemas.ts";
import { parseDiscoveryPayload } from "../src/lib/discovery-schemas.ts";

const id = "507f1f77bcf86cd799439011";

test("account response schemas accept valid bounded payloads", () => {
  assert.deepEqual(parseDiscoveryPayload(favoriteIdsResponseSchema, { ids: [id] }).ids, [id]);
  assert.equal(parseDiscoveryPayload(savedSearchesResponseSchema, { items: [{ _id: id, name: "Homes", filters: {}, matchCount: 1, newMatches: 0, createdAt: new Date().toISOString() }] }).items.length, 1);
  assert.equal(parseDiscoveryPayload(savedSearchesResponseSchema, { items: [{ _id: id, name: "Broken legacy search", status: "quarantined", quarantineReason: "INVALID_FILTERS" }] }).items[0].status, "quarantined");
  assert.equal(parseDiscoveryPayload(inquiriesResponseSchema, { items: [], page: 1, limit: 20, total: 0, totalPages: 0 }).total, 0);
});

test("saved-search responses allow valid and quarantined records together", () => {
  const payload = { items: [
    { _id: id, name: "Homes", filters: { locality: "JP Nagar" }, matchCount: 3, newMatches: 1, createdAt: new Date().toISOString() },
    { _id: "507f1f77bcf86cd799439012", name: "Broken legacy search", status: "quarantined", quarantineReason: "INVALID_FILTERS" },
  ] };
  const parsed = parseDiscoveryPayload(savedSearchesResponseSchema, payload);
  assert.equal(parsed.items.length, 2);
  assert.equal("filters" in parsed.items[1], false);
  assert.equal(parsed.items.filter((item) => "filters" in item && item.newMatches > 0).length, 1);
});

test("malformed account responses are rejected without unsafe casts", () => {
  assert.throws(() => parseDiscoveryPayload(favoriteIdsResponseSchema, { ids: ["not-an-id"] }));
  const malformedSavedSearch = (filters) => ({ items: [{ _id: id, name: "broken", filters, matchCount: 0, newMatches: 0, createdAt: new Date().toISOString() }] });
  for (const filters of [null, ["locality"], "locality", 42, { locality: { $ne: "" } }]) {
    assert.throws(() => parseDiscoveryPayload(savedSearchesResponseSchema, malformedSavedSearch(filters)));
  }
  assert.throws(() => parseDiscoveryPayload(savedSearchesResponseSchema, { items: [{ _id: id, name: "missing", matchCount: 0, newMatches: 0, createdAt: new Date().toISOString() }] }));
  assert.throws(() => parseDiscoveryPayload(inquiriesResponseSchema, { items: [{ _id: id, status: "unknown" }] }));
});

test("malformed saved-search responses enter controlled handling", () => {
  const safelyParseSavedSearches = (value) => {
    try { return parseDiscoveryPayload(savedSearchesResponseSchema, value); }
    catch { return null; }
  };
  assert.equal(safelyParseSavedSearches({ items: [{ _id: id, name: "broken", filters: null, matchCount: 0, newMatches: 0, createdAt: new Date().toISOString() }] }), null);
});

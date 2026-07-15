import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDealVerdict } from "../lib/deal.js";

test("underpriced when listed well below predicted", () => {
  const r = computeDealVerdict(8000000, 10000000);
  assert.equal(r.verdict, "underpriced");
  assert.equal(r.deltaPct, -20);
});

test("overpriced when listed well above predicted", () => {
  assert.equal(computeDealVerdict(11000000, 10000000).verdict, "overpriced");
});

test("fair within tolerance", () => {
  assert.equal(computeDealVerdict(10300000, 10000000).verdict, "fair");
});

test("unknown when inputs missing", () => {
  assert.equal(computeDealVerdict(0, 10000000).verdict, "unknown");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrendPipeline, buildLocalityRankingPipeline } from "../lib/trends.js";
import { rankingQuerySchema, trendsQuerySchema } from "../validators/trends.schema.js";

test("trend pipeline filters, groups by month, sorts", () => {
  const p = buildTrendPipeline({ locality: "Whitefield", months: 12 });
  assert.equal(p[0].$match.locality, "Whitefield");
  assert.ok(p[0].$match.listedDate.$gte instanceof Date);
  assert.ok(p.some((s) => s.$group));
  const proj = p.find((s) => s.$project);
  assert.ok(proj.$project.period);
});

test("ranking pipeline limits and requires min listings", () => {
  const p = buildLocalityRankingPipeline({ limit: 5 });
  assert.ok(p.some((s) => s.$limit === 5));
  const match = p.find((s) => s.$match);
  assert.deepEqual(match.$match.listings, { $gte: 3 });
});

test("trends query schemas allow only bounded supported values", () => {
  const result = trendsQuerySchema.safeParse({ locality: " Whitefield ", propertyType: "Apartment", months: "24" });
  assert.equal(result.success, true);
  assert.equal(result.data.locality, "Whitefield");
  assert.equal(result.data.months, 24);
  assert.equal(trendsQuerySchema.safeParse({ months: "0" }).success, false);
  assert.equal(trendsQuerySchema.safeParse({ months: "121" }).success, false);
  assert.equal(trendsQuerySchema.safeParse({ propertyType: "Penthouse" }).success, false);
  assert.equal(trendsQuerySchema.safeParse({ unknown: "injected" }).success, false);
  assert.equal(trendsQuerySchema.safeParse({ months: ["24", "12"] }).success, false);
});

test("ranking query schema bounds and rejects unknown values", () => {
  assert.equal(rankingQuerySchema.safeParse({}).data.limit, 10);
  assert.equal(rankingQuerySchema.safeParse({ limit: "100" }).data.limit, 100);
  assert.equal(rankingQuerySchema.safeParse({ limit: "101" }).success, false);
  assert.equal(rankingQuerySchema.safeParse({ sort: "avgPricePerSqft" }).success, false);
});
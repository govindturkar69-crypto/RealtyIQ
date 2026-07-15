import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrendPipeline, buildLocalityRankingPipeline } from "../lib/trends.js";

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

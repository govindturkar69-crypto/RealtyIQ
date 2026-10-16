import test from "node:test";
import assert from "node:assert/strict";
import { savedSearchSchema } from "../validators/savedSearch.schema.js";

test("saved search accepts supported listing filters", () => {
  const result = savedSearchSchema.safeParse({
    name: "Whitefield homes",
    filters: {
      search: "villa",
      locality: "Whitefield",
      propertyType: "Villa",
      availabilityStatus: "Ready To Move",
      bhk: 3,
      bath: 2,
      minSqft: 1000,
      maxPrice: 15000000,
    },
  });
  assert.equal(result.success, true);
});

test("saved search rejects unsupported or unbounded filter fields", () => {
  const result = savedSearchSchema.safeParse({
    name: "Invalid search",
    filters: { $where: "malicious", limit: 999999999 },
  });
  assert.equal(result.success, false);
});

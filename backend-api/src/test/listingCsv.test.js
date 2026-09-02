import test from "node:test";
import assert from "node:assert/strict";
import { parseListingCsv } from "../controllers/listing.controller.js";

test("listing CSV coerces numbers and applies defaults", () => {
  const [row] = parseListingCsv("title,locality,totalSqft,bhk,bath,price\nTest home,Whitefield,1200,2,2,9000000");
  assert.equal(row.city, "Bengaluru");
  assert.equal(row.totalSqft, 1200);
  assert.equal(row.propertyType, "Apartment");
});

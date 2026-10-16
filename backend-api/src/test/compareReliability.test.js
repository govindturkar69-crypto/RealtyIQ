import test from "node:test";
import assert from "node:assert/strict";
import { Listing } from "../models/Listing.js";
import { Prediction } from "../models/Prediction.js";
import { mlService } from "../services/ml.service.js";
import { compare } from "../controllers/compare.controller.js";

const ids = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"];
const listings = ids.map((id, index) => ({
  _id: id, locality: `Locality ${index + 1}`, areaType: "Super built-up Area",
  availabilityStatus: "Ready To Move", totalSqft: 1000, bhk: 2, bath: 2, balcony: 1,
  price: 10_000_000 + index * 500_000, pricePerSqft: 8000, propertyType: "Apartment",
}));

async function runCompare(listingIds = ids.slice(0, 2)) {
  let body;
  await compare(
    { body: { listingIds }, id: "compare-test" },
    { json(value) { body = value; } },
    (error) => { throw error; },
  );
  return body;
}

test("successful authenticated compare keeps prediction history persistence", async () => {
  const originalFind = Listing.find;
  const originalPredict = mlService.predict;
  const originalCreate = Prediction.create;
  let created = null;
  Listing.find = () => ({ lean: async () => listings.slice(0, 2) });
  mlService.predict = async () => ({ predicted_price: 10_000_000, confidence_low: 9_000_000, confidence_high: 11_000_000, price_per_sqft: 8000, confidence_interval_pct: 95, currency: "INR", model_name: "test" });
  Prediction.create = async (payload) => { created = payload; };
  let body;
  try {
    await compare({ body: { listingIds: ids.slice(0, 2) }, id: "compare-auth", user: { sub: ids[0] } }, { json(value) { body = value; } }, (error) => { throw error; });
    assert.equal(body.degraded, false);
    assert.equal(String(created.user), ids[0]);
    assert.equal(created.predictedPrice, 10_000_000);
  } finally { Listing.find = originalFind; mlService.predict = originalPredict; Prediction.create = originalCreate; }
});

test("compare marks all successful estimates as available", async () => {
  const originalFind = Listing.find;
  const originalPredict = mlService.predict;
  Listing.find = () => ({ lean: async () => listings.slice(0, 2) });
  mlService.predict = async () => ({
    predicted_price: 10_000_000, confidence_low: 9_000_000, confidence_high: 11_000_000,
    price_per_sqft: 8000, confidence_interval_pct: 95, currency: "INR", model_name: "test",
  });
  try {
    const response = await runCompare();
    assert.equal(response.degraded, false);
    assert.deepEqual(response.items.map((item) => item.predictionStatus), ["available", "available"]);
  } finally { Listing.find = originalFind; mlService.predict = originalPredict; }
});

test("compare preserves successful items when one ML estimate fails", async () => {
  const originalFind = Listing.find;
  const originalPredict = mlService.predict;
  let calls = 0;
  Listing.find = () => ({ lean: async () => listings.slice(0, 2) });
  mlService.predict = async () => {
    calls += 1;
    if (calls === 2) throw new Error("private ML stack and token");
    return { predicted_price: 10_000_000, confidence_low: 9_000_000, confidence_high: 11_000_000, price_per_sqft: 8000, confidence_interval_pct: 95, currency: "INR", model_name: "test" };
  };
  try {
    const response = await runCompare();
    assert.equal(response.degraded, true);
    assert.deepEqual(response.items.map((item) => item.predictionStatus), ["available", "unavailable"]);
    assert.equal(response.items[0].predictedPrice, 10_000_000);
    assert.equal(response.items[1].predictedPrice, null);
    assert.doesNotMatch(JSON.stringify(response), /private|token|stack/i);
  } finally { Listing.find = originalFind; mlService.predict = originalPredict; }
});

test("compare marks multiple ML failures without failing the whole response", async () => {
  const originalFind = Listing.find;
  const originalPredict = mlService.predict;
  Listing.find = () => ({ lean: async () => listings });
  mlService.predict = async () => { throw new Error("upstream failure"); };
  try {
    const response = await runCompare(ids);
    assert.equal(response.degraded, true);
    assert.deepEqual(response.items.map((item) => item.predictionStatus), ["unavailable", "unavailable", "unavailable"]);
    assert.equal(response.items.every((item) => item.deal.verdict === "unknown"), true);
  } finally { Listing.find = originalFind; mlService.predict = originalPredict; }
});

test("compare rejects requests containing missing or archived listings", async () => {
  const originalFind = Listing.find;
  let queryFilter = null;
  Listing.find = (filter) => {
    queryFilter = filter;
    return { lean: async () => listings.slice(0, 1) };
  };
  try {
    await assert.rejects(
      () => runCompare(ids.slice(0, 2)),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, "One or more listings not found");
        return true;
      }
    );
    assert.deepEqual(queryFilter.deletedAt, null);
  } finally {
    Listing.find = originalFind;
  }
});

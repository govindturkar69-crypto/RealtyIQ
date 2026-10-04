import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";
import { User } from "../models/User.js";
import { Prediction } from "../models/Prediction.js";
import { mlService } from "../services/ml.service.js";
import { getPredictionById, predict } from "../controllers/predict.controller.js";
import { signAccessToken } from "../utils/jwt.js";
import { createShareToken, hashToken } from "../utils/tokenHash.js";

const ids = {
  owner: "507f1f77bcf86cd799439011",
  other: "507f1f77bcf86cd799439012",
  admin: "507f1f77bcf86cd799439013",
  prediction: "507f1f77bcf86cd799439021",
  otherPrediction: "507f1f77bcf86cd799439022",
  adminPrediction: "507f1f77bcf86cd799439024",
  expired: "507f1f77bcf86cd799439023",
};
const input = {
  location: "Whitefield", area_type: "Super built-up Area", availability_status: "Ready To Move",
  total_sqft: 1250, bhk: 2, bath: 2, balcony: 1, internalNote: "must not be returned",
};
const predictions = new Map([
  [ids.prediction, { _id: ids.prediction, user: ids.owner, input, predictedPrice: 12_500_000, confidenceLow: 11_000_000, confidenceHigh: 14_000_000, pricePerSqft: 10_000, modelName: "fixture-model", locality: "Whitefield", createdAt: new Date("2026-01-15T10:00:00.000Z"), shareToken: "raw-share-token", shareTokenHash: "private-hash", mlInternals: { private: true } }],
  [ids.otherPrediction, { _id: ids.otherPrediction, user: ids.other, input, predictedPrice: 9_000_000, confidenceLow: 8_000_000, confidenceHigh: 10_000_000, pricePerSqft: 9_000, modelName: "fixture-model", locality: "Indiranagar", createdAt: new Date("2026-01-16T10:00:00.000Z"), shareTokenHash: "private-hash" }],
  [ids.adminPrediction, { _id: ids.adminPrediction, user: ids.admin, input, predictedPrice: 10_000_000, confidenceLow: 9_000_000, confidenceHigh: 11_000_000, pricePerSqft: 8_000, modelName: "fixture-model", locality: "Whitefield", createdAt: new Date("2026-01-17T10:00:00.000Z") }],
  [ids.expired, { _id: ids.expired, user: ids.owner, input, predictedPrice: 1, confidenceLow: 1, confidenceHigh: 1, expiresAt: new Date("2020-01-01T00:00:00.000Z") }],
]);

function query(value) {
  return {
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    async lean() { return value; },
  };
}

function authHeader(id, role) {
  return { Authorization: `Bearer ${signAccessToken({ sub: id, role, ver: 0 })}` };
}

test("authenticated prediction detail is owner-scoped, private, and whitelisted", async () => {
  const originals = { userFindOne: User.findOne, predictionFindOne: Prediction.findOne, predictionFind: Prediction.find };
  const accounts = new Map([
    [ids.owner, { role: "user", tokenVersion: 0 }],
    [ids.other, { role: "user", tokenVersion: 0 }],
    [ids.admin, { role: "admin", tokenVersion: 0 }],
  ]);
  const seenFilters = [];
  User.findOne = (filter) => query(accounts.get(String(filter._id)) || null);
  Prediction.findOne = (filter) => {
    seenFilters.push(filter);
    const record = predictions.get(String(filter._id));
    if (!record || (filter.user && String(filter.user) !== String(record.user)) || (record.expiresAt && record.expiresAt <= new Date())) return query(null);
    return query(record);
  };
  Prediction.find = (filter) => {
    seenFilters.push(filter);
    return query([predictions.get(ids.prediction)]);
  };

  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const unauthenticated = await fetch(`${base}/api/predict/history/${ids.prediction}`);
    assert.equal(unauthenticated.status, 401);

    const owner = await fetch(`${base}/api/predict/history/${ids.prediction}`, { headers: authHeader(ids.owner, "user") });
    assert.equal(owner.status, 200);
    assert.equal(owner.headers.get("cache-control"), "private, no-store");
    const dto = await owner.json();
    assert.deepEqual(Object.keys(dto).sort(), ["recordId", "input", "predicted_price", "confidence_low", "confidence_high", "confidence_interval_pct", "price_per_sqft", "currency", "model_name", "locality", "createdAt"].sort());
    assert.equal(dto.recordId, ids.prediction);
    assert.deepEqual(Object.keys(dto.input).sort(), ["location", "area_type", "availability_status", "total_sqft", "bhk", "bath", "balcony"].sort());
    assert.equal(dto.confidence_interval_pct, 95);
    assert.equal(dto.currency, "INR");
    assert.doesNotMatch(JSON.stringify(dto), /shareToken|private-hash|mlInternals|internalNote/i);
    assert.equal(String(seenFilters.at(-1).user), ids.owner);

    const nonOwner = await fetch(`${base}/api/predict/history/${ids.otherPrediction}`, { headers: authHeader(ids.owner, "user") });
    assert.equal(nonOwner.status, 404);
    assert.equal((await nonOwner.json()).error, "Prediction not found");

    const malformed = await fetch(`${base}/api/predict/history/not-an-object-id`, { headers: authHeader(ids.owner, "user") });
    assert.equal(malformed.status, 404);
    assert.equal(seenFilters.length, 2);

    const missing = await fetch(`${base}/api/predict/history/507f1f77bcf86cd799439099`, { headers: authHeader(ids.owner, "user") });
    assert.equal(missing.status, 404);
    const expired = await fetch(`${base}/api/predict/history/${ids.expired}`, { headers: authHeader(ids.owner, "user") });
    assert.equal(expired.status, 404);
    assert.equal("user" in seenFilters.at(-1), true);
    assert.equal(Array.isArray(seenFilters.at(-1).$or), true);

    const admin = await fetch(`${base}/api/predict/history/${ids.adminPrediction}`, { headers: authHeader(ids.admin, "admin") });
    assert.equal(admin.status, 200);
    assert.equal(String(seenFilters.at(-1).user), ids.admin);
    const adminNonOwner = await fetch(`${base}/api/predict/history/${ids.prediction}`, { headers: authHeader(ids.admin, "admin") });
    assert.equal(adminNonOwner.status, 404);

    const history = await fetch(`${base}/api/predict/history`, { headers: authHeader(ids.owner, "user") });
    assert.equal(history.status, 200);
    const historyBody = await history.json();
    assert.equal(historyBody.items[0]._id, ids.prediction);
    assert.doesNotMatch(JSON.stringify(historyBody), /shareToken|private-hash|mlInternals|internalNote/i);
    assert.equal(String(seenFilters.at(-1).user), ids.owner);
  } finally {
    User.findOne = originals.userFindOne;
    Prediction.findOne = originals.predictionFindOne;
    Prediction.find = originals.predictionFind;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("prediction creation keeps the share token and adds a separate recordId only for panel roles", async () => {
  const originalPredict = mlService.predict;
  const originalCreate = Prediction.create;
  mlService.predict = async () => ({ predicted_price: 12_500_000, confidence_low: 11_000_000, confidence_high: 14_000_000, confidence_interval_pct: 95, price_per_sqft: 10_000, currency: "INR", model_name: "fixture-model" });
  Prediction.create = async () => ({ _id: ids.prediction });
  const invoke = async (user) => {
    let body;
    await predict({ body: { ...input }, user, id: "prediction-test" }, { json(value) { body = value; } }, (error) => { throw error; });
    return body;
  };
  try {
    const authenticated = await invoke({ sub: ids.owner, role: "user" });
    assert.equal(authenticated.recordId, ids.prediction);
    assert.match(authenticated.predictionId, /^[A-Za-z0-9_-]{40,}$/);
    assert.notEqual(authenticated.recordId, authenticated.predictionId);

    const anonymous = await invoke(null);
    assert.equal("recordId" in anonymous, false);
    assert.match(anonymous.predictionId, /^[A-Za-z0-9_-]{40,}$/);
  } finally {
    mlService.predict = originalPredict;
    Prediction.create = originalCreate;
  }
});

test("public share retrieval remains compatible and returns only the public valuation contract", async () => {
  const originalFindOne = Prediction.findOne;
  const share = createShareToken(60_000);
  const record = predictions.get(ids.prediction);
  let filter;
  Prediction.findOne = (queryFilter) => {
    filter = queryFilter;
    return query(record);
  };
  try {
    let body;
    await getPredictionById({ params: { id: share.token } }, { json(value) { body = value; } }, (error) => { throw error; });
    assert.equal(filter.shareTokenHash, hashToken(share.token));
    assert.equal(body.predicted_price, record.predictedPrice);
    assert.deepEqual(Object.keys(body).sort(), ["input", "predicted_price", "confidence_low", "confidence_high", "price_per_sqft", "model_name", "locality", "createdAt"].sort());
    assert.doesNotMatch(JSON.stringify(body), /shareToken|private-hash|mlInternals|internalNote/i);
  } finally {
    Prediction.findOne = originalFindOne;
  }
});

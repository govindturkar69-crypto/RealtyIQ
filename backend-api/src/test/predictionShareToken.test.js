import test from "node:test";
import assert from "node:assert/strict";
import { findPublicPrediction } from "../controllers/predict.controller.js";

const legacyId = "507f1f77bcf86cd799439011";

function fakePredictionModel(record) {
  return {
    findById() {
      return {
        select() {
          return {
            lean: async () => record,
          };
        },
      };
    },
  };
}

test("legacy ObjectId shares work during grace and stop after revocation", async () => {
  const now = new Date();
  const record = { _id: legacyId, createdAt: new Date(now.getTime() - 60_000) };
  const model = fakePredictionModel(record);

  assert.ok(await findPublicPrediction(legacyId, now, model));

  record.shareRevokedAt = now;
  assert.equal(await findPublicPrediction(legacyId, now, model), null);
});

test("legacy ObjectId shares reject records past retention expiry", async () => {
  const now = new Date();
  const record = {
    _id: legacyId,
    createdAt: new Date(now.getTime() - 60_000),
    expiresAt: new Date(now.getTime() - 1),
  };

  assert.equal(await findPublicPrediction(legacyId, now, fakePredictionModel(record)), null);
});

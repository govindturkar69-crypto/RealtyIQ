import test from "node:test";
import assert from "node:assert/strict";
import { boundedFavoriteIds, buildFavoriteAdmissionFilter } from "../controllers/favorites.controller.js";

const ids = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"];

test("favorite responses are bounded to the configured cap", () => {
  assert.deepEqual(boundedFavoriteIds(ids, 2), ids.slice(0, 2));
});

test("favorite admission is atomic and idempotent at the cap", () => {
  const filter = buildFavoriteAdmissionFilter("507f1f77bcf86cd799439010", ids[0], 100);
  assert.deepEqual(filter._id, "507f1f77bcf86cd799439010");
  assert.deepEqual(filter.$or[0], { favorites: ids[0] });
  assert.equal(filter.$or[1].$expr.$lt[1], 100);
  assert.deepEqual(filter.$or[1].$expr.$lt[0].$size.$ifNull, ["$favorites", []]);
});

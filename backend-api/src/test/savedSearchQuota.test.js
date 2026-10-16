import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

test("saved-search quota uses a dedicated version anchor", () => {
  assert.equal(User.schema.path("savedSearchMutationVersion").defaultValue, 0);
  assert.ok(env.savedSearchLimit > 0);
});

test("saved-search quota remains bounded by configuration", () => {
  assert.equal(Number.isInteger(env.savedSearchLimit), true);
  assert.equal(env.savedSearchLimit > 0, true);
});

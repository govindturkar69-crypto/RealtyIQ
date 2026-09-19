import test from "node:test";
import assert from "node:assert/strict";
import { markNotified } from "../controllers/savedSearch.controller.js";
import { SavedSearch } from "../models/SavedSearch.js";
import { Listing } from "../models/Listing.js";
import { logger } from "../utils/logger.js";

const userId = "507f1f77bcf86cd799439011";
const searchId = "507f1f77bcf86cd799439012";
const validFilters = { locality: "JP Nagar" };

function response() {
  const result = { statusCode: 200, body: undefined };
  return {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; },
    result,
  };
}

async function invoke(req) {
  const res = response();
  let error;
  await markNotified(req, res, (nextError) => { error = nextError; });
  return { res: res.result, error };
}

async function captureTelemetry(run) {
  const originalInfo = logger.info;
  const events = [];
  logger.info = (event, fields) => { events.push({ event, fields }); };
  try {
    return await run(events);
  } finally {
    logger.info = originalInfo;
  }
}

function stubSaved(savedOrError) {
  const originalFindOne = SavedSearch.findOne;
  SavedSearch.findOne = async () => {
    if (savedOrError instanceof Error) throw savedOrError;
    return savedOrError;
  };
  return () => { SavedSearch.findOne = originalFindOne; };
}

test("successful acknowledgement emits bounded privacy-safe telemetry without changing persistence", async () => {
  const saved = {
    _id: searchId,
    user: userId,
    filters: validFilters,
    lastNotifiedCount: 3,
    saveCalls: 0,
    async save() { this.saveCalls += 1; return this; },
  };
  const restoreFindOne = stubSaved(saved);
  const originalCount = Listing.countDocuments;
  let countQuery;
  Listing.countDocuments = async (query) => { countQuery = query; return 7; };
  try {
    await captureTelemetry(async (events) => {
      const { res, error } = await invoke({
        id: "bad request\n" + "x".repeat(200),
        user: { sub: userId },
        params: { id: searchId },
      });
      assert.equal(error, undefined);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, saved);
      assert.equal(saved.lastNotifiedCount, 7);
      assert.equal(saved.saveCalls, 1);
      assert.equal(countQuery.locality instanceof RegExp, true);
      assert.equal(events.length, 1);
      assert.equal(events[0].event, "saved_search_acknowledgement");
      assert.equal(events[0].fields.outcome, "success");
      assert.equal(events[0].fields.previousAnchor, 3);
      assert.equal(events[0].fields.computedCount, 7);
      assert.equal(events[0].fields.countDirection, "increased");
      assert.equal(events[0].fields.replayOrConflict, "unknown");
      assert.equal(events[0].fields.requestId, "invalid");
      assert.equal(events[0].fields.requestId.length <= 128, true);
      assert.equal(Number.isInteger(events[0].fields.durationMs), true);
      assert.equal(events[0].fields.durationMs >= 0, true);
      assert.equal(events[0].fields.durationMs <= 60_000, true);
      assert.match(events[0].fields.savedSearchFingerprint, /^[a-f0-9]{12}$/);
      const serialized = JSON.stringify(events[0].fields);
      for (const secret of [searchId, userId, "JP Nagar", "password", "token", "cookie", "filter"]) {
        assert.equal(serialized.toLowerCase().includes(secret.toLowerCase()), false);
      }
    });
  } finally {
    restoreFindOne();
    Listing.countDocuments = originalCount;
  }
});

test("not found and quarantined acknowledgements emit safe classifications without writes", async () => {
  const originalCount = Listing.countDocuments;
  let countCalled = false;
  Listing.countDocuments = async () => { countCalled = true; return 99; };
  try {
    await captureTelemetry(async (events) => {
      const restoreMissing = stubSaved(null);
      try {
        const missing = await invoke({ id: "req-missing", user: { sub: userId }, params: { id: searchId } });
        assert.equal(missing.error?.statusCode, 404);
        assert.equal(events.at(-1).fields.outcome, "not_found");
      } finally {
        restoreMissing();
      }

      const quarantined = { _id: searchId, user: userId, filters: null, lastNotifiedCount: 5, async save() { throw new Error("save should not run"); } };
      const restoreQuarantined = stubSaved(quarantined);
      try {
        const result = await invoke({ id: "req-quarantined", user: { sub: userId }, params: { id: searchId } });
        assert.equal(result.error?.statusCode, 409);
        assert.equal(events.at(-1).fields.outcome, "quarantined");
        assert.equal(events.at(-1).fields.previousAnchor, 5);
      } finally {
        restoreQuarantined();
      }
    });
    assert.equal(countCalled, false);
  } finally {
    Listing.countDocuments = originalCount;
  }
});

test("database errors emit a classified event without exposing the error", async () => {
  const databaseError = new Error("mongodb://secret-user:secret-password@example/realtyiq");
  databaseError.name = "MongoServerError";
  const restoreFindOne = stubSaved(databaseError);
  try {
    await captureTelemetry(async (events) => {
      const result = await invoke({ id: "req-db-error", user: { sub: userId }, params: { id: searchId } });
      assert.equal(result.error, databaseError);
      assert.equal(events.length, 1);
      assert.equal(events[0].fields.outcome, "database_error");
      const serialized = JSON.stringify(events[0].fields).toLowerCase();
      assert.equal(serialized.includes("mongodb://"), false);
      assert.equal(serialized.includes("secret-password"), false);
      assert.equal(serialized.includes("secret-user"), false);
    });
  } finally {
    restoreFindOne();
  }
});

test("telemetry failures cannot alter a successful acknowledgement", async () => {
  const saved = {
    _id: searchId,
    user: userId,
    filters: validFilters,
    lastNotifiedCount: 1,
    saveCalls: 0,
    async save() { this.saveCalls += 1; return this; },
  };
  const restoreFindOne = stubSaved(saved);
  const originalCount = Listing.countDocuments;
  const originalInfo = logger.info;
  Listing.countDocuments = async () => 4;
  logger.info = () => { throw new Error("telemetry sink unavailable"); };
  try {
    const { res, error } = await invoke({ id: "req-telemetry", user: { sub: userId }, params: { id: searchId } });
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, saved);
    assert.equal(saved.lastNotifiedCount, 4);
    assert.equal(saved.saveCalls, 1);
  } finally {
    restoreFindOne();
    Listing.countDocuments = originalCount;
    logger.info = originalInfo;
  }
});

test("overlapping acknowledgements emit correlatable telemetry while preserving each write", async () => {
  const originalFindOne = SavedSearch.findOne;
  const originalCount = Listing.countDocuments;
  const saved = () => ({
    _id: searchId,
    user: userId,
    filters: validFilters,
    lastNotifiedCount: 0,
    saveCalls: 0,
    async save() { this.saveCalls += 1; return this; },
  });
  const records = [saved(), saved()];
  let findIndex = 0;
  let countIndex = 0;
  SavedSearch.findOne = async () => records[findIndex++];
  Listing.countDocuments = async () => {
    const index = countIndex++;
    await new Promise((resolve) => setTimeout(resolve, index === 0 ? 35 : 5));
    return index === 0 ? 10 : 25;
  };
  try {
    await captureTelemetry(async (events) => {
      const results = await Promise.all([
        invoke({ id: "req-slow", user: { sub: userId }, params: { id: searchId } }),
        invoke({ id: "req-fast", user: { sub: userId }, params: { id: searchId } }),
      ]);
      assert.equal(results.every(({ error, res }) => !error && res.statusCode === 200), true);
      assert.deepEqual(records.map((item) => item.lastNotifiedCount).sort((a, b) => a - b), [10, 25]);
      assert.deepEqual(records.map((item) => item.saveCalls), [1, 1]);
      assert.equal(events.length, 2);
      assert.equal(new Set(events.map((event) => event.fields.savedSearchFingerprint)).size, 1);
      assert.deepEqual(events.map((event) => event.fields.computedCount).sort((a, b) => a - b), [10, 25]);
      assert.deepEqual(new Set(events.map((event) => event.fields.replayOrConflict)), new Set(["unknown"]));
      assert.equal(events.every((event) => event.fields.durationMs >= 0 && event.fields.durationMs <= 60_000), true);
    });
  } finally {
    SavedSearch.findOne = originalFindOne;
    Listing.countDocuments = originalCount;
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { listSaved, markNotified } from "../controllers/savedSearch.controller.js";
import { SavedSearch } from "../models/SavedSearch.js";
import { Listing } from "../models/Listing.js";

const userId = "507f1f77bcf86cd799439011";
const valid = (id, locality) => ({
  _id: id,
  user: userId,
  name: "Homes",
  filters: { locality },
  lastNotifiedCount: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

function query(value) {
  const chain = {
    sort: () => chain,
    lean: () => Promise.resolve(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return chain;
}

function response() {
  const result = { statusCode: 200, body: undefined };
  return {
    ...result,
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; },
    result,
  };
}

async function invoke(handler, req) {
  const res = response();
  let error;
  await handler(req, res, (nextError) => { error = nextError; });
  return { res: res.result, error };
}

test("listSaved quarantines malformed filters and counts only valid searches", async () => {
  const originalFind = SavedSearch.find;
  const originalAggregate = Listing.aggregate;
  let aggregatePipeline;
  SavedSearch.find = (filter) => {
    assert.deepEqual(filter, { user: userId });
    return query([
      valid("507f1f77bcf86cd799439012", "JP Nagar"),
      { _id: "507f1f77bcf86cd799439013", user: userId, name: "My search", lastNotifiedCount: 0 },
      { _id: "507f1f77bcf86cd799439016", user: userId, name: "Broken array", filters: [] },
      { _id: "507f1f77bcf86cd799439017", user: userId, name: "Broken primitive", filters: "all" },
    ]);
  };
  Listing.aggregate = async (pipeline) => {
    aggregatePipeline = pipeline;
    return [{ search_0: [{ count: 4 }] }];
  };
  try {
    const { res, error } = await invoke(listSaved, { user: { sub: userId } });
    assert.equal(error, undefined);
    assert.equal(aggregatePipeline[0].$facet.search_0[0].$match.locality instanceof RegExp, true);
    assert.equal(aggregatePipeline[0].$facet.search_0[0].$match.locality.test("JP Nagar"), true);
    assert.deepEqual(Object.keys(aggregatePipeline[0].$facet), ["search_0"]);
    assert.equal(res.body.items[0].matchCount, 4);
    assert.equal(res.body.items[0].newMatches, 3);
    assert.deepEqual(res.body.items[1], {
      _id: "507f1f77bcf86cd799439013",
      name: "My search",
      status: "quarantined",
      quarantineReason: "INVALID_FILTERS",
    });
    assert.equal("matchCount" in res.body.items[1], false);
    assert.equal("filters" in res.body.items[1], false);
    assert.equal(res.body.items[2].status, "quarantined");
    assert.equal(res.body.items[3].status, "quarantined");
  } finally {
    SavedSearch.find = originalFind;
    Listing.aggregate = originalAggregate;
  }
});

test("listSaved avoids listing queries when all searches are malformed", async () => {
  const originalFind = SavedSearch.find;
  const originalAggregate = Listing.aggregate;
  let aggregateCalled = false;
  SavedSearch.find = () => query([{ _id: "507f1f77bcf86cd799439014", user: userId, name: "Broken" }]);
  Listing.aggregate = async () => { aggregateCalled = true; return []; };
  try {
    const { res, error } = await invoke(listSaved, { user: { sub: userId } });
    assert.equal(error, undefined);
    assert.equal(aggregateCalled, false);
    assert.equal(res.body.items[0].status, "quarantined");
    assert.equal("matchCount" in res.body.items[0], false);
  } finally {
    SavedSearch.find = originalFind;
    Listing.aggregate = originalAggregate;
  }
});

test("valid searches keep independent counts when quarantine records are interleaved", async () => {
  const originalFind = SavedSearch.find;
  const originalAggregate = Listing.aggregate;
  SavedSearch.find = () => query([
    valid("507f1f77bcf86cd799439018", "JP Nagar"),
    { _id: "507f1f77bcf86cd799439019", user: userId, name: "Broken" },
    valid("507f1f77bcf86cd799439020", "Whitefield"),
  ]);
  Listing.aggregate = async () => [{ search_0: [{ count: 2 }], search_1: [{ count: 5 }] }];
  try {
    const { res, error } = await invoke(listSaved, { user: { sub: userId } });
    assert.equal(error, undefined);
    assert.equal(res.body.items[0].matchCount, 2);
    assert.equal(res.body.items[1].status, "quarantined");
    assert.equal(res.body.items[2].matchCount, 5);
  } finally {
    SavedSearch.find = originalFind;
    Listing.aggregate = originalAggregate;
  }
});

test("markNotified rejects malformed searches without running an unrestricted count", async () => {
  const originalFindOne = SavedSearch.findOne;
  const originalCount = Listing.countDocuments;
  let countCalled = false;
  SavedSearch.findOne = async (filter) => {
    assert.deepEqual(filter, { _id: "507f1f77bcf86cd799439015", user: userId });
    return { _id: filter._id, user: userId, name: "Broken", filters: null };
  };
  Listing.countDocuments = async () => { countCalled = true; return 600; };
  try {
    const { error } = await invoke(markNotified, { user: { sub: userId }, params: { id: "507f1f77bcf86cd799439015" } });
    assert.equal(error?.statusCode, 409);
    assert.equal(countCalled, false);
  } finally {
    SavedSearch.findOne = originalFindOne;
    Listing.countDocuments = originalCount;
  }
});

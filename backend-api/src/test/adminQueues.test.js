import test from "node:test";
import assert from "node:assert/strict";
import { adminInquiryQuerySchema, dateRangeValue, MAX_DATE_RANGE_MS, securityEventDateRangeIssues, securityEventQuerySchema } from "../validators/adminQueue.schema.js";
import { Inquiry } from "../models/Inquiry.js";
import { SecurityEvent } from "../models/SecurityEvent.js";
import { allInquiries, buildAdminInquiryFilter } from "../controllers/inquiry.controller.js";
import { buildSecurityEventFilter, listSecurityEvents, sanitizeSecurityEvent } from "../controllers/auth.controller.js";

test("admin inquiry queue query is bounded and allowlisted", () => {
  assert.deepEqual(adminInquiryQuerySchema.parse({}), { page: 1, limit: 20 });
  assert.deepEqual(adminInquiryQuerySchema.parse({ page: "2", limit: "100", status: "new" }), { page: 2, limit: 100, status: "new" });
  assert.equal(adminInquiryQuerySchema.safeParse({ page: "0" }).success, false);
  assert.equal(adminInquiryQuerySchema.safeParse({ limit: "101" }).success, false);
  assert.equal(adminInquiryQuerySchema.safeParse({ status: "pending" }).success, false);
  assert.equal(adminInquiryQuerySchema.safeParse({ "$where": "1" }).success, false);
  assert.deepEqual(buildAdminInquiryFilter({ status: "closed" }), { status: "closed" });
});

test("security event queue query only accepts bounded filters", () => {
  const referenceNow = new Date("2026-09-08T12:00:00.000Z");
  const query = securityEventQuerySchema.parse({
    page: "3", limit: "50", type: "admin_listing_updated", action: "update",
    resourceType: "listing", result: "success", actorUserId: "ABCDEFabcdefABCDEFabcdef",
    targetUserId: "507f1f77bcf86cd799439011", resourceId: "507f1f77bcf86cd799439012",
    requestId: "req-123", from: "2026-01-01", to: "2026-01-31",
  });
  assert.equal(query.page, 3);
  assert.equal(query.actorUserId, "abcdefabcdefabcdefabcdef");
  const filter = buildSecurityEventFilter(query);
  assert.equal(filter.type, "admin_listing_updated");
  assert.equal(filter.requestId, "req-123");
  assert.deepEqual(filter.createdAt, { $gte: new Date("2026-01-01"), $lt: new Date("2026-02-01") });
  assert.equal(filter.$and.length, 6);
  assert.deepEqual(filter.$and[0].$or[0], { actorUserId: "abcdefabcdefabcdefabcdef" });
  assert.deepEqual(filter.$and[1].$or[0], { targetUserId: "507f1f77bcf86cd799439011" });
  assert.deepEqual(filter.$and[2].$or[0], { action: "update" });
  assert.deepEqual(filter.$and[3].$or[0], { resourceType: "listing" });
  assert.deepEqual(filter.$and[4].$or[0], { result: "success" });
  assert.deepEqual(filter.$and[5].$or[0], { resourceId: "507f1f77bcf86cd799439012" });
  const legacyTargetFilter = buildSecurityEventFilter({ targetUserId: "507f1f77bcf86cd799439011" });
  assert.deepEqual(legacyTargetFilter.$and[0].$or[1], { type: "admin_user_updated", "metadata.targetUserId": "507f1f77bcf86cd799439011" });
  assert.equal(dateRangeValue("2026-01-31", true).toISOString(), "2026-02-01T00:00:00.000Z");
  assert.equal(securityEventQuerySchema.safeParse({ from: "not-a-date" }).success, false);
  assert.equal(securityEventQuerySchema.safeParse({ from: "2026-02-30" }).success, false);
  assert.equal(securityEventQuerySchema.safeParse({ from: "2020-01-01" }).success, false);
  assert.equal(securityEventQuerySchema.safeParse({ from: "2026-01-02", to: "2026-01-01" }).success, false);
  assert.equal(securityEventQuerySchema.safeParse({ from: "2026-01-01", to: "2027-01-02" }).success, false);
  assert.equal(securityEventQuerySchema.safeParse({ unknown: "x" }).success, false);
  assert.equal(securityEventQuerySchema.safeParse({ actorUserId: "not-an-id" }).success, false);

  assert.deepEqual(securityEventDateRangeIssues({ to: "2099-01-01" }, referenceNow), []);
  const futureFilter = buildSecurityEventFilter({ to: "2099-01-01" }, referenceNow);
  assert.ok(futureFilter.createdAt.$gte instanceof Date);
  assert.ok(futureFilter.createdAt.$lt instanceof Date);
  assert.equal(futureFilter.createdAt.$gte.toISOString(), new Date(referenceNow.getTime() - MAX_DATE_RANGE_MS).toISOString());
  assert.equal(futureFilter.createdAt.$lt.toISOString(), "2099-01-02T00:00:00.000Z");
  assert.equal(securityEventDateRangeIssues({ to: "2026-01-31" }, referenceNow).length, 0);
  assert.equal(securityEventDateRangeIssues({ to: "2025-09-01" }, referenceNow).length, 1);
  const normalToFilter = buildSecurityEventFilter({ to: "2026-01-31" }, referenceNow);
  assert.ok(normalToFilter.createdAt.$gte instanceof Date);
  assert.equal(normalToFilter.createdAt.$lt.toISOString(), "2026-02-01T00:00:00.000Z");
});

test("security event responses keep only approved metadata", () => {
  const event = sanitizeSecurityEvent({
    _id: "event-1", type: "admin_listing_updated", user: "507f1f77bcf86cd799439011",
    requestId: "req-1", ip: "127.0.0.1", userAgent: "test", createdAt: new Date(),
    metadata: { action: "update", resourceType: "listing", resourceId: "507f1f77bcf86cd799439012", token: "secret", body: { password: "secret" } },
  });
  assert.deepEqual(event.metadata, { action: "update", resourceType: "listing", resourceId: "507f1f77bcf86cd799439012" });
  assert.equal("token" in event.metadata, false);
  assert.equal("body" in event.metadata, false);
});

test("admin queue controllers return bounded, stable paginated responses", async () => {
  const originalInquiryFind = Inquiry.find;
  const originalInquiryCount = Inquiry.countDocuments;
  const originalEventFind = SecurityEvent.find;
  const originalEventCount = SecurityEvent.countDocuments;
  let inquiryQuery;
  let eventQuery;
  const chain = (items, capture) => ({
    populate() { return this; },
    sort(value) { capture.sort = value; return this; },
    skip(value) { capture.skip = value; return this; },
    limit(value) { capture.limit = value; return this; },
    select(value) { capture.select = value; return this; },
    lean: async () => items,
  });
  try {
    Inquiry.find = (filter) => { inquiryQuery = { filter }; return chain([], inquiryQuery); };
    Inquiry.countDocuments = async (filter) => { inquiryQuery.countFilter = filter; return 0; };
    let inquiryResponse;
    await allInquiries({ query: { page: 2, limit: 3, status: "new" } }, { json(value) { inquiryResponse = value; } }, (error) => { throw error; });
    assert.deepEqual(inquiryQuery.sort, { createdAt: -1, _id: -1 });
    assert.equal(inquiryQuery.skip, 3);
    assert.equal(inquiryQuery.limit, 3);
    assert.deepEqual(inquiryResponse, { items: [], page: 2, limit: 3, total: 0, totalPages: 0 });

    SecurityEvent.find = (filter) => { eventQuery = { filter }; return chain([], eventQuery); };
    SecurityEvent.countDocuments = async (filter) => { eventQuery.countFilter = filter; return 0; };
    let eventResponse;
    await listSecurityEvents({ query: { page: 2, limit: 3, type: "login_success" } }, { json(value) { eventResponse = value; } }, (error) => { throw error; });
    assert.deepEqual(eventQuery.sort, { createdAt: -1, _id: -1 });
    assert.equal(eventQuery.skip, 3);
    assert.equal(eventQuery.limit, 3);
    assert.match(eventQuery.select, /actorUserId/);
    assert.match(eventQuery.select, /targetUserId/);
    assert.match(eventQuery.select, /resourceType/);
    assert.match(eventQuery.select, /action/);
    assert.match(eventQuery.select, /result/);
    assert.deepEqual(eventResponse, { items: [], page: 2, limit: 3, total: 0, totalPages: 0 });
  } finally {
    Inquiry.find = originalInquiryFind;
    Inquiry.countDocuments = originalInquiryCount;
    SecurityEvent.find = originalEventFind;
    SecurityEvent.countDocuments = originalEventCount;
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  adminUserSchema,
  adminUsersResponseSchema,
  safelyParseAdminUsers,
} from "../src/lib/account-schemas.ts";

const validId = "507f1f77bcf86cd799439011";

test("admin users schema accepts and preserves paginated items response", () => {
  const payload = {
    items: [
      {
        _id: validId,
        name: "Admin User",
        email: "admin@example.com",
        role: "admin",
        isActive: true,
        createdAt: "2026-10-24T12:00:00.000Z",
      },
      {
        _id: "507f1f77bcf86cd799439012",
        name: "Customer User",
        email: "user@example.com",
        role: "user",
        isActive: false,
      },
    ],
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
  };

  const parsed = safelyParseAdminUsers(payload);
  assert.ok(parsed);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0]._id, validId);
  assert.equal(parsed.items[0].name, "Admin User");
  assert.equal(parsed.items[0].role, "admin");
  assert.equal(parsed.items[0].isActive, true);
  assert.equal(parsed.items[1].role, "user");
  assert.equal(parsed.items[1].isActive, false);
});

test("admin users schema supports legacy { users: [...] } via transformation", () => {
  const legacyPayload = {
    users: [
      {
        _id: validId,
        name: "Legacy Admin",
        email: "legacy@example.com",
        role: "admin",
        isActive: true,
      },
    ],
  };

  const parsed = safelyParseAdminUsers(legacyPayload);
  assert.ok(parsed);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].name, "Legacy Admin");
  assert.equal(parsed.items[0].role, "admin");
  assert.equal(parsed.items[0].isActive, true);
});

test("malformed and unexpected responses are rejected safely without throwing", () => {
  const malformedCases = [
    null,
    undefined,
    {},
    { items: null },
    { items: "not-an-array" },
    { users: "not-an-array" },
    { error: "Unauthorized" },
    { items: [{ _id: "not-an-object-id", name: "Bad ID", email: "b@b.com", role: "user", isActive: true }] },
    { items: [{ _id: validId, name: "Bad Role", email: "b@b.com", role: "superadmin", isActive: true }] },
    { items: [{ _id: validId, name: "Missing role", email: "b@b.com", isActive: true }] },
  ];

  for (const bad of malformedCases) {
    const parsed = safelyParseAdminUsers(bad);
    assert.equal(parsed, null, `Expected safelyParseAdminUsers to return null for ${JSON.stringify(bad)}`);
    const result = adminUsersResponseSchema.safeParse(bad);
    assert.equal(result.success, false);
  }
});

test("error boundary digest validation admits opaque codes and rejects sensitive/malformed strings", () => {
  const DIGEST_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

  const validDigests = [
    "2849182910",
    "NEXT_NOT_FOUND",
    "err_404_abc123",
    "A-B_C-123",
  ];

  for (const digest of validDigests) {
    assert.ok(DIGEST_PATTERN.test(digest), `Expected ${digest} to pass digest pattern`);
  }

  const invalidDigests = [
    "",
    "   ",
    "<script>alert(1)</script>",
    "Error: Database connection failed at /app/server.js:42",
    "token=ey123456",
    "a".repeat(65),
    "has whitespace inside",
    "path/to/file.tsx",
  ];

  for (const digest of invalidDigests) {
    assert.equal(DIGEST_PATTERN.test(digest), false, `Expected ${digest} to fail digest pattern`);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { SecurityEvent } from "../models/SecurityEvent.js";
import { refresh } from "../controllers/auth.controller.js";
import { signRefreshToken } from "../utils/jwt.js";
import { hashToken } from "../utils/tokenHash.js";
import { env } from "../config/env.js";
import { csrfProtection } from "../middleware/csrf.js";

const userId = "507f1f77bcf86cd799439011";

function makeToken(version = 0) {
  return signRefreshToken({ sub: userId, role: "user", email: "user@example.com", ver: version, jti: crypto.randomUUID() });
}

function makeRequest(token, cookieOnly = false) {
  return {
    body: cookieOnly ? {} : { refreshToken: token },
    id: "refresh-test", ip: "127.0.0.1", get: () => "test-agent",
    headers: cookieOnly ? { cookie: `riq_refresh=${encodeURIComponent(token)}` } : {},
  };
}

function invoke(token, cookieOnly = false) {
  return new Promise((resolve) => {
    const response = {
      append() {},
      json(body) { resolve({ status: 200, body }); },
    };
    refresh(makeRequest(token, cookieOnly), response, (error) => resolve({ status: error?.statusCode || 500, error }));
  });
}

function userFor(token, tokenVersion = 0) {
  return {
    _id: userId,
    role: "user",
    email: "user@example.com",
    isActive: true,
    tokenVersion,
    refreshTokens: [],
    refreshTokenHashes: [hashToken(token)],
  };
}

function installUserMocks(user, updateOne) {
  const originalFindById = User.findById;
  const originalUpdateOne = User.updateOne;
  const originalSecurityCreate = SecurityEvent.create;
  User.findById = () => ({ select: () => Promise.resolve(user) });
  User.updateOne = updateOne;
  SecurityEvent.create = async () => undefined;
  return () => {
    User.findById = originalFindById;
    User.updateOne = originalUpdateOne;
    SecurityEvent.create = originalSecurityCreate;
  };
}

test("refresh rotates atomically without a document save", async () => {
  const token = makeToken();
  let update;
  const restore = installUserMocks(userFor(token), async (filter, changes) => {
    update = { filter, changes };
    return { modifiedCount: 1 };
  });
  try {
    const result = await invoke(token);
    assert.equal(result.status, 200);
    assert.ok(update.filter.$or);
    assert.equal(update.filter.tokenVersion, 0);
    assert.equal(update.changes.$set.refreshTokens.length, 0);
    assert.equal(update.changes.$set.refreshTokenHashes.length, 1);
  } finally {
    restore();
  }
});

test("legacy plaintext refresh tokens migrate to hashes during atomic rotation", async () => {
  const token = makeToken();
  let update;
  const restore = installUserMocks({ ...userFor(token), refreshTokenHashes: [], refreshTokens: [token] }, async (filter, changes) => {
    update = { filter, changes };
    return { modifiedCount: 1 };
  });
  try {
    const result = await invoke(token);
    assert.equal(result.status, 200);
    assert.ok(update.filter.$or.some((clause) => clause.refreshTokens === token));
    assert.deepEqual(update.changes.$set.refreshTokens, []);
    assert.equal(update.changes.$set.refreshTokenHashes.length, 1);
    assert.notEqual(update.changes.$set.refreshTokenHashes[0], token);
    assert.equal(update.changes.$set.refreshTokenHashes[0], hashToken(result.body.refreshToken));
  } finally {
    restore();
  }
});

test("cookie-only refresh remains supported", async () => {
  const token = makeToken();
  const restore = installUserMocks(userFor(token), async () => ({ modifiedCount: 1 }));
  try {
    assert.equal((await invoke(token, true)).status, 200);
  } finally {
    restore();
  }
});

test("concurrent refreshes allow exactly one rotation and reject the loser without 500", async () => {
  const token = makeToken();
  let rotations = 0;
  let invalidations = 0;
  const restore = installUserMocks(userFor(token), async (filter) => {
    if (filter.tokenVersion !== undefined) {
      rotations += 1;
      return { modifiedCount: rotations === 1 ? 1 : 0 };
    }
    invalidations += 1;
    return { modifiedCount: 1 };
  });
  try {
    const results = await Promise.all([invoke(token), invoke(token)]);
    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 401]);
    assert.equal(rotations, 2);
    assert.equal(invalidations, 1);
    assert.ok(results.every(({ status }) => status !== 500));
  } finally {
    restore();
  }
});

test("a Mongoose version conflict is converted to controlled refresh rejection", async () => {
  const token = makeToken();
  let invalidated = false;
  const restore = installUserMocks(userFor(token), async (filter) => {
    if (filter.tokenVersion !== undefined) throw Object.assign(new Error("stale document"), { name: "VersionError" });
    invalidated = true;
    return { modifiedCount: 1 };
  });
  try {
    const result = await invoke(token);
    assert.equal(result.status, 401);
    assert.equal(invalidated, true);
  } finally {
    restore();
  }
});

test("refresh reuse invalidates the account and returns 401", async () => {
  const token = makeToken();
  let invalidation;
  const restore = installUserMocks({ ...userFor(token), refreshTokenHashes: [] }, async (filter, changes) => {
    invalidation = { filter, changes };
    return { modifiedCount: 1 };
  });
  try {
    const result = await invoke(token);
    assert.equal(result.status, 401);
    assert.deepEqual(invalidation.changes.$set, { refreshTokens: [], refreshTokenHashes: [] });
    assert.deepEqual(invalidation.changes.$inc, { tokenVersion: 1 });
  } finally {
    restore();
  }
});

test("invalid and expired refresh tokens never reach persistence", async () => {
  let calls = 0;
  const originalFindById = User.findById;
  User.findById = () => { calls += 1; throw new Error("lookup should not run"); };
  try {
    assert.equal((await invoke("not-a-jwt")).status, 401);
    const expired = jwt.sign({ sub: userId, role: "user", ver: 0 }, env.jwt.refreshSecret, { expiresIn: -1 });
    assert.equal((await invoke(expired)).status, 401);
    assert.equal(calls, 0);
  } finally {
    User.findById = originalFindById;
  }
});

test("tokenVersion invalidation rejects otherwise valid old refresh tokens", async () => {
  const token = makeToken(0);
  let updates = 0;
  const restore = installUserMocks(userFor(token, 1), async () => {
    updates += 1;
    return { modifiedCount: 1 };
  });
  try {
    assert.equal((await invoke(token)).status, 401);
    assert.equal(updates, 0);
  } finally {
    restore();
  }
});

test("CSRF rejects mismatched UTF-8 byte lengths without throwing", async () => {
  const result = await new Promise((resolve) => {
    const req = {
      method: "POST",
      headers: { cookie: "riq_access=present; riq_csrf=%C3%A9" },
      get: (name) => name === "X-CSRF-Token" ? "a" : undefined,
    };
    const res = { status(code) { return { json(body) { resolve({ code, body }); } }; } };
    csrfProtection(req, res, () => resolve({ code: 500 }));
  });
  assert.equal(result.code, 403);
});

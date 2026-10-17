import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { bootstrapAdminCredentials } from "../utils/bootstrapAdmin.js";
import { mlService } from "../services/ml.service.js";
import { User } from "../models/User.js";
import { parseCookies, setAuthCookies } from "../utils/authCookies.js";
import { randomToken, hashToken, createShareToken } from "../utils/tokenHash.js";
import { findPublicPrediction, isLegacyShareable } from "../controllers/predict.controller.js";
import { Prediction } from "../models/Prediction.js";
import { SavedSearch } from "../models/SavedSearch.js";
import { formatLog, safePath } from "../utils/logger.js";
import { isAdminSetMutation } from "../controllers/auth.controller.js";
import { objectIdParamSchema } from "../validators/params.schema.js";
import { recordAdminMutationEvent, recordSecurityEvent } from "../utils/securityEvent.js";
import { SecurityEvent } from "../models/SecurityEvent.js";
import { sanitizeSecurityEvent } from "../controllers/auth.controller.js";

test("admin mutation boundaries are explicit and audit metadata is redacted", async () => {
  assert.equal(objectIdParamSchema.safeParse({ id: "ABCDEFabcdefABCDEFabcdef" }).success, true);
  assert.equal(objectIdParamSchema.safeParse({ id: "not-an-id" }).success, false);
  assert.equal(isAdminSetMutation({ role: "admin" }, { isActive: false }), true);
  assert.equal(isAdminSetMutation({ role: "user" }, { isActive: false }), false);
  assert.equal(isAdminSetMutation({ role: "user" }, { role: "admin" }), true);

  const originalCreate = SecurityEvent.create;
  let event;
  SecurityEvent.create = async (payload) => { event = payload; };
  try {
    await recordAdminMutationEvent({ id: "req-1", ip: "127.0.0.1", get: () => "test-agent" }, "admin_listing_updated", {
      resourceType: "listing", resourceId: "507f1f77bcf86cd799439011", action: "update",
    });
  } finally {
    SecurityEvent.create = originalCreate;
  }
  assert.equal(event.type, "admin_listing_updated");
  assert.deepEqual(event.metadata, {
    action: "update", result: "success", resourceType: "listing", resourceId: "507f1f77bcf86cd799439011",
  });
  assert.equal("token" in event.metadata, false);
  assert.equal("password" in event.metadata, false);
});

test("security events persist explicit actor/target fields and safe scalar metadata only", async () => {
  const originalCreate = SecurityEvent.create;
  let event;
  SecurityEvent.create = async (payload) => { event = payload; };
  try {
    await recordSecurityEvent({ id: "req-actor", ip: "127.0.0.1", get: () => "test-agent" }, "admin_user_updated", "507f1f77bcf86cd799439011", {
      status: "active", password: "secret", passwordHash: "hash", body: { password: "secret" }, nested: { ok: true }, token: "jwt",
    }, {
      actorUserId: "507f1f77bcf86cd799439011", targetUserId: "507f1f77bcf86cd799439012",
      resourceType: "user", resourceId: "507f1f77bcf86cd799439012", action: "update", result: "success",
    });
  } finally {
    SecurityEvent.create = originalCreate;
  }
  assert.equal(String(event.actorUserId), "507f1f77bcf86cd799439011");
  assert.equal(String(event.targetUserId), "507f1f77bcf86cd799439012");
  assert.equal(event.resourceType, "user");
  assert.equal(event.action, "update");
  assert.equal(event.result, "success");
  assert.deepEqual(event.metadata, { status: "active" });
});

test("legacy security events use only proven actor/target mappings", () => {
  const actor = "507f1f77bcf86cd799439011";
  const target = "507f1f77bcf86cd799439012";
  const oldAdminUpdate = sanitizeSecurityEvent({ type: "admin_user_updated", user: actor, metadata: { targetUserId: target } });
  assert.equal(oldAdminUpdate.actorUserId, actor);
  assert.equal(oldAdminUpdate.targetUserId, target);
  const oldBootstrap = sanitizeSecurityEvent({ type: "admin_bootstrap", user: target, metadata: { source: "cli" } });
  assert.equal(oldBootstrap.actorUserId, null);
  assert.equal(oldBootstrap.targetUserId, target);
});

test("admin bootstrap requires explicit strong credentials", () => {
  assert.throws(() => bootstrapAdminCredentials({}), /required/);
  assert.throws(() => bootstrapAdminCredentials({ BOOTSTRAP_ADMIN_EMAIL: "admin@example.com", BOOTSTRAP_ADMIN_PASSWORD: "short" }), /16 characters/);
  assert.deepEqual(
    bootstrapAdminCredentials({ BOOTSTRAP_ADMIN_EMAIL: " Admin@Example.com ", BOOTSTRAP_ADMIN_PASSWORD: "a".repeat(16) }),
    { email: "admin@example.com", password: "a".repeat(16) },
  );
});

test("production rejects weak JWT and ML service secrets", () => {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    MONGODB_URI: "mongodb://127.0.0.1:27017/realtyiq",
    JWT_ACCESS_SECRET: "short",
    JWT_REFRESH_SECRET: "b".repeat(32),
    ML_SERVICE_TOKEN: "c".repeat(32),
  };
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", "import './src/config/env.js'"], {
    cwd: process.cwd(), env, encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /JWT_ACCESS_SECRET/);

  const placeholder = spawnSync(process.execPath, ["--input-type=module", "-e", "import './src/config/env.js'"], {
    cwd: process.cwd(), env: {
      ...env,
      JWT_ACCESS_SECRET: "replace_with_long_random_string_at_least_32_chars",
    }, encoding: "utf8",
  });
  assert.notEqual(placeholder.status, 0);
  assert.match(`${placeholder.stdout}${placeholder.stderr}`, /JWT_ACCESS_SECRET/);
});

test("production rejects missing ML token and reused JWT keys", () => {
  const base = {
    ...process.env,
    NODE_ENV: "production",
    MONGODB_URI: "mongodb://127.0.0.1:27017/realtyiq",
    JWT_ACCESS_SECRET: "access-secret-0123456789-abcdefghijk",
    JWT_REFRESH_SECRET: "access-secret-0123456789-abcdefghijk",
    ML_SERVICE_TOKEN: "ml-service-token-0123456789-abcdefgh",
  };
  const equalKeys = spawnSync(process.execPath, ["--input-type=module", "-e", "import './src/config/env.js'"], {
    cwd: process.cwd(), env: base, encoding: "utf8",
  });
  assert.notEqual(equalKeys.status, 0);
  assert.match(`${equalKeys.stdout}${equalKeys.stderr}`, /must be different/);

  const { ML_SERVICE_TOKEN, ...withoutToken } = base;
  const missingToken = spawnSync(process.execPath, ["--input-type=module", "-e", "import './src/config/env.js'"], {
    cwd: process.cwd(), env: { ...withoutToken, JWT_REFRESH_SECRET: "refresh-secret-0123456789-abcdefghijk" }, encoding: "utf8",
  });
  assert.notEqual(missingToken.status, 0);
  assert.match(`${missingToken.stdout}${missingToken.stderr}`, /ML_SERVICE_TOKEN/);
});

test("production requires an explicit CORS origin", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", "import './src/config/env.js'"], {
    cwd: process.cwd(), env: {
      ...process.env,
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://127.0.0.1:27017/realtyiq",
      JWT_ACCESS_SECRET: "a1234567890123456789012345678901",
      JWT_REFRESH_SECRET: "b1234567890123456789012345678901",
      ML_SERVICE_TOKEN: "c1234567890123456789012345678901",
      CORS_ORIGIN: "",
    }, encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /CORS_ORIGIN/);
});

test("ML client does not forward upstream exception details", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => JSON.stringify({ detail: "private model path" }) });
  try {
    await assert.rejects(() => mlService.health(), (error) => error.message === "ML service error");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("users have a token version for explicit session invalidation", () => {
  assert.equal(User.schema.path("tokenVersion").defaultValue, 0);
  assert.equal(User.schema.path("refreshTokenHashes").options.select, false);
});

test("auth cookies and share tokens avoid browser-readable refresh storage", () => {
  const parsed = parseCookies("riq_access=abc; riq_csrf=csrf123");
  assert.deepEqual(parsed, { riq_access: "abc", riq_csrf: "csrf123" });
  const headers = { append(name, value) { this[name] = [...(this[name] || []), value]; } };
  setAuthCookies(headers, { accessToken: "access", refreshToken: "refresh" });
  assert.equal(headers["Set-Cookie"].length, 3);
  assert.match(headers["Set-Cookie"][0], /HttpOnly/);
  assert.match(headers["Set-Cookie"][2], /riq_csrf=/);
  const token = randomToken();
  assert.ok(token.length >= 40);
  assert.equal(hashToken(token).length, 64);
  assert.equal(Prediction.schema.path("shareTokenHash").options.select, false);
  assert.equal(SavedSearch.schema.indexes().some(([fields]) => fields.user === 1 && fields.createdAt === -1), true);
});

test("compare share tokens are hashed and never treated as legacy records", () => {
  const share = createShareToken(60_000);
  const record = new Prediction({
    input: { listingId: "listing" }, predictedPrice: 1, confidenceLow: 1, confidenceHigh: 1,
    shareTokenHash: share.hash, shareExpiresAt: share.expiresAt, createdAt: new Date(),
  });
  const stored = record.toObject();
  assert.ok(share.token.length >= 40);
  assert.equal(stored.shareTokenHash, hashToken(share.token));
  assert.notEqual(stored.shareTokenHash, share.token);
  assert.equal(isLegacyShareable(stored), false);
  assert.equal(isLegacyShareable({ createdAt: new Date() }), true);
  assert.equal(isLegacyShareable({ createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) }, new Date(), 30 * 24 * 60 * 60 * 1000), false);
});

test("public prediction lookup requires a valid token or genuine legacy record", async () => {
  const now = new Date();
  const share = createShareToken(60_000);
  const tokenRecord = { id: "compare", shareTokenHash: share.hash, createdAt: now };
  let tokenFilter;
  const tokenModel = {
    findOne(filter) { tokenFilter = filter; return { select() { return this; }, lean: async () => tokenRecord }; },
    findById() { return { select() { return this; }, lean: async () => null }; },
  };
  assert.equal((await findPublicPrediction(share.token, now, tokenModel)).id, "compare");
  assert.equal(tokenFilter.shareTokenHash, hashToken(share.token));
  assert.deepEqual(tokenFilter.shareRevokedAt, { $exists: false });
  assert.ok(tokenFilter.shareExpiresAt.$gt instanceof Date);
  assert.ok(tokenFilter.expiresAt.$gt instanceof Date);

  const rejectedTokenModel = { findOne() { return { select() { return this; }, lean: async () => null }; } };
  assert.equal(await findPublicPrediction("x".repeat(43), now, rejectedTokenModel), null);

  const legacyId = "507f1f77bcf86cd799439011";
  const legacyModel = { findById() { return { select() { return this; }, lean: async () => ({ createdAt: now }) }; } };
  assert.ok(await findPublicPrediction(legacyId, now, legacyModel));

  const newRecordModel = { findById() { return { select() { return this; }, lean: async () => ({ createdAt: now, shareTokenHash: share.hash }) }; } };
  assert.equal(await findPublicPrediction(legacyId, now, newRecordModel), null);

  const expiredLegacyModel = { findById() { return { select() { return this; }, lean: async () => ({ createdAt: new Date(now - 31 * 24 * 60 * 60 * 1000) }) }; } };
  assert.equal(await findPublicPrediction(legacyId, now, expiredLegacyModel), null);
});

test("structured logs are JSON and redact sensitive fields", () => {
  const line = formatLog("warn", "http_request_error", {
    requestId: "trace-123", method: "POST", path: "/api/predict", status: 502,
    Authorization: "Bearer jwt", cookie: "riq_access=secret", password: "pw", body: { token: "ml-secret" },
  });
  const parsed = JSON.parse(line);
  assert.equal(parsed.service, "api");
  assert.equal(parsed.event, "http_request_error");
  assert.equal(parsed.requestId, "trace-123");
  assert.equal(parsed.status, 502);
  assert.doesNotMatch(line, /Bearer|jwt|riq_access|ml-secret|password|secret/i);
  assert.equal(safePath("/api/predict/abcdefghijklmnopqrstuvwxyz0123456789"), "/api/predict/:redacted");
});

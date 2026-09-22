import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createApp } from "../app.js";

test("HTTP health and protected route boundaries", async () => {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).service, "backend-api");
    for (const path of ["/api/predict/history", "/api/auth/admin/users"]) {
      assert.equal((await fetch(`${base}${path}`)).status, 401);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("public listing detail routes reject malformed identifiers before controller access", async () => {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ["/api/listings/not-an-id", "/api/listings/not-an-id/deal"]) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /validation/i);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("CSRF bootstrap returns a stable browser token without auth credentials", async () => {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const first = await fetch(`${base}/api/auth/csrf`);
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.deepEqual(Object.keys(firstBody), ["csrfToken"]);
    assert.match(firstBody.csrfToken, /^[A-Za-z0-9_-]{43}$/);
    assert.match(first.headers.get("set-cookie") || "", /riq_csrf=/);
    assert.doesNotMatch(JSON.stringify(firstBody), /accessToken|refreshToken|password|secret/i);

    const second = await fetch(`${base}/api/auth/csrf`, { headers: { Cookie: `riq_csrf=${firstBody.csrfToken}` } });
    assert.equal(second.status, 200);
    assert.deepEqual(await second.json(), { csrfToken: firstBody.csrfToken });

    const protectedRequest = await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: `riq_access=invalid; riq_csrf=${firstBody.csrfToken}`, "X-CSRF-Token": firstBody.csrfToken },
      body: "{}",
    });
    assert.equal(protectedRequest.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("readiness follows the Mongoose connection state without exposing diagnostics", async () => {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalState = mongoose.connection.readyState;
  try {
    for (const [state, expectedStatus, expectedBody] of [
      [mongoose.STATES.connected, 200, "ready"],
      [mongoose.STATES.connecting, 503, "not_ready"],
      [mongoose.STATES.disconnecting, 503, "not_ready"],
      [mongoose.STATES.disconnected, 503, "not_ready"],
      [mongoose.STATES.uninitialized, 503, "not_ready"],
    ]) {
      mongoose.connection.readyState = state;
      const response = await fetch(`${base}/ready`);
      assert.equal(response.status, expectedStatus);
      assert.deepEqual(await response.json(), { status: expectedBody });
    }
  } finally {
    mongoose.connection.readyState = originalState;
    await new Promise((resolve) => server.close(resolve));
  }
});

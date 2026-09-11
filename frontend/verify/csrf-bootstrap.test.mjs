import test from "node:test";
import assert from "node:assert/strict";
import { api, clearCsrfToken } from "../src/lib/api.ts";

const csrfToken = "A".repeat(43);
const user = { id: "507f1f77bcf86cd799439011", name: "Test User", email: "test@example.com", role: "user" };

test("unsafe auth requests bootstrap CSRF in memory and send the matching header", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  clearCsrfToken();
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/api/auth/csrf")) return new Response(JSON.stringify({ csrfToken }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ user }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await api.login({ email: user.email, password: "password" });
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/api\/auth\/csrf$/);
    assert.equal(calls[1].init.credentials, "include");
    assert.equal(new Headers(calls[1].init.headers).get("X-CSRF-Token"), csrfToken);
  } finally {
    globalThis.fetch = originalFetch;
    clearCsrfToken();
  }
});

test("malformed CSRF bootstrap responses fail safely before the unsafe request", async () => {
  const originalFetch = globalThis.fetch;
  clearCsrfToken();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ csrfToken: 17 }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await assert.rejects(() => api.login({ email: user.email, password: "password" }), (error) => error?.kind === "malformed_response");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    clearCsrfToken();
  }
});

test("failed refresh clears the in-memory CSRF token before a new session", async () => {
  const originalFetch = globalThis.fetch;
  const tokens = ["B".repeat(43), "C".repeat(43)];
  const calls = [];
  clearCsrfToken();
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/api/auth/csrf")) {
      return new Response(JSON.stringify({ csrfToken: tokens.shift() }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (String(url).endsWith("/api/auth/refresh")) return new Response(JSON.stringify({ error: "Invalid refresh token" }), { status: 401, headers: { "content-type": "application/json" } });
    if (String(url).endsWith("/api/auth/me")) return new Response(JSON.stringify({ error: "Expired" }), { status: 401, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ user }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await api.login({ email: user.email, password: "password" });
    await assert.rejects(() => api.me());
    await api.login({ email: user.email, password: "password" });
    const loginRequests = calls.filter(({ url }) => url.endsWith("/api/auth/login"));
    assert.equal(loginRequests.length, 2);
    assert.equal(new Headers(loginRequests[1].init.headers).get("X-CSRF-Token"), "C".repeat(43));
  } finally {
    globalThis.fetch = originalFetch;
    clearCsrfToken();
  }
});

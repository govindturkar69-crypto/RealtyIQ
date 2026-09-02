import test from "node:test";
import assert from "node:assert/strict";
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

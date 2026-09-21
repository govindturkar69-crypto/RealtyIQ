import test from "node:test";
import assert from "node:assert/strict";
import { mlService } from "../services/ml.service.js";
import { safeRequestId } from "../middleware/requestId.js";
import { env } from "../config/env.js";

function response(status, body, contentType = "application/json", headers = {}) {
  const values = new Map([
    ["content-type", contentType],
    ...Object.entries(headers),
  ].map(([key, value]) => [key.toLowerCase(), value]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => values.get(name.toLowerCase()) || null },
    text: async () => typeof body === "string" ? body : JSON.stringify(body),
  };
}

const prediction = {
  predicted_price: 10000000,
  confidence_low: 9000000,
  confidence_high: 11000000,
  confidence_interval_pct: 95,
  price_per_sqft: 8000,
  currency: "INR",
  model_name: "test-model",
};

const modelInfo = {
  model_name: "test-model",
  dataset: "bengaluru",
};

const TEST_ML_TOKEN = "ml-test-service-token-0123456789";

async function withMlToken(run) {
  const previous = env.mlServiceToken;
  env.mlServiceToken = TEST_ML_TOKEN;
  try {
    return await run();
  } finally {
    env.mlServiceToken = previous;
  }
}

test("ML client accepts a valid prediction and propagates request ID", async () => {
  const originalFetch = globalThis.fetch;
  let options;
  globalThis.fetch = async (_url, requestOptions) => {
    options = requestOptions;
    return response(200, prediction);
  };
  try {
    await withMlToken(async () => {
      assert.deepEqual(await mlService.predict({ location: "Whitefield" }, "trace-123"), prediction);
      assert.equal(options.headers["X-Request-Id"], "trace-123");
      assert.equal(options.headers.Authorization, `Bearer ${TEST_ML_TOKEN}`);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ML client sends the bearer token to protected routes and keeps health public", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, requestOptions) => {
    calls.push({ url, headers: requestOptions.headers });
    if (String(url).endsWith("/feature-importance?top=15")) return response(200, []);
    if (String(url).endsWith("/localities")) return response(200, { categorical: { location: [] } });
    if (String(url).endsWith("/model-info")) return response(200, modelInfo);
    return response(200, { status: "ok", model_loaded: true });
  };
  try {
    await withMlToken(async () => {
      await mlService.featureImportance();
      await mlService.localities();
      await mlService.modelInfo();
      await mlService.health();
      const protectedCalls = calls.slice(0, 3);
      assert.ok(protectedCalls.every(({ headers }) => headers.Authorization === `Bearer ${TEST_ML_TOKEN}`));
      assert.equal(calls[3].headers.Authorization, undefined);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ML client rejects malformed, empty, and unexpected-content responses", async () => {
  const originalFetch = globalThis.fetch;
  const cases = [
    response(200, "not-json", "text/plain"),
    response(200, "", "application/json"),
    response(200, "{broken", "application/json"),
    response(200, { predicted_price: 1 }, "application/json"),
  ];
  try {
    for (const result of cases) {
      globalThis.fetch = async () => result;
      await assert.rejects(() => mlService.predict({ location: "Whitefield" }), (error) =>
        error.statusCode === 502 && error.message === "ML service returned an invalid response");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ML client rejects malformed metadata responses", async () => {
  const originalFetch = globalThis.fetch;
  const cases = [
    [() => mlService.localities(), response(200, {})],
    [() => mlService.modelInfo(), response(200, { model_name: "test-model" })],
    [() => mlService.featureImportance(), response(200, [{ feature: "location", importance: "high" }])],
  ];
  try {
    await withMlToken(async () => {
      for (const [call, result] of cases) {
        globalThis.fetch = async () => result;
        await assert.rejects(call, (error) =>
          error.statusCode === 502 && error.message === "ML service returned an invalid response");
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ML 429 is classified once with a bounded Retry-After", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response(429, "Too Many Requests\n", "text/plain", { "retry-after": "9999" });
  };
  try {
    await assert.rejects(() => mlService.predict({ location: "Whitefield" }), (error) => {
      assert.equal(error.statusCode, 429);
      assert.equal(error.message, "ML service rate limited");
      assert.deepEqual(error.details, { retryAfter: 300 });
      return true;
    });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ML 4xx/5xx responses remain generic and safe", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [401, 400, 500, 503]) {
      globalThis.fetch = async () => response(status, { detail: "private model path and secret" });
      await assert.rejects(() => mlService.health(), (error) => {
        assert.equal(error.statusCode, 502);
        assert.doesNotMatch(error.message, /private|secret/i);
        assert.doesNotMatch(JSON.stringify(error), /private|secret/i);
        return true;
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ML timeout, connection failure, and redirects are controlled", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { const error = new Error("aborted"); error.name = "AbortError"; throw error; };
    await assert.rejects(() => mlService.health(), (error) => error.statusCode === 504 && error.message === "ML service timeout");

    globalThis.fetch = async () => { throw new Error("socket failure"); };
    await assert.rejects(() => mlService.health(), (error) => error.statusCode === 502 && error.message === "ML service unreachable");

    globalThis.fetch = async () => { const error = new TypeError("fetch failed"); error.cause = { code: "UND_ERR_FR_TOO_MANY_REDIRECTS" }; throw error; };
    await assert.rejects(() => mlService.health(), (error) => error.statusCode === 502 && error.message === "ML service redirect rejected");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("request IDs are bounded, safe, and not included with sensitive error data", async () => {
  assert.equal(safeRequestId("trace-123"), "trace-123");
  const generated = safeRequestId("bad\nrequest-id");
  assert.ok(generated.length <= 128);
  assert.match(generated, /^[A-Za-z0-9._:-]+$/);

  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  const output = [];
  console.log = (...args) => output.push(args);
  console.error = (...args) => output.push(args);
  globalThis.fetch = async () => response(500, { detail: "token-secret-body" });
  try {
    await assert.rejects(() => mlService.health("trace-123"));
    assert.doesNotMatch(JSON.stringify(output), /token-secret-body|Authorization|Bearer/i);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
  }
});

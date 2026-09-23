import { expect, test } from "@playwright/test";
import { startStack, stopStack, type LocalStack } from "./stack";

let stack: LocalStack;

test.beforeAll(async () => {
  stack = await startStack();
});

test.afterAll(async () => {
  if (stack) await stopStack(stack);
});

function setCookies(response: { headersArray(): Array<{ name: string; value: string }> }) {
  return response.headersArray()
    .filter(({ name }) => name.toLowerCase() === "set-cookie")
    .map(({ value }) => value);
}

test("preserves sanitized cookies on successful proxy responses", async ({ request }) => {
  const response = await request.get("/api/cookie-success");
  const cookies = await setCookies(response);

  expect(response.status()).toBe(200);
  expect(cookies).toHaveLength(2);
  expect(cookies.join("\n")).not.toMatch(/Domain=|Priority=|Internal-Host=|render\.internal/i);
  expect(cookies[0]).toMatch(/riq_access=fixture-access/);
  expect(cookies[0]).toMatch(/HttpOnly/);
  expect(cookies[0]).toMatch(/Secure/);
  expect(cookies[0]).toMatch(/SameSite=Lax/);
  expect(cookies[1]).toMatch(/riq_csrf=fixture-csrf/);
  expect(cookies[1]).toMatch(/Max-Age=60/);
});

test("preserves sanitized cookies on upstream client and server errors", async ({ request }) => {
  for (const [path, status] of [["client-error", 400], ["server-error", 503]] as const) {
    const response = await request.get(`/api/cookie-${path}`);
    const cookies = await setCookies(response);

    expect(response.status()).toBe(status);
    expect(cookies).toHaveLength(2);
    expect(cookies.join("\n")).not.toMatch(/Domain=|Priority=|Internal-Host=|render\.internal/i);
    expect(cookies[0]).toMatch(/HttpOnly/);
    expect(cookies[0]).toMatch(/Secure/);
    expect(cookies[0]).toMatch(/SameSite=Lax/);
    expect(cookies[1]).toMatch(/Secure/);
    expect(cookies[1]).toMatch(/SameSite=Lax/);
  }
});

test("preserves the application API prefix and query string", async ({ request }) => {
  const csrfResponse = await request.get("/api/auth/csrf");
  expect(csrfResponse.status()).toBe(200);
  await expect(csrfResponse.json()).resolves.toEqual({ path: "/api/auth/csrf", search: "" });

  const optionsResponse = await request.get("/api/predict/options?locality=Whitefield&limit=2");
  expect(optionsResponse.status()).toBe(200);
  await expect(optionsResponse.json()).resolves.toEqual({
    path: "/api/predict/options",
    search: "?locality=Whitefield&limit=2",
  });
});

test("preserves root health mappings and application POST bodies", async ({ request }) => {
  const healthResponse = await request.get("/api/health");
  expect(healthResponse.status()).toBe(200);
  await expect(healthResponse.json()).resolves.toEqual({ status: "ok", source: "playwright-upstream" });

  const readyResponse = await request.get("/api/ready");
  expect(readyResponse.status()).toBe(200);
  await expect(readyResponse.json()).resolves.toEqual({ status: "ready", source: "playwright-upstream" });

  const predictionResponse = await request.post("/api/predict", {
    data: { locality: "Whitefield", area: 1200 },
  });
  expect(predictionResponse.status()).toBe(200);
  await expect(predictionResponse.json()).resolves.toEqual({
    method: "POST",
    path: "/api/predict",
    body: { locality: "Whitefield", area: 1200 },
  });
});

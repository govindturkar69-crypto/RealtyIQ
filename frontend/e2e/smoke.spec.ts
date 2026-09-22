import { expect, test } from "@playwright/test";
import { startStack, stopStack, type LocalStack } from "./stack";

let stack: LocalStack;

test.beforeAll(async () => {
  stack = await startStack();
});

test.afterAll(async () => {
  if (stack) await stopStack(stack);
});

test("loads the RealtyIQ home page", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Know what a property is really worth" })).toBeVisible();
});

test("reaches the API through the same-origin proxy", async ({ page, baseURL }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/health");
    return { url: response.url, status: response.status, body: await response.json() };
  });

  expect(new URL(result.url).origin).toBe(new URL(baseURL!).origin);
  expect(new URL(result.url).pathname).toBe("/api/health");
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ status: "ok", source: "playwright-upstream" });
});

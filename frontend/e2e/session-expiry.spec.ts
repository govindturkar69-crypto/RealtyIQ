import { expect, test, type Page } from "@playwright/test";
import { startStack, stopStack, type LocalStack } from "./stack";

let stack: LocalStack;

test.beforeAll(async () => {
  stack = await startStack();
});

test.afterAll(async () => {
  if (stack) await stopStack(stack);
});

const user = {
  _id: "user-1",
  name: "Test User",
  email: "test@example.com",
  role: "user",
  isActive: true,
};

async function mockAuthenticatedApi(page: Page, historyStatus = 200) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/me") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user }) });
      return;
    }
    if (path === "/api/saved-searches") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
      return;
    }
    if (path === "/api/predict/history") {
      await route.fulfill({ status: historyStatus, contentType: "application/json", body: JSON.stringify(historyStatus === 200 ? { items: [] } : { error: "Unauthorized" }) });
      return;
    }
    if (path === "/api/auth/csrf") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "a".repeat(43) }) });
      return;
    }
    if (path === "/api/auth/refresh") {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Unauthorized" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
  });
}

test("keeps authenticated UI visible when the session is valid", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Hi, Test" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("clears stale auth UI and redirects after refresh failure", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __sessionExpiredEvents?: number }).__sessionExpiredEvents = 0;
    window.addEventListener("realtyiq:session-expired", () => {
      const target = window as Window & { __sessionExpiredEvents?: number };
      target.__sessionExpiredEvents = (target.__sessionExpiredEvents || 0) + 1;
    });
  });
  await mockAuthenticatedApi(page, 401);
  const historyRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/predict/history");
  const refreshResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/refresh");
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await historyRequest;
  await refreshResponse;
  await expect.poll(() => page.evaluate(() => (window as Window & { __sessionExpiredEvents?: number }).__sessionExpiredEvents)).toBe(1);
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Logout" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/login$/);
});

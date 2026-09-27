import { expect, test, type Page } from "@playwright/test";
import { startStack, stopStack, type LocalStack } from "./stack";

let stack: LocalStack;

test.beforeAll(async () => {
  stack = await startStack();
});

test.afterAll(async () => {
  if (stack) await stopStack(stack);
});

const user = { _id: "user-1", name: "Test User", email: "test@example.com", role: "user", isActive: true };
const admin = { ...user, role: "admin" };

async function mockAuth(page: Page, account: typeof user | typeof admin | null) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") {
      await route.fulfill(account
        ? { status: 200, contentType: "application/json", body: JSON.stringify({ user: account }) }
        : { status: 401, contentType: "application/json", body: JSON.stringify({ error: "Unauthorized" }) });
      return;
    }
    if (path === "/api/auth/refresh") {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Unauthorized" }) });
      return;
    }
    if (path === "/api/saved-searches") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
      return;
    }
    if (path === "/api/auth/logout") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    if (path === "/api/predict/options") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ categorical: { location: ["Whitefield"], area_type: ["Super built-up Area"], availability_status: ["Ready To Move"] } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("public mobile navigation opens, closes with Escape, and supports same-route activation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockAuth(page, null);
  await page.goto("/predict", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  const trigger = page.getByRole("button", { name: /navigation menu/ });
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expectNoHorizontalOverflow(page);

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(mobileNav.getByRole("link", { name: "Predict" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Listings" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await mobileNav.getByRole("link", { name: "Predict" }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/\/predict$/);
});

test("mobile navigation exposes authenticated user actions", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await mockAuth(page, user);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("link", { name: "Test" })).toBeVisible();
  const trigger = page.getByRole("button", { name: /navigation menu/ });
  await trigger.click();
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobileNav.getByRole("link", { name: "Favorites" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Saved" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Alerts" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Test" })).toBeVisible();
  await expect(mobileNav.getByRole("button", { name: "Logout" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Admin panel" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("admin navigation is role-gated in the mobile menu", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 720 });
  await mockAuth(page, admin);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Admin control panel" })).toBeVisible();
  const trigger = page.getByRole("button", { name: /navigation menu/ });
  await trigger.click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Admin panel" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("desktop navigation remains visible and the mobile trigger is hidden", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockAuth(page, null);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "Listings" }) }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /navigation menu/ })).toBeHidden();
});

for (const width of [320, 375, 412]) {
  test(`mobile header has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await mockAuth(page, null);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expectNoHorizontalOverflow(page);
  });
}

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

type Account = typeof user | typeof admin;

function json(value: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(value) };
}

async function mockAuthContract(page: Page, account: Account | null) {
  // Fail closed for API requests that are not explicitly part of a test contract.
  await page.route("**/api/**", (route) => route.abort());

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill(account ? json({ user: account }) : json({ error: "Unauthorized" }, 401));
  });
  await page.route("**/api/auth/csrf", async (route) => {
    await route.fulfill(json({ csrfToken: "a".repeat(43) }));
  });
  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill(json({ error: "Unauthorized" }, 401));
  });
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill(json({ user: account || user }));
  });
  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill(json({ success: true }));
  });
  await page.route("**/api/predict/history", async (route) => {
    await route.fulfill(json({ items: [] }));
  });
  await page.route("**/api/saved-searches", async (route) => {
    await route.fulfill(json({ items: [] }));
  });
}

async function openLogin(page: Page) {
  const meResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/me");
  const refreshResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/refresh");
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await meResponse;
  await refreshResponse;
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
}

test("login success establishes authenticated UI and navigates to the dashboard", async ({ page }) => {
  await mockAuthContract(page, null);
  await openLogin(page);

  await page.getByLabel("Email").fill("test@example.com");
  await page.getByRole("textbox", { name: "Password" }).fill("valid-password");
  const loginResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/login");
  await page.getByRole("button", { name: "Log in" }).click();
  expect((await loginResponse).status()).toBe(200);

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Hi, Test" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Test", exact: true })).toBeVisible();
});

test("login validation failure stays on the form without an API login request", async ({ page }) => {
  await mockAuthContract(page, null);
  let loginRequests = 0;
  await page.route("**/api/auth/login", async (route) => {
    loginRequests += 1;
    await route.fulfill(json({ user }));
  });
  await openLogin(page);

  await page.getByLabel("Email").fill("test@example.com");
  await page.getByRole("textbox", { name: "Password" }).fill("");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText("Password required")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect(loginRequests).toBe(0);
});

test("login API failure reports the error and remains unauthenticated", async ({ page }) => {
  await mockAuthContract(page, null);
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill(json({ error: "Invalid credentials" }, 401));
  });
  await openLogin(page);

  await page.getByLabel("Email").fill("test@example.com");
  await page.getByRole("textbox", { name: "Password" }).fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText("Your session has expired. Please sign in again.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("unauthenticated access to a protected route redirects to login", async ({ page }) => {
  await mockAuthContract(page, null);
  const meResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/me");
  const refreshResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/refresh");
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await meResponse;
  await refreshResponse;

  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible({ timeout: 15_000 });
});

test("authenticated /me response renders the protected dashboard", async ({ page }) => {
  await mockAuthContract(page, user);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Hi, Test" })).toBeVisible();
  await expect(page.getByText("test@example.com")).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
});

test("logout requests the session endpoint and removes authenticated controls", async ({ page }) => {
  await mockAuthContract(page, user);
  let logoutRequests = 0;
  const logoutResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/logout");
  await page.route("**/api/auth/logout", async (route) => {
    logoutRequests += 1;
    await route.fulfill(json({ success: true }));
  });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Logout" }).click();
  await logoutResponse;

  await expect(page).not.toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Test", exact: true })).toHaveCount(0);
  expect(logoutRequests).toBe(1);
});

test("normal users do not see admin navigation", async ({ page }) => {
  await mockAuthContract(page, user);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("link", { name: "Admin panel" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("admin users see admin navigation", async ({ page }) => {
  await mockAuthContract(page, admin);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("link", { name: "Admin panel" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";
import { startStack, stopStack, type LocalStack } from "./stack";

let stack: LocalStack;

test.beforeAll(async () => {
  stack = await startStack();
});

test.afterAll(async () => {
  if (stack) await stopStack(stack);
});

const prediction = {
  predicted_price: 12_500_000,
  confidence_low: 11_000_000,
  confidence_high: 14_000_000,
  confidence_interval_pct: 95,
  price_per_sqft: 10_000,
  currency: "INR",
  model_name: "fixture-model",
  predictionId: "fixture-share-token-abcdefghijklmnopqrstuvwxyz0123456789",
};

const input = {
  location: "Whitefield",
  area_type: "Super built-up Area",
  availability_status: "Ready To Move",
  total_sqft: 1250,
  bhk: 2,
  bath: 2,
  balcony: 1,
};

const user = {
  _id: "user-1",
  name: "Test User",
  email: "test@example.com",
  role: "user",
  isActive: true,
};

const historyItem = {
  _id: "prediction-1",
  locality: "Whitefield",
  predictedPrice: 12_500_000,
  confidenceLow: 11_000_000,
  confidenceHigh: 14_000_000,
  pricePerSqft: 10_000,
  createdAt: "2026-01-15T10:00:00.000Z",
  input,
};

function json(value: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(value) };
}

async function mockPublicShell(page: Page) {
  // Fail closed for API requests not explicitly included in the page contract.
  await page.route("**/api/**", (route) => route.abort());
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill(json({ error: "Unauthorized" }, 401));
  });
  await page.route("**/api/auth/csrf", async (route) => {
    await route.fulfill(json({ csrfToken: "a".repeat(43) }));
  });
  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill(json({ error: "Unauthorized" }, 401));
  });
  await page.route("**/api/predict/options", async (route) => {
    await route.fulfill(json({ categorical: { location: ["Whitefield"], area_type: [input.area_type], availability_status: [input.availability_status] } }));
  });
}

async function seedResult(page: Page, value: unknown = { input, result: prediction }) {
  await page.addInitScript((stored) => {
    window.sessionStorage.setItem("riq_prediction", JSON.stringify(stored));
  }, value);
}

async function mockResultDependencies(page: Page) {
  let featureRequests = 0;
  let listingRequests = 0;
  let featureSearch = "";
  let listingSearch = "";
  await page.route("**/api/predict/feature-importance**", async (route) => {
    featureRequests += 1;
    featureSearch = new URL(route.request().url()).search;
    await route.fulfill(json([{ feature: "location", importance: 0.8 }]));
  });
  await page.route("**/api/listings**", async (route) => {
    listingRequests += 1;
    const url = new URL(route.request().url());
    listingSearch = url.search;
    await route.fulfill(json({ items: [], page: 1, limit: 3, total: 0, totalPages: 0 }));
  });
  return {
    featureRequests: () => featureRequests,
    listingRequests: () => listingRequests,
    featureSearch: () => featureSearch,
    listingSearch: () => listingSearch,
  };
}

async function mockAuthenticatedDashboard(page: Page, historyHandler: (calls: number) => ReturnType<typeof json> | Promise<ReturnType<typeof json>>) {
  await page.route("**/api/**", (route) => route.abort());
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill(json({ user }));
  });
  await page.route("**/api/saved-searches", async (route) => {
    await route.fulfill(json({ items: [] }));
  });
  let calls = 0;
  await page.route("**/api/predict/history", async (route) => {
    calls += 1;
    await route.fulfill(await historyHandler(calls));
  });
  return { historyCalls: () => calls };
}

test("renders a valid stored result with explicit supplementary API contracts", async ({ page }) => {
  await mockPublicShell(page);
  const requests = await mockResultDependencies(page);
  await seedResult(page);

  await page.goto("/results", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Estimated value · fixture-model")).toBeVisible();
  await expect(page.getByText("Whitefield", { exact: true })).toBeVisible();
  await expect(page.getByText("95% confidence range")).toBeVisible();
  // Next dev mode may run the mount effect twice; every request is still explicit.
  await expect.poll(requests.featureRequests).toBeGreaterThan(0);
  await expect.poll(requests.listingRequests).toBeGreaterThan(0);
  expect(new URLSearchParams(requests.featureSearch()).get("top")).toBe("10");
  expect(new URLSearchParams(requests.listingSearch()).get("locality")).toBe("Whitefield");
  expect(new URLSearchParams(requests.listingSearch()).get("limit")).toBe("3");
});

test("preserves a valid result across a same-tab refresh", async ({ page }) => {
  await mockPublicShell(page);
  await mockResultDependencies(page);
  await seedResult(page);

  await page.goto("/results", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Estimated value · fixture-model")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByText("Estimated value · fixture-model")).toBeVisible();
  await expect(page.getByText("Whitefield", { exact: true })).toBeVisible();
});

test("redirects safely when the result is missing from sessionStorage", async ({ page }) => {
  await mockPublicShell(page);

  await page.goto("/results", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/predict$/);
  await expect(page.getByText("Estimated value · fixture-model")).toHaveCount(0);
});

test("rejects malformed stored result data and redirects to prediction", async ({ page }) => {
  await mockPublicShell(page);
  await seedResult(page, { input: { location: "Whitefield" }, result: { predicted_price: "not-a-number" } });

  await page.goto("/results", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/predict$/);
  await expect(page.getByText("Estimated value · fixture-model")).toHaveCount(0);
});

test("renders a database-backed history summary returned by the authenticated contract", async ({ page }) => {
  await mockAuthenticatedDashboard(page, async () => json({ items: [historyItem] }));

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Recent valuations" })).toBeVisible();
  await expect(page.getByText("Whitefield", { exact: true })).toBeVisible();
  await expect(page.getByText("₹1.25 Cr", { exact: true })).toBeVisible();
  await expect(page.getByText("No predictions yet.")).toHaveCount(0);
});

test("renders the empty history state", async ({ page }) => {
  await mockAuthenticatedDashboard(page, async () => json({ items: [] }));

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("No predictions yet.")).toBeVisible();
  await expect(page.getByText("Whitefield", { exact: true })).toHaveCount(0);
});

test("shows the history error and recovers after retry", async ({ page }) => {
  const requests = await mockAuthenticatedDashboard(page, async (calls) => calls === 1
    ? json({ error: "History unavailable" }, 503)
    : json({ items: [historyItem] }));

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("We couldn't load your recent activity. Please try again.")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Whitefield", { exact: true })).toBeVisible();
  // The initial dashboard effect can run twice in Next dev mode; the retry adds another call.
  expect(requests.historyCalls()).toBeGreaterThanOrEqual(2);
});

test("renders a valid public share response without authentication", async ({ page }) => {
  await mockPublicShell(page);
  await page.route("**/api/predict/fixture-share-token-abcdefghijklmnopqrstuvwxyz0123456789", async (route) => {
    await route.fulfill(json({
      input,
      predicted_price: prediction.predicted_price,
      confidence_low: prediction.confidence_low,
      confidence_high: prediction.confidence_high,
      price_per_sqft: prediction.price_per_sqft,
      model_name: prediction.model_name,
      locality: input.location,
      createdAt: "2026-01-15T10:00:00.000Z",
    }));
  });

  await page.goto("/r/fixture-share-token-abcdefghijklmnopqrstuvwxyz0123456789", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Shared valuation")).toBeVisible();
  await expect(page.getByText("Estimated value · fixture-model")).toBeVisible();
  await expect(page.getByText("Whitefield", { exact: true })).toBeVisible();
  await expect(page.getByText(/shareTokenHash|refreshToken|ML_SERVICE_TOKEN/i)).toHaveCount(0);
});

test("handles an expired-style public share failure without exposing internals", async ({ page }) => {
  await mockPublicShell(page);
  await page.route("**/api/predict/expired-share-token-abcdefghijklmnopqrstuvwxyz0123456789", async (route) => {
    await route.fulfill(json({ error: "Prediction not found" }, 404));
  });

  await page.goto("/r/expired-share-token-abcdefghijklmnopqrstuvwxyz0123456789", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("This shared valuation was not found.")).toBeVisible();
  await expect(page.getByText(/stack trace|shareTokenHash|internal|mongodb|secret/i)).toHaveCount(0);
});

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
};

async function submitPrediction(page: Page) {
  await page.route("**/api/auth/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "a".repeat(43) }),
    });
  });
  await page.route("**/api/predict/options", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        categorical: {
          location: ["Whitefield"],
          area_type: ["Super built-up Area"],
          availability_status: ["Ready To Move"],
        },
      }),
    });
  });
  await page.goto("/api/health", { waitUntil: "domcontentloaded" });
  await page.goto("/predict", { waitUntil: "domcontentloaded" });
  const locality = page.locator("select").first();
  await expect(locality).toBeEnabled();
  await page.waitForLoadState("networkidle");
  await locality.selectOption({ label: "Whitefield" });
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Get valuation" }).click();
}

test("normal prediction success stores the result and navigates", async ({ page }) => {
  let predictionCalls = 0;
  await page.route("**/api/predict", async (route) => {
    if (route.request().method() === "POST") predictionCalls += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(prediction) });
  });

  await submitPrediction(page);

  await expect(page).toHaveURL(/\/results$/, { timeout: 30_000 });
  await expect(page.getByText("Estimated value · fixture-model")).toBeVisible();
  expect(predictionCalls).toBe(1);
});

test("prediction API failure remains a prediction failure", async ({ page }) => {
  let predictionCalls = 0;
  await page.route("**/api/predict", async (route) => {
    if (route.request().method() === "POST") predictionCalls += 1;
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "Prediction backend unavailable" }),
    });
  });

  await submitPrediction(page);

  await expect(page).toHaveURL(/\/predict$/);
  await expect(page.getByText("The service is temporarily unavailable. Please try again.").first()).toBeVisible();
  await expect(page.getByText("Valuation ready")).toHaveCount(0);
  expect(predictionCalls).toBe(1);
});

test("storage failure after API success is reported as a non-fatal persistence warning", async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    const target = window as Window & { __predictionStorageWrites?: number };
    target.__predictionStorageWrites = 0;
    Storage.prototype.setItem = function (key, value) {
      if (key === "riq_prediction") {
        target.__predictionStorageWrites = (target.__predictionStorageWrites || 0) + 1;
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
  });

  let predictionCalls = 0;
  await page.route("**/api/predict", async (route) => {
    if (route.request().method() === "POST") predictionCalls += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(prediction) });
  });

  await submitPrediction(page);

  await expect(page).toHaveURL(/\/predict$/);
  await expect(page.getByText("Prediction was created successfully, but the result could not be saved in this browser session. Please avoid retrying.").first()).toBeVisible();
  await expect(page.getByText("Prediction failed")).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __predictionStorageWrites?: number }).__predictionStorageWrites)).toBe(1);
  expect(predictionCalls).toBe(1);
});

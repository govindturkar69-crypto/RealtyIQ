import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

async function call(path, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.mlServiceUrl}${path}`, { ...options, signal: controller.signal });
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) throw new ApiError(res.status === 422 ? 400 : 502, body.detail || "ML service error");
    return body;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === "AbortError") throw new ApiError(504, "ML service timeout");
    throw new ApiError(502, `ML service unreachable: ${e.message}`);
  } finally {
    clearTimeout(t);
  }
}

export const mlService = {
  predict: (payload) =>
    call("/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  featureImportance: (top = 15) => call(`/feature-importance?top=${top}`, {}, 5000),
  localities: () => call("/localities", {}, 5000),
  health: () => call("/health", {}, 3000),
};

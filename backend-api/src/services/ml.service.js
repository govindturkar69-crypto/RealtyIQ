import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { safeRequestId } from "../middleware/requestId.js";

const MAX_RETRY_AFTER_SECONDS = 300;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value) {
  return typeof value === "string" && value.length > 0;
}

function validateResponse(path, body) {
  const route = path.split("?", 1)[0];
  if (route === "/predict") {
    return isRecord(body)
      && ["predicted_price", "confidence_low", "confidence_high", "confidence_interval_pct", "price_per_sqft"].every((key) => isFiniteNumber(body[key]))
      && isString(body.currency)
      && isString(body.model_name);
  }
  if (route === "/feature-importance") {
    return Array.isArray(body) && body.every((item) => isRecord(item) && isString(item.feature) && isFiniteNumber(item.importance));
  }
  if (route === "/localities") {
    return isRecord(body)
      && isRecord(body.categorical)
      && (body.numeric === undefined || isRecord(body.numeric));
  }
  if (route === "/model-info") {
    return isRecord(body)
      && isString(body.model_name)
      && isString(body.dataset)
      && (body.trained_at === undefined || body.trained_at === null || isString(body.trained_at))
      && (body.metrics === undefined || body.metrics === null || isRecord(body.metrics))
      && ["cv_r2", "n_train", "n_test"].every((key) => body[key] === undefined || body[key] === null || isFiniteNumber(body[key]));
  }
  if (route === "/health") {
    return isRecord(body)
      && isString(body.status)
      && typeof body.model_loaded === "boolean"
      && (body.model_name === undefined || body.model_name === null || isString(body.model_name));
  }
  return isRecord(body);
}

function retryAfterSeconds(value) {
  const raw = String(value || "").trim();
  if (!/^\d+$/.test(raw)) return undefined;
  const seconds = Number(raw);
  if (!Number.isSafeInteger(seconds)) return undefined;
  return Math.min(seconds, MAX_RETRY_AFTER_SECONDS);
}

function mlError(statusCode, message, failure, details, requestId, path, upstreamStatus) {
  const error = new ApiError(statusCode, message, details);
  error.mlFailure = failure;
  logger.warn("ml_request_failed", { requestId, path, failure, upstreamStatus, status: statusCode });
  return error;
}

async function call(path, options = {}, timeoutMs = 8000, requestId) {
  const correlationId = safeRequestId(requestId);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { ...(options.headers || {}), "X-Request-Id": correlationId };
    if (env.mlServiceToken && path !== "/health") headers.Authorization = `Bearer ${env.mlServiceToken}`;
    const res = await fetch(`${env.mlServiceUrl}${path}`, { ...options, headers, signal: controller.signal, redirect: "error" });
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = retryAfterSeconds(res.headers?.get?.("retry-after"));
        throw mlError(429, "ML service rate limited", "rate_limited", retryAfter === undefined ? undefined : { retryAfter }, correlationId, path, res.status);
      }
      if (res.status === 422) throw mlError(400, "Invalid ML request", "validation", undefined, correlationId, path, res.status);
      if (res.status >= 500) throw mlError(502, "ML service error", "upstream_failure", undefined, correlationId, path, res.status);
      throw mlError(502, "ML service rejected the request", "upstream_client_error", undefined, correlationId, path, res.status);
    }
    const contentType = res.headers?.get?.("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json") || !text.trim()) {
      throw mlError(502, "ML service returned an invalid response", "malformed_response", undefined, correlationId, path, res.status);
    }
    let body;
    try { body = JSON.parse(text); } catch {
      throw mlError(502, "ML service returned an invalid response", "malformed_response", undefined, correlationId, path, res.status);
    }
    if (!validateResponse(path, body)) {
      throw mlError(502, "ML service returned an invalid response", "invalid_response_shape", undefined, correlationId, path, res.status);
    }
    return body;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === "AbortError") throw mlError(504, "ML service timeout", "timeout", undefined, correlationId, path);
    const redirect = e.cause?.code === "UND_ERR_FR_TOO_MANY_REDIRECTS" || /redirect/i.test(e.message || "");
    throw mlError(502, redirect ? "ML service redirect rejected" : "ML service unreachable", redirect ? "redirect_rejected" : "connection_failure", undefined, correlationId, path);
  } finally {
    clearTimeout(t);
  }
}

export const mlService = {
  predict: (payload, requestId) =>
    call("/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, 8000, requestId),
  featureImportance: (top = 15, requestId) => call(`/feature-importance?top=${top}`, {}, 5000, requestId),
  localities: (requestId) => call("/localities", {}, 5000, requestId),
  health: (requestId) => call("/health", {}, 3000, requestId),
  modelInfo: (requestId) => call("/model-info", {}, 3000, requestId),
};

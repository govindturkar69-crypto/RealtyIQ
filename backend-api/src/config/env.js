import dotenv from "dotenv";
dotenv.config();

const isProd = (process.env.NODE_ENV || "development") === "production";

const DEV_FALLBACKS = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/realtyiq",
  JWT_ACCESS_SECRET: "dev_access_secret_change_me",
  JWT_REFRESH_SECRET: "dev_refresh_secret_change_me",
};

const INSECURE_JWT_VALUES = new Set([
  DEV_FALLBACKS.JWT_ACCESS_SECRET,
  DEV_FALLBACKS.JWT_REFRESH_SECRET,
  "change_me_access",
  "change_me_refresh",
]);
const MIN_SECRET_LENGTH = 32;
const isInsecureSecret = (value) => INSECURE_JWT_VALUES.has(value) || /^replace_with_/i.test(value) || /change[_-]?me/i.test(value) || /^(.)\1+$/.test(value);
const configuredTrustProxy = Number(process.env.TRUST_PROXY);
const positiveInt = (raw, fallback) => Number.isInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : fallback;
const configuredCorsOrigin = (process.env.CORS_ORIGIN || "").split(",").map((origin) => origin.trim()).filter(Boolean).join(",");

function required(key, { secret = false } = {}) {
  const val = process.env[key];
  const normalized = val?.trim();
  if (normalized) {
    if (isProd && secret && (normalized.length < MIN_SECRET_LENGTH || isInsecureSecret(normalized))) {
      throw new Error(`FATAL: ${key} must be a unique random secret of at least ${MIN_SECRET_LENGTH} characters.`);
    }
    return normalized;
  }
  if (isProd) {
    throw new Error(`FATAL: required env var ${key} is not set. Refusing to start in production.`);
  }
  return DEV_FALLBACKS[key];
}

export const env = {
  port: Number(process.env.PORT || 8000),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: configuredCorsOrigin || (isProd ? "" : "*"),
  trustProxy: Number.isInteger(configuredTrustProxy) && configuredTrustProxy >= 0 ? configuredTrustProxy : 0,
  mongoUri: required("MONGODB_URI"),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", { secret: true }),
    refreshSecret: required("JWT_REFRESH_SECRET", { secret: true }),
    accessTtl: process.env.JWT_ACCESS_TTL || "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL || "7d",
  },
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8001",
  mlServiceToken: isProd ? required("ML_SERVICE_TOKEN", { secret: true }) : (process.env.ML_SERVICE_TOKEN?.trim() || ""),
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 200),
  },
  authRateLimit: {
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60 * 1000),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || 5),
  },
  savedSearchLimit: positiveInt(process.env.SAVED_SEARCH_MAX, 20),
  favoriteLimit: Math.min(positiveInt(process.env.FAVORITES_MAX, 100), 100),
  shareTokenTtlMs: positiveInt(process.env.SHARE_TOKEN_TTL_MS, 7 * 24 * 60 * 60 * 1000),
  legacyShareGraceMs: positiveInt(process.env.LEGACY_SHARE_GRACE_DAYS, 30) * 24 * 60 * 60 * 1000,
  predictionRetentionDays: positiveInt(process.env.PREDICTION_RETENTION_DAYS, 365),
  securityEventRetentionDays: positiveInt(process.env.SECURITY_EVENT_RETENTION_DAYS, 365),
  authCookieOnly: isProd || process.env.AUTH_COOKIE_ONLY === "true",
  isProd,
};

if (isProd && env.jwt.accessSecret === env.jwt.refreshSecret) {
  throw new Error("FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production.");
}

if (isProd && process.env.TRUST_PROXY && (!Number.isInteger(configuredTrustProxy) || configuredTrustProxy < 0)) {
  throw new Error("FATAL: TRUST_PROXY must be a non-negative integer in production.");
}

if (isProd && (env.corsOrigin === "" || env.corsOrigin === "*")) {
  throw new Error("FATAL: CORS_ORIGIN must be explicitly restricted in production.");
}

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
  corsOrigin: process.env.CORS_ORIGIN || (isProd ? "" : "*"),
  mongoUri: required("MONGODB_URI"),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", { secret: true }),
    refreshSecret: required("JWT_REFRESH_SECRET", { secret: true }),
    accessTtl: process.env.JWT_ACCESS_TTL || "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL || "7d",
  },
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8001",
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 200),
  },
  authRateLimit: {
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60 * 1000),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || 5),
  },
  shareTokenTtlMs: Number(process.env.SHARE_TOKEN_TTL_MS || 7 * 24 * 60 * 60 * 1000),
  legacyShareGraceMs: Number(process.env.LEGACY_SHARE_GRACE_DAYS || 30) * 24 * 60 * 60 * 1000,
  predictionRetentionDays: Number(process.env.PREDICTION_RETENTION_DAYS || 365),
  securityEventRetentionDays: Number(process.env.SECURITY_EVENT_RETENTION_DAYS || 365),
  authCookieOnly: isProd || process.env.AUTH_COOKIE_ONLY === "true",
  isProd,
};

if (isProd && env.jwt.accessSecret === env.jwt.refreshSecret) {
  throw new Error("FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production.");
}

if (isProd && (env.corsOrigin === "" || env.corsOrigin === "*")) {
  // eslint-disable-next-line no-console
  console.warn("[security] CORS_ORIGIN is not restricted in production — set it to your frontend domain.");
}

import dotenv from "dotenv";
dotenv.config();

const isProd = (process.env.NODE_ENV || "development") === "production";

const DEV_FALLBACKS = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/realtyiq",
  JWT_ACCESS_SECRET: "dev_access_secret_change_me",
  JWT_REFRESH_SECRET: "dev_refresh_secret_change_me",
};

// In production a missing critical secret is fatal — the app refuses to start.
// In development we fall back to safe local defaults for convenience.
function required(key) {
  const val = process.env[key];
  if (val && val.trim()) {
    if (isProd && val === DEV_FALLBACKS[key]) {
      throw new Error(`FATAL: ${key} is set to the insecure development default. Set a strong unique value.`);
    }
    return val;
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
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
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
  isProd,
};

if (isProd && (env.corsOrigin === "" || env.corsOrigin === "*")) {
  // eslint-disable-next-line no-console
  console.warn("[security] CORS_ORIGIN is not restricted in production — set it to your frontend domain.");
}

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { requestId } from "./middleware/requestId.js";
import { csrfProtection } from "./middleware/csrf.js";
import { logger, safePath } from "./utils/logger.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", env.trustProxy);
  app.disable("x-powered-by");

  app.use(requestId);
  app.use(helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginResourcePolicy: { policy: "same-site" },
  }));
  const allowedOrigins = env.corsOrigin.split(",").map((origin) => origin.trim()).filter(Boolean);
  app.use(cors({ origin: env.corsOrigin === "*" ? true : allowedOrigins, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(csrfProtection);
  app.use((req, res, next) => {
    const started = process.hrtime.bigint();
    const requestPath = safePath(req.path);
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const fields = { requestId: req.id, method: req.method, path: requestPath, status: res.statusCode, durationMs: Math.round(durationMs * 10) / 10 };
      const log = res.statusCode >= 500 && res.statusCode !== 503 ? logger.error : res.statusCode >= 400 ? logger.warn : logger.info;
      log("http_request_completed", fields);
    });
    next();
  });

  app.get("/health", (req, res) => res.json({ status: "ok", service: "backend-api", ts: Date.now() }));
  // Readiness reflects Mongoose driver state only; no database query or ML request is issued.
  app.get("/ready", (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready" });
  });

  app.use("/api", apiLimiter, routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

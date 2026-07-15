import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { requestId } from "./middleware/requestId.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(requestId);
  app.use(helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginResourcePolicy: { policy: "same-site" },
  }));
  app.use(cors({ origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",").filter(Boolean), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.isProd ? "combined" : "dev"));

  app.get("/health", (req, res) => res.json({ status: "ok", service: "backend-api", ts: Date.now() }));

  app.use("/api", apiLimiter, routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

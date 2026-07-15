import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

export function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let details = err.details;

  if (err.name === "ValidationError") { status = 400; message = "Validation failed"; }
  if (err.name === "CastError") { status = 400; message = "Invalid identifier"; }
  if (err.code === 11000) { status = 409; message = `Duplicate value: ${Object.keys(err.keyValue || {}).join(", ")}`; }
  if (err.name === "JsonWebTokenError") { status = 401; message = "Invalid token"; }
  if (err.name === "TokenExpiredError") { status = 401; message = "Token expired"; }

  if (status >= 500) {
    logger.error(`[${req.id}]`, err.stack || err);
    if (env.isProd) message = "Internal server error";
  }
  res.status(status).json({ error: message, ...(details ? { details } : {}), requestId: req.id });
}

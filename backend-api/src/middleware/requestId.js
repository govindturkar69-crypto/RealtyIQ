import { randomUUID } from "node:crypto";

const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function safeRequestId(candidate) {
  const value = typeof candidate === "string" ? candidate.trim() : "";
  return value.length <= MAX_REQUEST_ID_LENGTH && SAFE_REQUEST_ID.test(value) ? value : randomUUID();
}

export function requestId(req, res, next) {
  req.id = safeRequestId(req.headers["x-request-id"]);
  res.setHeader("X-Request-Id", req.id);
  next();
}

export default requestId;
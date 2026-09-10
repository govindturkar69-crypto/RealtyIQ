import { SecurityEvent } from "../models/SecurityEvent.js";
import { logger } from "./logger.js";
import mongoose from "mongoose";

const SAFE_METADATA_FIELDS = new Set([
  "action", "result", "resourceType", "resourceId", "targetUserId", "count",
  "status", "role", "isActive", "source", "lifecycle", "reasonCode",
]);
const MAX_METADATA_STRING = 256;

export function sanitizeSecurityEventMetadata(metadata = {}) {
  const safe = {};
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return safe;
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_FIELDS.has(key)) continue;
    if (typeof value === "string" && value.length <= MAX_METADATA_STRING) safe[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "boolean") safe[key] = value;
  }
  return safe;
}

function objectIdValue(value) {
  const candidate = value && typeof value === "object" ? (value._id || value.sub || value) : value;
  return candidate != null && mongoose.isValidObjectId(candidate) ? candidate : undefined;
}

export async function recordSecurityEvent(req, type, user, metadata = {}, fields = {}) {
  try {
    const normalized = {
      actorUserId: objectIdValue(fields.actorUserId),
      targetUserId: objectIdValue(fields.targetUserId),
      resourceType: fields.resourceType,
      resourceId: fields.resourceId == null ? undefined : String(fields.resourceId),
      action: fields.action,
      result: fields.result,
      reasonCode: fields.reasonCode,
    };
    await SecurityEvent.create({
      type,
      user: objectIdValue(user),
      ...Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined)),
      requestId: req?.id,
      ip: req?.ip,
      userAgent: req?.get?.("user-agent")?.slice(0, 512),
      metadata: sanitizeSecurityEventMetadata(metadata),
    });
  } catch (error) {
    logger.error("security_event_persistence_failed", { requestId: req?.id, errorType: error?.name || "Error" });
  }
}

export async function recordAdminMutationEvent(req, type, {
  resourceType, resourceId, action, metadata = {}, targetUserId, result = "success", reasonCode,
} = {}) {
  return recordSecurityEvent(req, type, req?.user, {
    ...metadata,
    action,
    result,
    resourceType,
    resourceId: resourceId == null ? undefined : String(resourceId),
  }, { actorUserId: req?.user, targetUserId, resourceType, resourceId, action, result, reasonCode });
}

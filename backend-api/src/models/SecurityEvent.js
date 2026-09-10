import mongoose from "mongoose";
import { env } from "../config/env.js";

const securityEventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resourceType: { type: String, maxlength: 40 },
    resourceId: { type: String, maxlength: 128 },
    action: { type: String, maxlength: 80 },
    result: { type: String, enum: ["success", "failure", "denied"] },
    reasonCode: { type: String, maxlength: 80 },
    requestId: { type: String, index: true },
    ip: { type: String },
    userAgent: { type: String, maxlength: 512 },
    metadata: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now, expires: env.securityEventRetentionDays * 24 * 60 * 60 },
  },
  { versionKey: false }
);

securityEventSchema.index({ createdAt: -1, _id: -1 });
securityEventSchema.index({ type: 1, createdAt: -1, _id: -1 });

export const SecurityEvent = mongoose.model("SecurityEvent", securityEventSchema);

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signAccessToken(payload) {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl });
}
export function signRefreshToken(payload) {
  return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshTtl });
}
export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}
export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { logger } from "../utils/logger.js";

const [, , email, newPassword] = process.argv;
if (!email || !newPassword) {
  logger.error("Usage: node src/scripts/set-password.js <email> <newPassword>");
  process.exit(1);
}

async function run() {
  await mongoose.connect(env.mongoUri);
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    logger.error(`User not found: ${email}`);
    process.exit(1);
  }
  await user.setPassword(newPassword);
  await user.save();
  logger.info(`Password updated for ${email}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  logger.error("Failed:", e.message);
  process.exit(1);
});

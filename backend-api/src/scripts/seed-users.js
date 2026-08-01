import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { logger } from "../utils/logger.js";

const USERS = [
  ["Demo User", "demo@realtyiq.dev", "user", "Demo@12345"],
  ["Admin", "admin@realtyiq.dev", "admin", "Admin@12345"],
];

async function run() {
  await mongoose.connect(env.mongoUri);
  for (const [name, email, role, pw] of USERS) {
    let u = await User.findOne({ email }).select("+passwordHash");
    if (!u) u = new User({ name, email, role });
    await u.setPassword(pw);
    await u.save();
    logger.info(`Ready: ${email}`);
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  logger.error("Failed:", e.message);
  process.exit(1);
});

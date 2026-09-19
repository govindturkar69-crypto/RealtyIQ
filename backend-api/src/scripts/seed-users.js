import mongoose from "mongoose";
import { User } from "../models/User.js";
import { logger } from "../utils/logger.js";
import { bootstrapAdminCredentials } from "../utils/bootstrapAdmin.js";
import { assertSafeCliTarget } from "../utils/cliDbGuard.js";
import { recordSecurityEvent } from "../utils/securityEvent.js";

async function run() {
  const admin = bootstrapAdminCredentials();
  const users = [["Admin", admin.email, "admin", admin.password]];
  const demoEmail = process.env.SEED_DEMO_EMAIL?.trim().toLowerCase();
  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (Boolean(demoPassword) !== Boolean(demoEmail)) throw new Error("SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD must be provided together");
  if (demoPassword) {
    if (demoPassword.length < 16) throw new Error("SEED_DEMO_PASSWORD must be at least 16 characters");
    users.push(["Demo User", demoEmail, "user", demoPassword]);
  }
  const mongoUri = assertSafeCliTarget({ operation: "seed-users" });
  await mongoose.connect(mongoUri);
  for (const [name, email, role, pw] of users) {
    let u = await User.findOne({ email }).select("+passwordHash +refreshTokens +refreshTokenHashes");
    if (role === "admin" && u && u.role !== "admin") {
      throw new Error(`Refusing to promote existing non-admin account ${email}`);
    }
    if (!u) u = new User({ name, email, role });
    u.role = role;
    u.isActive = true;
    u.tokenVersion = (u.tokenVersion || 0) + 1;
    u.refreshTokens = [];
    u.refreshTokenHashes = [];
    await u.setPassword(pw);
    await u.save();
    await recordSecurityEvent(null, "cli_user_seeded", u, { source: "cli", role, isActive: true }, {
      actorUserId: null, targetUserId: u._id, resourceType: "user", resourceId: u._id,
      action: "seed", result: "success",
    });
    logger.info("seed_user_ready");
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  logger.error("seed_users_failed", { errorType: e?.name || "Error" });
  process.exit(1);
});

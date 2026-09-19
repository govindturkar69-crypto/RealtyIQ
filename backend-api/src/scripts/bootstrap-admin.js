import mongoose from "mongoose";
import { User } from "../models/User.js";
import { bootstrapAdminCredentials } from "../utils/bootstrapAdmin.js";
import { assertSafeCliTarget } from "../utils/cliDbGuard.js";
import { recordSecurityEvent } from "../utils/securityEvent.js";
import { logger } from "../utils/logger.js";

async function run() {
  const { email, password } = bootstrapAdminCredentials();
  const mongoUri = assertSafeCliTarget({ operation: "admin bootstrap" });
  await mongoose.connect(mongoUri);

  try {
    let admin = await User.findOne({ email }).select("+passwordHash +refreshTokens +refreshTokenHashes");
    if (admin && admin.role !== "admin") {
      throw new Error(`Refusing to promote existing non-admin account ${email}`);
    }
    if (!admin) {
      admin = new User({ name: "Administrator", email, role: "admin" });
    }
    admin.role = "admin";
    admin.isActive = true;
    admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    admin.refreshTokens = [];
    admin.refreshTokenHashes = [];
    await admin.setPassword(password);
    await admin.save();
    await recordSecurityEvent(null, "admin_bootstrap", admin, { source: "cli" }, {
      actorUserId: null, targetUserId: admin._id, resourceType: "user", resourceId: admin._id,
      action: "bootstrap", result: "success",
    });
    logger.info("admin_bootstrap_completed");
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  logger.error("admin_bootstrap_failed", { errorType: error?.name || "Error" });
  process.exitCode = 1;
});

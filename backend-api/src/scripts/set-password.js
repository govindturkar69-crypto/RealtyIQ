import mongoose from "mongoose";
import { User } from "../models/User.js";
import { logger } from "../utils/logger.js";
import { assertSafeCliTarget } from "../utils/cliDbGuard.js";
import { recordSecurityEvent } from "../utils/securityEvent.js";

const [, , email, newPassword] = process.argv;
if (!email || !newPassword) {
  logger.error("Usage: node src/scripts/set-password.js <email> <newPassword>");
  process.exit(1);
}

async function run() {
  if (newPassword.length < 16) {
    logger.error("set_password_rejected");
    process.exit(1);
  }
  const mongoUri = assertSafeCliTarget({ operation: "set-password" });
  await mongoose.connect(mongoUri);
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    logger.error("set_password_user_not_found");
    process.exit(1);
  }
  await user.setPassword(newPassword);
  await user.save();
  await recordSecurityEvent(null, "cli_password_changed", user, { source: "cli" }, {
    actorUserId: null, targetUserId: user._id, resourceType: "user", resourceId: user._id,
    action: "password_change", result: "success",
  });
  logger.info("password_updated");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  logger.error("set_password_failed", { errorType: e?.name || "Error" });
  process.exit(1);
});

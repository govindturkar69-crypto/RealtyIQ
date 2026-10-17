import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

async function start() {
  try {
    await connectDB();
    const app = createApp();
    app.listen(env.port, () => logger.info("api_started", { port: env.port, environment: env.nodeEnv }));
  } catch (e) {
    logger.error("api_startup_failed", { errorType: e?.name || "Error" });
    process.exit(1);
  }
}
start();

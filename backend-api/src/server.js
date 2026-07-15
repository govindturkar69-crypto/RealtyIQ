import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

async function start() {
  try {
    await connectDB();
    const app = createApp();
    app.listen(env.port, () => logger.info(`backend-api listening on :${env.port} (${env.nodeEnv})`));
  } catch (e) {
    logger.error("Fatal startup error:", e.message);
    process.exit(1);
  }
}
start();

import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export async function connectDB(uri = env.mongoUri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  logger.info("database_connected");
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

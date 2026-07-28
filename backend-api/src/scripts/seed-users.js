import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

async function run() {
  await mongoose.connect(env.mongoUri);
  const users = [
    ["Demo User", "demo@realtyiq.dev", "user", "Demo@12345"],
    ["Admin", "admin@realtyiq.dev", "admin", "Admin@12345"],
  ];
  for (const [name, email, role, pw] of users) {
    let u = await User.findOne({ email }).select("+passwordHash");
    if (!u) u = new User({ name, email, role });
    await u.setPassword(pw);
    await u.save();
    console.log("Ready:", email);
  }
  await mongoose.disconnect();
  process.exit(0);
}
run().catch((e) => { console.error(e.message); process.exit(1); });

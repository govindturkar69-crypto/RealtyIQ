import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { connectDB, disconnectDB } from "../config/db.js";
import { User } from "../models/User.js";
import { Listing } from "../models/Listing.js";
import { logger } from "../utils/logger.js";
import { bootstrapAdminCredentials } from "../utils/bootstrapAdmin.js";
import { assertSafeCliTarget } from "../utils/cliDbGuard.js";
import { geoFor } from "./geo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = process.env.SEED_CSV ||
  path.resolve(__dirname, "../../../ml-service/data/bengaluru_clean.csv");
const MAX_LISTINGS = Number(process.env.SEED_MAX || 600);

const IMAGES = [
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c",
  "https://images.unsplash.com/photo-1567496898669-ee935f5f647a",
];

function propertyTypeFor(row) {
  if ((row.area_type || "").includes("Plot")) return "Plot";
  return Number(row.bhk) >= 4 ? "Villa" : "Apartment";
}

function titleFor(row, ptype) {
  const bhk = Number(row.bhk);
  if (ptype === "Plot") return `Residential Plot in ${row.location}`;
  return `${bhk} BHK ${ptype} in ${row.location}`;
}

function descriptionFor(row, ptype, price) {
  const cr = (price / 1e7).toFixed(2);
  return `${titleFor(row, ptype)} spanning ${Math.round(row.total_sqft)} sqft` +
    `${ptype !== "Plot" ? ` with ${row.bath} bath and ${row.balcony} balcony` : ""}. ` +
    `${row.availability_status}. Listed at ₹${cr} Cr.`;
}

function spreadDate(i, total) {
  const monthsAgo = Math.floor((i / total) * 24);
  const d = new Date();
  d.setMonth(d.getMonth() - (24 - monthsAgo));
  d.setDate(1 + (i % 27));
  return d;
}

async function run() {
  const adminCredentials = bootstrapAdminCredentials();
  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  const demoEmail = process.env.SEED_DEMO_EMAIL?.trim().toLowerCase();
  if (Boolean(demoPassword) !== Boolean(demoEmail)) throw new Error("SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD must be provided together");
  if (demoPassword && demoPassword.length < 16) throw new Error("SEED_DEMO_PASSWORD must be at least 16 characters");
  if (!fs.existsSync(CSV_PATH)) throw new Error(`Seed CSV not found: ${CSV_PATH}`);
  const rows = parse(fs.readFileSync(CSV_PATH), { columns: true, skip_empty_lines: true });
  const sample = rows.slice(0, MAX_LISTINGS);

  const mongoUri = assertSafeCliTarget({ operation: "seed" });
  await connectDB(mongoUri);
  await Promise.all([User.deleteMany({}), Listing.deleteMany({})]);

  const admin = new User({ name: "Admin", email: adminCredentials.email, role: "admin" });
  await admin.setPassword(adminCredentials.password);
  await admin.save();
  let usersSeeded = 1;
  if (demoPassword) {
    const demo = new User({ name: "Demo User", email: demoEmail, role: "user" });
    await demo.setPassword(demoPassword);
    await demo.save();
    usersSeeded += 1;
  }

  const docs = sample.map((r, i) => {
    const price = Math.round(Number(r.price));
    const total_sqft = Number(r.total_sqft);
    const ptype = propertyTypeFor(r);
    return {
      title: titleFor(r, ptype),
      city: "Bengaluru",
      locality: r.location,
      propertyType: ptype,
      areaType: r.area_type,
      availabilityStatus: r.availability_status === "Ready To Move" ? "Ready To Move" : "Under Construction",
      totalSqft: total_sqft,
      bhk: Number(r.bhk),
      bath: Number(r.bath),
      balcony: Number(r.balcony || 0),
      price,
      pricePerSqft: Math.round(price / total_sqft),
      location: geoFor(r.location),
      images: [IMAGES[i % IMAGES.length]],
      description: descriptionFor(r, ptype, price),
      listedDate: spreadDate(i, sample.length),
      createdBy: admin._id,
    };
  });
  await Listing.insertMany(docs);
  logger.info("seed_completed", { listings: docs.length, users: usersSeeded });
  await disconnectDB();
}

run().catch((e) => { logger.error("seed_failed", { errorType: e?.name || "Error" }); process.exit(1); });

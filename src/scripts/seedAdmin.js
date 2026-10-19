import "dotenv/config";
import mongoose from "mongoose";
import argon2 from "argon2";
import Admin from "../models/admin.js";

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI } = process.env;

if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || !MONGODB_URI) {
  console.error("Set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD and MONGODB_URI in .env");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) {
  console.error("Password must be at least 12 characters");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);

const email = ADMIN_EMAIL.toLowerCase();
const exists = await Admin.findOne({ email });

if (exists) {
  console.log("Admin already exists, nothing changed");
} else {
  const passwordHash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });
  await Admin.create({ name: ADMIN_NAME, email, passwordHash });
  console.log("Admin created:", email);
}

await mongoose.disconnect();
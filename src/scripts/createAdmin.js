import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "../models/Admin.js";

const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node src/scripts/createAdmin.js <email> <password> [name]');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI);

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await Admin.findOne({ email: email.toLowerCase().trim() });

  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log("✅ Existing admin password updated:", email);
  } else {
    await Admin.create({ email, passwordHash, name: name || "Team Oreo Admin" });
    console.log("✅ Admin created:", email);
  }

  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error("❌ Failed:", err.message);
  process.exit(1);
}
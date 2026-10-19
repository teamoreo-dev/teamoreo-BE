
import "dotenv/config";
import mongoose from "mongoose";
import argon2 from "argon2";
import Admin from "../models/admin.js";

const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error(
    "Usage: node src/scripts/createAdmin.js <email> <password> [name]"
  );
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI);

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await Admin.findOne({ email: normalizedEmail });

  if (existing) {
    existing.passwordHash = passwordHash;

    if (name) {
      existing.name = name;
    }

    await existing.save();
    console.log("Admin password updated:", normalizedEmail);
  } else {
    await Admin.create({
      email: normalizedEmail,
      passwordHash,
      name: name || "Team Oreo Admin",
    });

    console.log("Admin created:", normalizedEmail);
  }
} catch (err) {
  console.error("Failed to create admin:", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}

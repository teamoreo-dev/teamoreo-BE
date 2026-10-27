import mongoose from "mongoose";
import argon2 from "argon2";
import { body, validationResult } from "express-validator";
import Admin from "../models/admin.js";

export async function validateAdminInput({ email, password, name }) {
  const req = { body: { email, password, name } };
  await Promise.all([
    body("email").isString().bail().trim().isEmail().isLength({ max: 254 }).run(req),
    body("password").isString().bail().isLength({ min: 12, max: 200 }).run(req),
    body("name").isString().bail().trim().isLength({ min: 1, max: 100 }).run(req),
  ]);
  if (!validationResult(req).isEmpty()) throw new Error("Provide a valid email, a 12-200 character password and a 1-100 character name");
}

export async function provisionAdmin({ email, password, name, reset = false, updateName = true }) {
  await validateAdminInput({ email, password, name });
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await Admin.init();
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await Admin.findOne({ email: normalizedEmail });
    if (existing && !reset) {
      console.log("Admin already exists, nothing changed");
      return;
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    if (existing) {
      existing.passwordHash = passwordHash;
      if (updateName) existing.name = name.trim();
      await existing.save();
      console.log("Admin password updated");
    } else {
      await Admin.create({ email: normalizedEmail, name: name.trim(), passwordHash });
      console.log("Admin created");
    }
  } finally {
    await mongoose.disconnect();
  }
}

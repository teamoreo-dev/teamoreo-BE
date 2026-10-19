import argon2 from "argon2";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import Admin from "../models/admin.js";

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Check the submitted fields" },
      });
    }

    const { email, password } = parsed.data;
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select("+passwordHash");
    let valid = false;
    let legacyBcryptHash = false;

    if (admin) {
      if (admin.passwordHash.startsWith("$argon2")) {
        valid = await argon2.verify(admin.passwordHash, password);
      } else if (/^\$2[aby]\$/.test(admin.passwordHash)) {
        valid = await bcrypt.compare(password, admin.passwordHash);
        legacyBcryptHash = valid;
      }
    }

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
      });
    }

    if (legacyBcryptHash) {
      admin.passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      await admin.save();
    }

    const token = jwt.sign({ sub: admin._id.toString() }, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });

    res.cookie("admin_token", token, { ...cookieBase, maxAge: 2 * 60 * 60 * 1000 });
    res.json({
      success: true,
      data: { admin: { id: admin._id, name: admin.name, email: admin.email } },
      message: "Logged in",
    });
  } catch (err) {
    next(err);
  }
}

export function me(req, res) {
  const { _id, name, email } = req.admin;
  res.json({ success: true, data: { admin: { id: _id, name, email } } });
}

export function logout(_req, res) {
  res.clearCookie("admin_token", cookieBase);
  res.json({ success: true, data: null, message: "Logged out" });
}
import { verify } from "argon2";
import jwt from "jsonwebtoken";
import { z } from "zod";
import Admin from "../models/Admin.js";

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
    const valid = admin && (await verify(admin.passwordHash, password));

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
      });
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
import jwt from "jsonwebtoken";
import Admin from "../models/admin.js";

const unauthorized = (res) =>
  res.status(401).json({
    success: false,
    error: { code: "UNAUTHENTICATED", message: "Please sign in" },
  });

export default async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.admin_token;
    if (!token) return unauthorized(res);

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(payload.sub).select("-passwordHash");
    if (!admin) return unauthorized(res);

    req.admin = admin; // available to controllers as req.admin
    next();
  } catch (err) {
    console.log("AUTH ERROR:", err.message);
    return unauthorized(res);
  }
}
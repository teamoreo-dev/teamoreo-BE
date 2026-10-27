import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Admin from "../models/admin.js";

const unauthorized = (res) => res.status(401).json({
  success: false, error: { code: "UNAUTHENTICATED", message: "Please sign in" },
});

export default async function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) return unauthorized(res);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch (err) {
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(err.name)) return unauthorized(res);
    return next(err);
  }
  if (typeof payload.sub !== "string" || !mongoose.isObjectIdOrHexString(payload.sub)) return unauthorized(res);
  try {
    const admin = await Admin.findById(payload.sub).select("-passwordHash");
    if (!admin) return unauthorized(res);
    req.admin = admin;
    next();
  } catch (err) { next(err); }
}

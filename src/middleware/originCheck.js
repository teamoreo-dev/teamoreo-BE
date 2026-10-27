import { allowedOrigins } from "../config/runtime.js";

export default function originCheck(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if ((origin && !allowedOrigins().includes(origin)) || (!origin && req.get("sec-fetch-site") === "cross-site")) {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN_ORIGIN", message: "Request not allowed" } });
  }
  // CLI/server clients without Origin are intentional; browser writes must be JSON or multipart.
  next();
}

export default function originCheck(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const origin = req.get("origin");
  if (origin && origin !== process.env.CLIENT_ORIGIN) {
    return res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN_ORIGIN", message: "Request not allowed" },
    });
  }
  next();
};
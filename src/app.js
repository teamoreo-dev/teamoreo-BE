import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"; // ← this was missing
import originCheck from "./middleware/originCheck.js";
import authRoutes from "./routes/authRoutes.js";
import blogPublicRoutes from "./routes/blogPublicRoutes.js";
import blogAdminRoutes from "./routes/blogAdminRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import contactPublicRoutes from "./routes/contactPublicRoutes.js";
import contactAdminRoutes from "./routes/contactAdminRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import helmet from "helmet";
const app = express();

// Middleware (order matters: cookies must be parsed before routes run)
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(originCheck);
app.use(helmet());


// Routes
app.use("/api/admin/auth", authRoutes);
app.use("/api/blogs", blogPublicRoutes);
app.use("/api/admin/blogs", blogAdminRoutes);
app.use("/api/admin", uploadRoutes); // → POST /api/admin/uploads
app.use("/api/contact", contactPublicRoutes);
app.use("/api/admin/contacts", contactAdminRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);



// Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({ success: true, message: "TeamOreo API is running" });
});

// 404
app.use((_req, res) =>
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } })
);

// Centralized error handler (must be LAST — catches malformed JSON too)
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "Request body must be valid JSON" },
    });
  }
  const status = err.status || 500;
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({
    success: false,
    error: { code: err.code || "INTERNAL_ERROR", message: status >= 500 ? "Internal server error" : err.message },
  });
});

export default app;
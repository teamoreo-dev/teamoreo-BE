import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import originCheck from "./middleware/originCheck.js";
import authRoutes from "./routes/authRoutes.js";
import blogPublicRoutes from "./routes/blogPublicRoutes.js";
import blogAdminRoutes from "./routes/blogAdminRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import contactPublicRoutes from "./routes/contactPublicRoutes.js";
import contactAdminRoutes from "./routes/contactAdminRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import helmet from "helmet";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { allowedOrigins } from "./config/runtime.js";
const app = express();
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY));
app.use(helmet());

// Middleware (order matters: cookies must be parsed before routes run)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins().includes(origin)) return callback(null, true);
    const error = new Error("Request origin is not allowed");
    error.status = 403;
    error.code = "FORBIDDEN_ORIGIN";
    return callback(error);
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(originCheck);
// Routes
app.use("/api/admin/auth", authRoutes);
app.use("/api/blogs", blogPublicRoutes);
app.use("/api/admin/blogs", blogAdminRoutes);
app.use("/api/admin", uploadRoutes);
app.use("/api/contact", contactPublicRoutes);
app.use("/api/admin/contacts", contactAdminRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({ success: true, message: "TeamOreo API is running" });
});

// 404
app.use(notFound);

// Centralized error handler (must be LAST — catches malformed JSON too)
app.use(errorHandler);

export default app;

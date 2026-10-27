import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import connectDB from "./config/db.js";
import Blog from "./models/blog.js";
import Admin from "./models/admin.js";
import Contact from "./models/contact.js";
import { validateEnvironment } from "./config/runtime.js";

try {
  validateEnvironment();
} catch (err) {
  console.error("Configuration error:", err.message);
  process.exit(1);
}

try {
  await connectDB();
  // Wait for integrity indexes before accepting writes; never drop existing indexes.
  await Promise.all([Admin.init(), Blog.init(), Contact.init()]);
  const port = Number(process.env.PORT || 5000);
  const server = app.listen(port, () => console.log(`API running on ${port}`));
  server.on("error", () => {
    console.error("HTTP server failed to listen");
    mongoose.disconnect().finally(() => { process.exitCode = 1; });
  });
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => {
      const deadline = setTimeout(() => process.exit(1), 10000).unref();
      server.close(() => mongoose.disconnect().finally(() => { clearTimeout(deadline); }));
    });
  }
} catch {
  console.error("Database startup failed; check connectivity, credentials and indexes");
  await mongoose.disconnect();
  process.exitCode = 1;
}

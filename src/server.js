import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";

const required = ["MONGODB_URI", "JWT_SECRET", "CLIENT_ORIGIN"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing env variable: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`API running on ${PORT}`)))
  .catch((err) => {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  });
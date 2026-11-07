import dns from "node:dns";
import mongoose from "mongoose";

const DATABASE_TIMEOUT_MS = 10000;

export default async function connectDB() {
  try {
    const dnsServers = (process.env.MONGODB_DNS_SERVERS || "")
      .split(",")
      .map((server) => server.trim())
      .filter(Boolean);
    if (dnsServers.length) dns.setServers(dnsServers);

    await mongoose.connect(process.env.MONGODB_URI, {
      // Bound both initial server selection and the underlying connection attempt.
      // Without connectTimeoutMS, DNS/TCP failures can outlive the normal selection
      // timeout and make a development restart look like a hung process.
      serverSelectionTimeoutMS: DATABASE_TIMEOUT_MS,
      connectTimeoutMS: DATABASE_TIMEOUT_MS,
    });
  } catch (error) {
    const startupError = new Error(`MongoDB connection failed: ${error.message}`, { cause: error });
    startupError.code = "DATABASE_CONNECTION_ERROR";
    throw startupError;
  }
  console.log("MongoDB connected successfully");
}

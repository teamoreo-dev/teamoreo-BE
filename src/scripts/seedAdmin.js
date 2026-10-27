import "dotenv/config";
import { provisionAdmin } from "../services/provisionAdmin.js";

try {
  await provisionAdmin({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_NAME });
} catch {
  console.error("Admin provisioning failed; set ADMIN_NAME, valid ADMIN_EMAIL, ADMIN_PASSWORD (12-200 characters), and MONGODB_URI");
  process.exitCode = 1;
}

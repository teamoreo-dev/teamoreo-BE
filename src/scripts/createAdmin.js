import "dotenv/config";
import { provisionAdmin } from "../services/provisionAdmin.js";

const [email, password, name] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node src/scripts/createAdmin.js <email> <password> [name]");
  process.exitCode = 1;
} else {
  try {
    await provisionAdmin({ email, password, name: name || "Team Oreo Admin", reset: true, updateName: Boolean(name) });
  } catch {
    console.error("Admin provisioning failed; check input, MongoDB configuration and connectivity");
    process.exitCode = 1;
  }
}

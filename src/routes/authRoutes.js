import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, me, logout } from "../controllers/authController.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many attempts, try again later" },
  },
});

router.post("/login", loginLimiter, login);
router.get("/me", requireAdmin, me);
router.post("/logout", requireAdmin, logout);

export default router;
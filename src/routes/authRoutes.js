import { Router } from "express";
import { body } from "express-validator";
import { login, me, logout } from "../controllers/authController.js";
import requireAdmin from "../middleware/requireAdmin.js";
import { loginLimiter } from "../middleware/rateLimiters.js";
import { objectBody } from "../middleware/requestValidation.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.post(
  "/login",
  loginLimiter,
  objectBody(["email", "password"]),
  body("email").isString().bail().trim().toLowerCase().isEmail().isLength({ max: 254 }),
  body("password").isString().isLength({ min: 1, max: 200 }),
  validate,
  login
);
router.get("/me", requireAdmin, me);
router.post("/logout", requireAdmin, logout);

export default router;

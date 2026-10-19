import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate.js";
import { contactLimiter } from "../middleware/rateLimiters.js";
import { submit } from "../controllers/contactController.js";

const router = Router();

const honeypot = (req, res, next) =>
  req.body?.website
    ? res.status(201).json({ success: true, data: null, message: "Thanks, we received your message" })
    : next();

router.post(
  "/",
  contactLimiter,
  honeypot,
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"),
  body("email").trim().toLowerCase().isEmail().withMessage("Enter a valid email")
    .isLength({ max: 254 }).withMessage("Email is too long"),
  body("companyName").optional({ values: "falsy" }).trim().isLength({ max: 150 }),
  body("phone").optional({ values: "falsy" }).trim()
    .matches(/^[+\d\s()-]{5,30}$/).withMessage("Enter a valid phone number"),
  body("subject").optional({ values: "falsy" }).trim().isLength({ max: 150 }),
  body("message").trim().isLength({ min: 10, max: 5000 }).withMessage("Message must be 10-5000 characters"),
  validate,
  submit
);

export default router;
import { validationResult } from "express-validator";

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fields = {};
    errors.array().forEach((e) => { fields[e.path] = e.msg; });
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the submitted fields", fields },
    });
  }
  next();
}
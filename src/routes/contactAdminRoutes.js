import { Router } from "express";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validate.js";
import requireAdmin from "../middleware/requireAdmin.js";
import * as ctrl from "../controllers/contactController.js";

const router = Router();

router.use(requireAdmin);

const STATUSES = ["new", "read", "resolved"];

router.get(
  "/",
  query("status").optional().isIn(STATUSES).withMessage("Invalid status"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
  validate,
  ctrl.listAdmin
);

router.get("/:id", param("id").isMongoId().withMessage("Invalid id"), validate, ctrl.getAdmin);

router.patch(
  "/:id",
  param("id").isMongoId().withMessage("Invalid id"),
  body("status").isIn(STATUSES).withMessage("status must be new, read or resolved"),
  validate,
  ctrl.updateStatus
);

router.delete("/:id", param("id").isMongoId().withMessage("Invalid id"), validate, ctrl.remove);

export default router;
import { Router } from "express";
import { body, param } from "express-validator";
import { listQuery, objectBody } from "../middleware/requestValidation.js";
import { validate } from "../middleware/validate.js";
import requireAdmin from "../middleware/requireAdmin.js";
import * as ctrl from "../controllers/contactController.js";

const router = Router();

router.use(requireAdmin);

const STATUSES = ["new", "read", "resolved"];

router.get(
  "/",
  listQuery({ status: STATUSES }),
  validate,
  ctrl.listAdmin
);

router.get("/:id", param("id").isMongoId().withMessage("Invalid id"), validate, ctrl.getAdmin);

router.patch(
  "/:id",
  param("id").isMongoId().withMessage("Invalid id"),
  objectBody(["status"]),
  body("status").isString().bail().isIn(STATUSES).withMessage("status must be new, read or resolved"),
  validate,
  ctrl.updateStatus
);

router.delete("/:id", param("id").isMongoId().withMessage("Invalid id"), validate, ctrl.remove);

export default router;

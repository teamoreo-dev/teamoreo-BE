import { Router } from "express";
import { param } from "express-validator";
import * as ctrl from "../controllers/blogController.js";
import { listQuery } from "../middleware/requestValidation.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.get("/", listQuery({ category: true }), validate, ctrl.listPublic);
router.get("/:slug", param("slug").matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).isLength({ max: 220 }), validate, ctrl.getPublicBySlug);
export default router;

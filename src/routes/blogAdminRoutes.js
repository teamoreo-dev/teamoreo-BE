import { Router } from "express";
import { param } from "express-validator";
import { validate } from "../middleware/validate.js";
import { blogBody, listQuery } from "../middleware/requestValidation.js";
import requireAdmin from "../middleware/requireAdmin.js";
import * as ctrl from "../controllers/blogController.js";

const router = Router();
router.use(requireAdmin);
const id = () => param("id").isMongoId();
router.get("/", listQuery({ category: true, status: ["draft", "published"] }), validate, ctrl.listAdmin);
router.get("/:id", id(), validate, ctrl.getAdmin);
router.post("/", blogBody(), validate, ctrl.create);
router.patch("/:id", id(), blogBody(true), validate, ctrl.update);
router.delete("/:id", id(), validate, ctrl.remove);
export default router;

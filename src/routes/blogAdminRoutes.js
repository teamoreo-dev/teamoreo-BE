import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate.js";
import requireAdmin from "../middleware/requireAdmin.js";
import * as ctrl from "../controllers/blogController.js";

const router = Router();

router.use(requireAdmin); // every admin endpoint is protected — login stays public elsewhere

router.get("/", ctrl.listAdmin);
router.get("/:id", ctrl.getAdmin);

router.post("/",
  body("title").trim().isLength({ min: 3, max: 200 }),
  body("excerpt").trim().isLength({ min: 10, max: 500 }),
  body("content").isString().isLength({ min: 10 }),
  body("category").trim().notEmpty(),
  body("author").trim().notEmpty(),
  body("featuredImage.url").isString().notEmpty(),
  body("featuredImage.alt").optional().isString(),
  body("status").optional().isIn(["draft", "published"]),
  validate, ctrl.create);

router.patch("/:id",
  body("status").optional().isIn(["draft", "published"]),
  validate, ctrl.update);

router.delete("/:id", ctrl.remove);

export default router;
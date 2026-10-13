import { Router } from "express";
import * as ctrl from "../controllers/blogController.js";

const router = Router();
router.get("/", ctrl.listPublic);
router.get("/:slug", ctrl.getPublicBySlug);

export default router;
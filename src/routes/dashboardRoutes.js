import { Router } from "express";
import requireAdmin from "../middleware/requireAdmin.js";
import { summary } from "../controllers/dashboardController.js";

const router = Router();
router.get("/summary", requireAdmin, summary);

export default router;

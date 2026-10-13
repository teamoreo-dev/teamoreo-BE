import { Router } from "express";
import requireAdmin from "../middleware/requireAdmin.js";
import { upload, uploadImage } from "../controllers/uploadController.js";

const router = Router();
router.post("/uploads", requireAdmin, upload.single("image"), uploadImage);

export default router;
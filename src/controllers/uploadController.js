import multer from "multer";
import { streamUpload } from "../services/images.js";

const invalidFile = () => Object.assign(new Error("Only valid JPEG, PNG, and WebP images are supported"), { code: "INVALID_FILE", status: 400 });
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : invalidFile(), ok);
  },
});

function validSignature({ buffer, mimetype }) {
  if (mimetype === "image/jpeg") return buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (mimetype === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
}

export async function uploadImage(req, res, next) {
  if (!req.file) return res.status(400).json({ success: false, error: {
    code: "VALIDATION_ERROR", message: 'Image file is required (form field: "image")',
  } });
  if (!validSignature(req.file)) return next(invalidFile());
  try {
    const result = await streamUpload(req.file.buffer);
    res.status(201).json({ success: true,
      data: { url: result.secure_url, publicId: result.public_id, bytes: result.bytes }, message: "Image uploaded",
    });
  } catch {
    next(Object.assign(new Error("Image upload failed"), { status: 502, code: "CLOUDINARY_ERROR" }));
  }
}

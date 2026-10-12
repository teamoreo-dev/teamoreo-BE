import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("INVALID_FILE"), ok);
  },
});

const streamUpload = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "team-oreo/blogs", resource_type: "image" },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

export async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: 'Image file is required (form field: "image")' },
      });
    }
    const result = await streamUpload(req.file.buffer);
    res.status(201).json({
      success: true,
      data: { url: result.secure_url, publicId: result.public_id, bytes: result.bytes },
      message: "Image uploaded",
    });
  } catch (err) {
    next(err);
  }
}

export { upload };
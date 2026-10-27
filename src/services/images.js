import { v2 as cloudinary } from "cloudinary";
import Blog from "../models/blog.js";

export const IMAGE_FOLDER = "team-oreo/blogs";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function managedImageId(image) {
  if (!image?.publicId || !process.env.CLOUDINARY_CLOUD_NAME) return null;
  if (!/^team-oreo\/blogs\/[a-zA-Z0-9_-]+$/.test(image.publicId)) return null;
  try {
    const url = new URL(image.url);
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.search || url.hash) return null;
    const path = decodeURIComponent(url.pathname);
    const prefix = `/${cloud}/image/upload/`;
    if (!path.startsWith(prefix)) return null;
    const asset = path.slice(prefix.length).replace(/^v\d+\//, "");
    return ["jpg", "jpeg", "png", "webp"].some((ext) => asset === `${image.publicId}.${ext}`) ? image.publicId : null;
  } catch { return null; }
}

export async function cleanupImage(image) {
  const publicId = managedImageId(image);
  if (!publicId) return;
  try {
    // Avoid deleting an image reused by another article, including URL-only legacy references.
    if (await Blog.exists({ $or: [{ "featuredImage.publicId": publicId }, { "featuredImage.url": image.url }] })) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true, timeout: 10000 });
  } catch {
    // Database writes already succeeded. Cleanup is best effort and can be retried operationally.
    console.warn("Managed image cleanup failed; remote asset retained:", publicId);
  }
}

export function streamUpload(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: IMAGE_FOLDER, resource_type: "image", allowed_formats: ["jpg", "jpeg", "png", "webp"], timeout: 30000,
    }, (err, result) => err ? reject(err) : resolve(result));
    stream.on("error", reject);
    stream.end(buffer);
  });
}

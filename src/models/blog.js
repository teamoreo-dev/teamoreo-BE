import mongoose from "mongoose";
import slugify from "slugify";

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, required: true, trim: true, maxlength: 500 },
    content: { type: String, required: true }, // sanitized HTML
    featuredImage: {
      url: { type: String, required: true },
      publicId: { type: String, default: "" },
      alt: { type: String, default: "" },
    },
    category: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    publishedAt: { type: Date, default: null },
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
  },
  { timestamps: true }
);

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1 });

// Collision handling (brief 5.1): my-post, my-post-2, ...
blogSchema.statics.uniqueSlug = async function (base) {
  const clean = slugify(base, { lower: true, strict: true });
  let slug = clean;
  let i = 2;
  while (await this.exists({ slug })) {
    slug = `${clean}-${i}`;
    i += 1;
  }
  return slug;
};

export default mongoose.model("Blog", blogSchema);
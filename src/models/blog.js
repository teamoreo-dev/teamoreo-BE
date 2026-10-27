import mongoose from "mongoose";
import slugify from "slugify";

export const normalizeSlug = (value) => slugify(value, { lower: true, strict: true }).slice(0, 200).replace(/-+$/, "");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 220, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    excerpt: { type: String, required: true, trim: true, minlength: 10, maxlength: 500 },
    content: { type: String, required: true, maxlength: 500000 },
    featuredImage: {
      url: { type: String, required: true, maxlength: 2048, match: /^https?:\/\// },
      publicId: { type: String, default: "", maxlength: 300 },
      alt: { type: String, default: "", maxlength: 300 },
    },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    author: { type: String, required: true, trim: true, maxlength: 150 },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    publishedAt: { type: Date, default: null },
    seoTitle: { type: String, trim: true, maxlength: 200 },
    seoDescription: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, optimisticConcurrency: true }
);

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1 });

// The unique index is the final guarantee; controllers retry concurrent duplicate-key writes.
blogSchema.statics.uniqueSlug = async function (base, excludeId) {
  const clean = normalizeSlug(base) || "article";
  let slug = clean;
  let suffix = 2;
  while (await this.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    slug = `${clean}-${suffix++}`;
  }
  return slug;
};

export default mongoose.model("Blog", blogSchema);

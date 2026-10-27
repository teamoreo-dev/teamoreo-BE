import sanitizeHtml from "sanitize-html";
import Blog, { normalizeSlug } from "../models/blog.js";
import { randomBytes } from "node:crypto";
import { cleanupImage } from "../services/images.js";

async function writeWithSlugRetry(blog, base, write) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await write(); }
    catch (err) {
      if (err.code !== 11000 || !(err.keyPattern?.slug || err.keyValue?.slug) || attempt >= 4) throw err;
      blog.slug = `${normalizeSlug(base) || "article"}-${randomBytes(6).toString("hex")}`;
    }
  }
}

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CONTENT_OPTIONS = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "h1", "h2"],
  allowedAttributes: { img: ["src", "alt"], a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
};

const paging = (req) => ({
  page: Math.max(1, parseInt(req.query.page) || 1),
  limit: Math.min(50, Math.max(1, parseInt(req.query.limit) || 9)),
});

// ---------- PUBLIC ----------
export async function listPublic(req, res, next) {
  try {
    const { page, limit } = paging(req);
    const filter = { status: "published" };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ title: rx }, { excerpt: rx }];
    }
    const [items, total] = await Promise.all([
      Blog.find(filter).sort({ publishedAt: -1 })
        .select("title slug excerpt featuredImage category author publishedAt seoTitle seoDescription")
        .skip((page - 1) * limit).limit(limit),
      Blog.countDocuments(filter),
    ]);
    res.json({ success: true, data: { items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (err) { next(err); }
}

export async function getPublicBySlug(req, res, next) {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, status: "published" });
    if (!blog) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Article not found" } });
    }
    res.json({ success: true, data: blog });
  } catch (err) { next(err); }
}

// ---------- ADMIN ----------
export async function listAdmin(req, res, next) {
  try {
    const { page, limit } = paging(req);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ title: rx }, { excerpt: rx }];
    }
    const [items, total] = await Promise.all([
      Blog.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
      Blog.countDocuments(filter),
    ]);
    res.json({ success: true, data: { items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (err) { next(err); }
}

export async function getAdmin(req, res, next) {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Article not found" } });
    }
    res.json({ success: true, data: blog });
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const { title, excerpt, content, category, author, featuredImage, status, seoTitle, seoDescription } = req.body;
    const blog = new Blog({
      title,
      slug: await Blog.uniqueSlug(req.body.slug || title),
      excerpt,
      content: sanitizeHtml(content, CONTENT_OPTIONS),
      category,
      author,
      featuredImage,
      status: status === "published" ? "published" : "draft",
      publishedAt: status === "published" ? new Date() : null,
      seoTitle,
      seoDescription,
    });
    await writeWithSlugRetry(blog, req.body.slug || title, () => blog.save());
    res.status(201).json({ success: true, data: blog, message: "Article created" });
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Article not found" } });
    }
    const previousImage = blog.featuredImage?.toObject?.() || { ...blog.featuredImage };
    const editable = ["title", "excerpt", "category", "author", "featuredImage", "seoTitle", "seoDescription"];
    editable.forEach((k) => { if (req.body[k] !== undefined) blog[k] = req.body[k]; });
    if (req.body.content !== undefined) blog.content = sanitizeHtml(req.body.content, CONTENT_OPTIONS);
    if (req.body.slug && normalizeSlug(req.body.slug) !== blog.slug) {
      blog.slug = await Blog.uniqueSlug(req.body.slug, blog._id);
    }
    if (req.body.status !== undefined) {
      blog.status = req.body.status;
      if (req.body.status === "published" && !blog.publishedAt) blog.publishedAt = new Date();
      if (req.body.status === "draft") blog.publishedAt = null;
    }
    await writeWithSlugRetry(blog, req.body.slug || blog.slug, () => blog.save());
    if (req.body.featuredImage !== undefined && previousImage.publicId !== blog.featuredImage.publicId) {
      await cleanupImage(previousImage);
    }
    res.json({ success: true, data: blog, message: "Article updated" });
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Article not found" } });
    }
    await cleanupImage(blog.featuredImage);
    res.json({ success: true, data: null, message: "Article deleted" });
  } catch (err) { next(err); }
}

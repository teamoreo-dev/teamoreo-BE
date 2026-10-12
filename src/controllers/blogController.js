import sanitizeHtml from "sanitize-html";
import Blog from "../models/Blog.js";

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CONTENT_OPTIONS = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "h1", "h2"],
  allowedAttributes: { img: ["src", "alt"], a: ["href", "target", "rel"] },
};

const paging = (req) => ({
  page: Math.max(1, parseInt(req.query.page) || 1),
  limit: Math.min(50, parseInt(req.query.limit) || 9),
});

// ---------- PUBLIC ----------
export async function listPublic(req, res, next) {
  try {
    const { page, limit } = paging(req);
    const filter = { status: "published" }; // drafts NEVER leak (brief 5.2)
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
    const blog = await Blog.create({
      title,
      slug: await Blog.uniqueSlug(req.body.slug || title),
      excerpt,
      content: sanitizeHtml(content, CONTENT_OPTIONS), // stored XSS defense (brief 5.1)
      category,
      author,
      featuredImage,
      status: status === "published" ? "published" : "draft",
      publishedAt: status === "published" ? new Date() : null,
      seoTitle,
      seoDescription,
    });
    res.status(201).json({ success: true, data: blog, message: "Article created" });
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Article not found" } });
    }
    const editable = ["title", "excerpt", "category", "author", "featuredImage", "seoTitle", "seoDescription"];
    editable.forEach((k) => { if (req.body[k] !== undefined) blog[k] = req.body[k]; });
    if (req.body.content !== undefined) blog.content = sanitizeHtml(req.body.content, CONTENT_OPTIONS);
    if (req.body.slug && req.body.slug !== blog.slug) {
      blog.slug = await Blog.uniqueSlug(req.body.slug);
    }
    if (req.body.status !== undefined) {
      if (!["draft", "published"].includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "status must be draft or published" },
        });
      }
      blog.status = req.body.status;
      if (req.body.status === "published" && !blog.publishedAt) blog.publishedAt = new Date();
      if (req.body.status === "draft") blog.publishedAt = null;
    }
    await blog.save();
    res.json({ success: true, data: blog, message: "Article updated" });
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id); // hard delete — note this in your README
    if (!blog) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Article not found" } });
    }
    res.json({ success: true, message: "Article deleted" });
  } catch (err) { next(err); }
}
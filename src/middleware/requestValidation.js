import { body, query } from "express-validator";
import { normalizeSlug } from "../models/blog.js";

export const blogFields = ["title", "slug", "excerpt", "content", "category", "author", "featuredImage", "status", "seoTitle", "seoDescription"];

export const objectBody = (allowed) => body().custom((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) throw new Error("A non-empty JSON object is required");
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("Unsupported fields in request");
  return true;
});

export function listQuery({ category = false, status = false } = {}) {
  const validators = [
    query("page").optional().isString().bail().matches(/^[1-9]\d*$/).bail().isInt({ min: 1, max: 1000000 }),
    query("limit").optional().isString().bail().matches(/^[1-9]\d*$/).bail().isInt({ min: 1, max: 50 }),
    query("search").optional().isString().bail().trim().isLength({ max: 200 }),
  ];
  if (category) validators.push(query("category").optional().isString().bail().trim().isLength({ max: 100 }));
  if (status) validators.push(query("status").optional().isString().bail().isIn(status));
  return validators;
}

export function blogBody(partial = false) {
  const text = (name, min, max, required = true) => {
    let chain = body(name);
    if (partial || !required) chain = chain.optional();
    return chain.isString().bail().trim().isLength({ min, max });
  };
  return [
    objectBody(blogFields),
    text("title", 3, 200), text("excerpt", 10, 500), text("content", 1, 500000),
    text("category", 1, 100), text("author", 1, 150),
    body("featuredImage").optional(partial).custom((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("featuredImage must be an object");
      if (Object.keys(value).some((key) => !["url", "publicId", "alt"].includes(key))) throw new Error("Unsupported image field");
      return true;
    }),
    // Image updates replace the complete object; require its URL when provided.
    body("featuredImage.url").if((_value, { req }) => !partial || req.body?.featuredImage !== undefined)
      .isString().bail().isLength({ max: 2048 }).isURL({ protocols: ["http", "https"], require_protocol: true }),
    text("featuredImage.alt", 0, 300, false), text("featuredImage.publicId", 0, 300, false),
    body("status").optional().isString().bail().isIn(["draft", "published"]),
    text("slug", 1, 220, false).bail().custom((value) => Boolean(normalizeSlug(value))).withMessage("Slug must contain URL-safe letters or numbers"),
    text("seoTitle", 0, 200, false), text("seoDescription", 0, 500, false),
  ];
}

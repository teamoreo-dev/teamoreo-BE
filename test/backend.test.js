import test from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Writable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import Admin from "../src/models/admin.js";
import Blog from "../src/models/blog.js";
import Contact from "../src/models/contact.js";
import { memoryModel } from "./helpers.js";
import { provisionAdmin, validateAdminInput } from "../src/services/provisionAdmin.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-session-secret-with-at-least-32-characters";
process.env.JWT_EXPIRES_IN = "30m";
process.env.CLIENT_ORIGIN = "http://localhost:3002,https://admin.example.com";
process.env.CLOUDINARY_CLOUD_NAME = "oreo-test";
delete process.env.COOKIE_SAME_SITE;
delete process.env.TRUST_PROXY;
const { default: app } = await import("../src/app.js");
const { loginLimiter, contactLimiter } = await import("../src/middleware/rateLimiters.js");
const { validateEnvironment, sessionSeconds } = await import("../src/config/runtime.js");
const { managedImageId } = await import("../src/services/images.js");
const stores = [memoryModel(Admin), memoryModel(Blog), memoryModel(Contact)];
const [admins, blogs, contacts] = stores;
const adminId = admins.id();
const password = "SafeTestPassword123";
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
let server, baseUrl, destroyed;
const token = () => jwt.sign({ sub: adminId }, process.env.JWT_SECRET, { expiresIn: "1h", algorithm: "HS256" });
const image = (id = "asset1") => ({ publicId: `team-oreo/blogs/${id}`, url: `https://res.cloudinary.com/oreo-test/image/upload/v123/team-oreo/blogs/${id}.png`, alt: "Team photo" });
const article = (extra = {}) => ({ title: "Team Oreo News", excerpt: "News from the Team Oreo community.", content: "<p>A complete story about Team Oreo.</p>", category: "News", author: "Editor", featuredImage: image(), ...extra });
const enquiry = (extra = {}) => ({ name: "Test Visitor", email: "visitor@example.com", companyName: "Example", phone: "+234 123456789", subject: "Partnership", message: "I would like to discuss a partnership.", ...extra });

async function request(path, { method = "GET", body, auth = false, headers = {}, ...options } = {}) {
  if (auth) headers.cookie = `admin_token=${token()}`;
  if (body !== undefined && !(body instanceof FormData)) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body, ...options });
  const data = await response.json();
  return { status: response.status, body: data, headers: response.headers };
}
const createBlog = async (extra = {}) => (await request("/api/admin/blogs", { method: "POST", auth: true, body: article(extra) })).body.data;
function multipart(buffer, type = "image/png", field = "image") {
  const form = new FormData();
  form.append(field, new Blob([buffer], { type }), "test-image.png");
  return form;
}
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1kAAAAASUVORK5CYII=", "base64");

test.before(async () => {
  cloudinary.uploader.destroy = async (id) => { destroyed.push(id); return { result: "ok" }; };
  cloudinary.uploader.upload_stream = (options, callback) => new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) {
    callback(null, { secure_url: image().url, public_id: image().publicId, bytes: png.length }); done();
  } });
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async () => {
  for (const store of stores) store.reset();
  destroyed = [];
  loginLimiter.resetKey("127.0.0.1");
  contactLimiter.resetKey("127.0.0.1");
  process.env.JWT_EXPIRES_IN = "30m";
  process.env.NODE_ENV = "test";
  delete process.env.COOKIE_SAME_SITE;
  await Admin.create({ _id: adminId, name: "Test Admin", email: "admin@example.com", passwordHash });
});
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const store of stores) store.restore();
});

test("all admin endpoints reject missing sessions", async () => {
  for (const [method, path] of [["GET", "/auth/me"], ["POST", "/auth/logout"], ["GET", "/blogs"], ["POST", "/blogs"], ["GET", `/blogs/${blogs.id()}`], ["PATCH", `/blogs/${blogs.id()}`], ["DELETE", `/blogs/${blogs.id()}`], ["POST", "/uploads"], ["GET", "/contacts"], ["GET", `/contacts/${contacts.id()}`], ["PATCH", `/contacts/${contacts.id()}`], ["DELETE", `/contacts/${contacts.id()}`], ["GET", "/dashboard/summary"]]) {
    const result = await request(`/api/admin${path}`, { method });
    assert.equal(result.status, 401, path);
    assert.equal(result.body.error.code, "UNAUTHENTICATED");
  }
});
test("login sets an HttpOnly cookie whose age matches the actual JWT", async () => {
  const result = await request("/api/admin/auth/login", { method: "POST", body: { email: " ADMIN@EXAMPLE.COM ", password } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.admin, { id: adminId, name: "Test Admin", email: "admin@example.com" });
  const cookie = result.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Max-Age=1800/);
  assert.doesNotMatch(cookie, /; Secure/);
  const payload = jwt.verify(cookie.match(/admin_token=([^;]+)/)[1], process.env.JWT_SECRET);
  assert.equal(payload.exp - payload.iat, 1800);
  const me = await request("/api/admin/auth/me", { headers: { cookie: cookie.split(";")[0] } });
  assert.deepEqual(me.body.data, result.body.data);
  assert.equal(JSON.stringify(me.body).includes("passwordHash"), false);
});
test("production cross-site cookie is Secure and SameSite=None", async () => {
  process.env.NODE_ENV = "production";
  process.env.COOKIE_SAME_SITE = "none";
  const result = await request("/api/admin/auth/login", { method: "POST", body: { email: "admin@example.com", password } });
  assert.match(result.headers.get("set-cookie"), /; Secure/);
  assert.match(result.headers.get("set-cookie"), /SameSite=None/);
});
test("numeric JWT lifetime is seconds for both token and cookie", async () => {
  process.env.JWT_EXPIRES_IN = "120";
  const result = await request("/api/admin/auth/login", { method: "POST", body: { email: "admin@example.com", password } });
  assert.match(result.headers.get("set-cookie"), /Max-Age=120/);
  const payload = jwt.decode(result.headers.get("set-cookie").match(/admin_token=([^;]+)/)[1]);
  assert.equal(payload.exp - payload.iat, 120);
});
test("wrong password and missing admin have the same generic error", async () => {
  const results = [];
  for (const email of ["admin@example.com", "missing@example.com"]) results.push(await request("/api/admin/auth/login", { method: "POST", body: { email, password: "wrong" } }));
  assert.equal(results[0].status, 401); assert.equal(results[1].status, 401);
  assert.deepEqual(results[0].body, results[1].body);
});
test("legacy bcrypt authenticates and migrates to Argon2id", async () => {
  admins.records.get(adminId).passwordHash = await bcrypt.hash(password, 4);
  const result = await request("/api/admin/auth/login", { method: "POST", body: { email: "admin@example.com", password } });
  assert.equal(result.status, 200);
  const stored = admins.records.get(adminId).passwordHash;
  assert.match(stored, /^\$argon2id\$/); assert.equal(await argon2.verify(stored, password), true);
});
test("invalid, expired, malformed-subject and deleted-admin sessions are rejected", async () => {
  for (const value of ["invalid", jwt.sign({ sub: adminId }, process.env.JWT_SECRET, { expiresIn: -1 }), jwt.sign({ sub: "bad-id" }, process.env.JWT_SECRET), jwt.sign({ sub: admins.id() }, process.env.JWT_SECRET)]) {
    const result = await request("/api/admin/auth/me", { headers: { cookie: `admin_token=${value}` } });
    assert.equal(result.status, 401);
  }
});
test("logout clears the cookie using the matching attributes", async () => {
  const result = await request("/api/admin/auth/logout", { method: "POST", auth: true });
  assert.equal(result.status, 200);
  assert.match(result.headers.get("set-cookie"), /admin_token=;/);
  assert.match(result.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
  assert.match(result.headers.get("set-cookie"), /Path=\//);
  assert.match(result.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
});
test("login limits the eleventh attempt", async () => {
  for (let i = 0; i < 10; i++) assert.equal((await request("/api/admin/auth/login", { method: "POST", body: {} })).status, 400);
  const result = await request("/api/admin/auth/login", { method: "POST", body: {} });
  assert.equal(result.status, 429); assert.equal(result.body.error.code, "RATE_LIMITED");
});
test("login rejects non-string values without coercing them", async () => {
  const result = await request("/api/admin/auth/login", { method: "POST", body: { email: ["admin@example.com"], password: 123 } });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.fields.email); assert.ok(result.body.error.fields.password);
});

test("blog draft, publish, edit, unpublish, republish and delete lifecycle", async () => {
  const blog = await createBlog();
  assert.ok(blog?._id); assert.equal(blog.status, "draft"); assert.equal(blog.publishedAt, null);
  assert.equal((await request(`/api/blogs/${blog.slug}`)).status, 404);
  assert.equal((await request("/api/blogs")).body.data.total, 0);
  const published = await request(`/api/admin/blogs/${blog._id}`, { method: "PATCH", auth: true, body: { status: "published" } });
  assert.equal(published.status, 200); assert.ok(published.body.data.publishedAt);
  assert.equal((await request(`/api/blogs/${blog.slug}`)).status, 200);
  const listed = (await request("/api/blogs")).body.data;
  assert.equal(listed.total, 1); assert.equal(listed.items[0].content, undefined);
  const edit = await request(`/api/admin/blogs/${blog._id}`, { method: "PATCH", auth: true, body: { title: "Updated title", seoTitle: "SEO title", seoDescription: "SEO description" } });
  assert.equal(edit.body.data.slug, blog.slug); assert.equal(edit.body.data.title, "Updated title");
  assert.equal(edit.body.data.publishedAt, published.body.data.publishedAt);
  const draft = await request(`/api/admin/blogs/${blog._id}`, { method: "PATCH", auth: true, body: { status: "draft" } });
  assert.equal(draft.body.data.publishedAt, null);
  assert.equal((await request(`/api/blogs/${blog.slug}`)).status, 404);
  await request(`/api/admin/blogs/${blog._id}`, { method: "PATCH", auth: true, body: { status: "published" } });
  const deleted = await request(`/api/admin/blogs/${blog._id}`, { method: "DELETE", auth: true });
  assert.equal(deleted.status, 200); assert.equal(blogs.records.size, 0);
  assert.deepEqual(destroyed, [image().publicId]);
});
test("published create and authenticated blog list/detail work", async () => {
  const blog = await createBlog({ status: "published" });
  await createBlog({ title: "Draft article" });
  const list = await request("/api/admin/blogs?status=published&category=News&search=oreo", { auth: true });
  assert.equal(list.status, 200); assert.equal(list.body.data.total, 1);
  assert.equal((await request(`/api/admin/blogs/${blog._id}`, { auth: true })).body.data.content, article().content);
});
test("blog search escapes regular expressions, category and paging filter correctly", async () => {
  await createBlog({ title: "Exact (match)", category: "Events", status: "published" });
  await createBlog({ title: "Another article", status: "published" });
  assert.equal((await request("/api/blogs?search=%28match%29&category=Events")).body.data.total, 1);
  assert.equal((await request("/api/blogs?search=.*")).body.data.total, 0);
  const list = (await request("/api/blogs?page=2&limit=1")).body.data;
  assert.equal(list.items.length, 1); assert.equal(list.totalPages, 2);
});
test("malformed list queries are rejected for blog and contact endpoints", async () => {
  for (const path of ["/api/blogs", "/api/admin/blogs", "/api/admin/contacts"]) {
    for (const query of ["page=0", "page=-1", "page=1.2", "page=1e2", "page=9007199254740992", "limit=51", "limit=0", "page=1&page=2", "search=a&search=b"]) {
      const result = await request(`${path}?${query}`, { auth: true });
      assert.equal(result.status, 400, `${path}?${query}`);
    }
  }
  assert.equal((await request("/api/blogs?category=News&category=Events")).status, 400);
  assert.equal((await request("/api/admin/blogs?status=bad", { auth: true })).status, 400);
});
test("invalid and missing resource identifiers have distinct client responses", async () => {
  for (const resource of ["blogs", "contacts"]) {
    for (const method of ["GET", "PATCH", "DELETE"]) {
      assert.equal((await request(`/api/admin/${resource}/invalid`, { method, auth: true, ...(method === "PATCH" ? { body: { status: resource === "blogs" ? "draft" : "read" } } : {}) })).status, 400);
      assert.equal((await request(`/api/admin/${resource}/${blogs.id()}`, { method, auth: true, ...(method === "PATCH" ? { body: { status: resource === "blogs" ? "draft" : "read" } } : {}) })).status, 404);
    }
  }
});
test("blog validation rejects empty, unknown, null, malformed and oversize fields", async () => {
  const blog = await createBlog();
  for (const body of [{}, { unsupported: "value" }, { title: null }, { title: 123 }, { category: ["News"] }, { featuredImage: null }, { featuredImage: { alt: "missing URL" } }, { featuredImage: { url: "javascript:alert(1)" } }, { slug: "!!!" }, { seoTitle: "x".repeat(201) }, { status: "archived" }, { content: "<script>only unsafe content</script>" }, []]) {
    assert.equal((await request(`/api/admin/blogs/${blog._id}`, { method: "PATCH", auth: true, body })).status, 400, JSON.stringify(body));
  }
  assert.equal((await request("/api/admin/blogs", { method: "POST", auth: true, body: article({ featuredImage: { url: "invalid" } }) })).status, 400);
  assert.equal((await request("/api/admin/blogs", { method: "POST", auth: true, body: article({ title: "ab" }) })).status, 400);
});
test("stored HTML strips scripts, unsafe protocols and event handlers on create and edit", async () => {
  const content = '<h1>Title</h1><script>alert(1)</script><img src="https://example.com/a.png" onerror="alert(1)"><a href="javascript:alert(1)">link</a>';
  const blog = await createBlog({ content });
  assert.match(blog.content, /<h1>Title<\/h1>/);
  assert.doesNotMatch(blog.content, /script|onerror|javascript:/);
  const updated = await request(`/api/admin/blogs/${blog._id}`, { method: "PATCH", auth: true, body: { content } });
  assert.doesNotMatch(updated.body.data.content, /script|onerror|javascript:/);
});
test("slug collisions suffix; effective slug and title edits preserve the existing slug", async () => {
  const first = await createBlog(); const second = await createBlog();
  assert.equal(first.slug, "team-oreo-news"); assert.equal(second.slug, "team-oreo-news-2");
  const same = await request(`/api/admin/blogs/${first._id}`, { method: "PATCH", auth: true, body: { slug: "Team Oreo News!" } });
  assert.equal(same.body.data.slug, first.slug);
  const collision = await request(`/api/admin/blogs/${second._id}`, { method: "PATCH", auth: true, body: { slug: first.slug } });
  assert.equal(collision.body.data.slug, second.slug);
  const fallback = await createBlog({ title: "!!!" });
  assert.equal(fallback.slug, "article");
});
test("duplicate-key slug races are retried on create and update", async (t) => {
  const original = Blog.prototype.save;
  let failures = 1;
  t.mock.method(Blog.prototype, "save", async function () {
    if (failures-- > 0) throw Object.assign(new Error("race"), { code: 11000, keyPattern: { slug: 1 } });
    return original.call(this);
  });
  const blog = await createBlog();
  assert.match(blog.slug, /^team-oreo-news-[a-f0-9]{12}$/);
  failures = 1;
  const update = await request(`/api/admin/blogs/${blog._id}`, { method: "PATCH", auth: true, body: { slug: "new slug" } });
  assert.equal(update.status, 200); assert.match(update.body.data.slug, /^new-slug-[a-f0-9]{12}$/);
});
test("exhausted slug retry returns a stable conflict", async (t) => {
  t.mock.method(Blog.prototype, "save", async () => { throw Object.assign(new Error("race"), { code: 11000, keyPattern: { slug: 1 } }); });
  const result = await request("/api/admin/blogs", { method: "POST", auth: true, body: article() });
  assert.equal(result.status, 409); assert.equal(result.body.error.code, "CONFLICT");
});
test("image replacement cleans the previous managed image after persistence", async () => {
  const blog = await createBlog();
  const result = await request(`/api/admin/blogs/${blog._id}`, { method: "PATCH", auth: true, body: { featuredImage: image("replacement") } });
  assert.equal(result.status, 200); assert.deepEqual(destroyed, [image().publicId]);
  assert.equal(blogs.records.get(blog._id).featuredImage.publicId, image("replacement").publicId);
});
test("failed blog saves do not delete images", async (t) => {
  const blog = await createBlog();
  t.mock.method(Blog.prototype, "save", async () => { throw Object.assign(new Error("concurrent change"), { name: "VersionError" }); });
  const result = await request(`/api/admin/blogs/${blog._id}`, { method: "PATCH", auth: true, body: { featuredImage: image("replacement") } });
  assert.equal(result.status, 409); assert.deepEqual(destroyed, []);
  assert.equal(blogs.records.get(blog._id).featuredImage.publicId, image().publicId);
});
test("remote cleanup failures preserve successful database update and delete", async (t) => {
  t.mock.method(cloudinary.uploader, "destroy", async () => { throw new Error("secret upstream detail"); });
  const blog = await createBlog();
  assert.equal((await request(`/api/admin/blogs/${blog._id}`, { method: "PATCH", auth: true, body: { featuredImage: image("replacement") } })).status, 200);
  assert.equal((await request(`/api/admin/blogs/${blog._id}`, { method: "DELETE", auth: true })).status, 200);
  assert.equal(blogs.records.size, 0);
});
test("shared images and legacy/external/unmanaged images are retained", async () => {
  const first = await createBlog(); await createBlog();
  await request(`/api/admin/blogs/${first._id}`, { method: "DELETE", auth: true });
  assert.deepEqual(destroyed, []);
  for (const featuredImage of [{ url: image().url }, { ...image(), url: "https://example.com/image.png" }, { ...image(), publicId: "other-folder/asset" }, { ...image(), url: image().url.replace("oreo-test", "other-cloud") }]) {
    const blog = await createBlog({ featuredImage });
    assert.equal((await request(`/api/admin/blogs/${blog._id}`, { method: "DELETE", auth: true })).status, 200);
  }
  assert.deepEqual(destroyed, []);
});
test("managed image recognition requires a matching canonical account URL and public ID", () => {
  assert.equal(managedImageId(image()), image().publicId);
  for (const value of [{}, { ...image(), publicId: "team-oreo/blogs/../outside" }, { ...image(), url: `${image().url}?query=yes` }, { ...image(), url: image().url.replace("asset1.png", "different.png") }, { ...image(), url: image().url.replace("https:", "http:") }]) assert.equal(managedImageId(value), null);
});

test("contact submission persists only intended fields; admin lifecycle and dashboard counts", async () => {
  const created = await request("/api/contact", { method: "POST", body: enquiry() });
  assert.equal(created.status, 201); assert.equal(created.body.data, null);
  const contact = [...contacts.records.values()][0];
  assert.equal(contact.status, "new"); assert.equal(contact.subject, "Partnership");
  const list = await request("/api/admin/contacts?search=visitor&status=new&page=1&limit=1", { auth: true });
  assert.equal(list.body.data.total, 1); assert.equal(list.body.data.items[0].message, undefined);
  assert.equal((await request(`/api/admin/contacts/${contact._id}`, { auth: true })).body.data.message, enquiry().message);
  for (const status of ["read", "resolved", "new"]) {
    const result = await request(`/api/admin/contacts/${contact._id}`, { method: "PATCH", auth: true, body: { status } });
    assert.equal(result.status, 200); assert.equal(result.body.data.status, status);
  }
  await createBlog({ status: "published" }); await createBlog();
  const dashboard = await request("/api/admin/dashboard/summary", { auth: true });
  assert.equal(dashboard.status, 200);
  assert.deepEqual(Object.fromEntries(Object.entries(dashboard.body.data).filter(([key]) => key !== "recentEnquiries")), { totalArticles: 2, publishedArticles: 1, totalEnquiries: 1, newEnquiries: 1 });
  assert.equal(dashboard.body.data.recentEnquiries.length, 1);
  const deleted = await request(`/api/admin/contacts/${contact._id}`, { method: "DELETE", auth: true });
  assert.equal(deleted.status, 200); assert.equal(contacts.records.size, 0);
});
test("contact validation and status validation reject invalid requests", async () => {
  for (const body of [enquiry({ email: "bad" }), enquiry({ name: "x" }), enquiry({ message: "short" }), enquiry({ phone: "letters" }), enquiry({ companyName: {} }), enquiry({ message: "x".repeat(5001) }), enquiry({ status: "resolved" }), enquiry({ attachment: {} })]) assert.equal((await request("/api/contact", { method: "POST", body })).status, 400);
  assert.equal(contacts.records.size, 0);
  await Contact.create(enquiry());
  const contact = [...contacts.records.values()][0];
  for (const body of [{ status: "closed" }, {}, { status: "read", message: "override" }]) assert.equal((await request(`/api/admin/contacts/${contact._id}`, { method: "PATCH", auth: true, body })).status, 400);
  assert.equal((await request("/api/admin/contacts?status=bad", { auth: true })).status, 400);
});
test("honeypot acknowledges spam without database writes", async () => {
  const result = await request("/api/contact", { method: "POST", body: enquiry({ website: "bot.example.com" }) });
  assert.equal(result.status, 201); assert.equal(contacts.records.size, 0);
});
test("public contact rate limit rejects the sixth successful submission", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await request("/api/contact", { method: "POST", body: enquiry() })).status, 201);
  assert.equal((await request("/api/contact", { method: "POST", body: enquiry() })).status, 429);
});
test("empty dashboard has predictable zero counts and recent enquiries", async () => {
  const result = await request("/api/admin/dashboard/summary", { auth: true });
  assert.deepEqual(result.body.data, { totalArticles: 0, publishedArticles: 0, totalEnquiries: 0, newEnquiries: 0, recentEnquiries: [] });
});

test("upload reports missing files, rejected MIME, spoofed content and unexpected fields", async () => {
  assert.equal((await request("/api/admin/uploads", { method: "POST", auth: true })).status, 400);
  for (const body of [multipart("not an image", "text/plain"), multipart("not an image"), multipart(png, "image/png", "wrong-field")]) {
    const result = await request("/api/admin/uploads", { method: "POST", auth: true, body });
    assert.equal(result.status, 400); assert.equal(result.body.error.code, "INVALID_FILE");
  }
});
test("upload accepts JPEG PNG and WebP using a safe Cloudinary stream double", async () => {
  for (const [buffer, type] of [[png, "image/png"], [Buffer.from([255, 216, 255, 0]), "image/jpeg"], [Buffer.from("RIFF0000WEBP0000"), "image/webp"]]) {
    const result = await request("/api/admin/uploads", { method: "POST", auth: true, body: multipart(buffer, type) });
    assert.equal(result.status, 201); assert.equal(result.body.data.publicId, image().publicId);
    assert.equal(result.body.data.url, image().url);
  }
});
test("upload enforces the 5 MB limit", async () => {
  const result = await request("/api/admin/uploads", { method: "POST", auth: true, body: multipart(Buffer.alloc(5 * 1024 * 1024 + 1)) });
  assert.equal(result.status, 413); assert.equal(result.body.error.code, "FILE_TOO_LARGE");
});
test("Cloudinary errors use a safe stable response", async (t) => {
  t.mock.method(cloudinary.uploader, "upload_stream", (_options, callback) => new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) { callback(new Error("secret upstream detail")); done(); } }));
  const result = await request("/api/admin/uploads", { method: "POST", auth: true, body: multipart(png) });
  assert.equal(result.status, 502); assert.equal(result.body.error.code, "CLOUDINARY_ERROR");
  assert.equal(JSON.stringify(result.body).includes("secret"), false);
});

test("CORS allows configured origins, credentials and preflight", async () => {
  for (const origin of ["http://localhost:3002", "https://admin.example.com"]) {
    const result = await request("/api/health", { headers: { origin } });
    assert.equal(result.status, 200); assert.equal(result.headers.get("access-control-allow-origin"), origin);
    assert.equal(result.headers.get("access-control-allow-credentials"), "true");
  }
  const preflight = await fetch(`${baseUrl}/api/admin/blogs`, { method: "OPTIONS", headers: { origin: "http://localhost:3002", "access-control-request-method": "PATCH", "access-control-request-headers": "content-type" } });
  assert.equal(preflight.status, 204); assert.match(preflight.headers.get("access-control-allow-methods"), /PATCH/);
});
test("CORS and write origin protection reject untrusted origins", async () => {
  for (const method of ["GET", "POST"]) {
    const result = await request(method === "GET" ? "/api/health" : "/api/admin/auth/login", { method, headers: { origin: "https://evil.example.com" } });
    assert.equal(result.status, 403); assert.equal(result.body.error.code, "FORBIDDEN_ORIGIN");
  }
  assert.equal((await request("/api/admin/auth/logout", { method: "POST", auth: true, headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal((await request("/api/admin/auth/logout", { method: "POST", auth: true })).status, 200);
});
test("central errors hide unexpected database and authentication infrastructure failures", async (t) => {
  t.mock.method(Blog, "countDocuments", async () => { throw new Error("mongodb://secret:password@host"); });
  const result = await request("/api/blogs");
  assert.equal(result.status, 500); assert.deepEqual(result.body.error, { code: "INTERNAL_ERROR", message: "Internal server error" });
  t.mock.method(Admin, "findById", () => { throw new Error("db offline"); });
  assert.equal((await request("/api/admin/auth/me", { auth: true })).status, 500);
});
test("oversized JSON has a stable centralized payload error", async () => {
  const result = await request("/api/contact", { method: "POST", body: { message: "x".repeat(1024 * 1024) } });
  assert.equal(result.status, 413); assert.equal(result.body.error.code, "PAYLOAD_TOO_LARGE");
});
test("model validation errors and duplicate errors are mapped consistently", async (t) => {
  t.mock.method(Contact, "create", async () => { throw new mongoose.Error.ValidationError(new Contact()); });
  assert.equal((await request("/api/contact", { method: "POST", body: enquiry() })).body.error.code, "VALIDATION_ERROR");
  t.mock.method(Blog.prototype, "save", async () => { throw Object.assign(new Error("duplicate"), { code: 11000, keyPattern: { otherField: 1 } }); });
  assert.equal((await request("/api/admin/blogs", { method: "POST", auth: true, body: article() })).status, 409);
});
test("configuration validates secrets, origins, cookie policy and JWT duration", () => {
  const snapshot = { ...process.env };
  try {
    process.env.MONGODB_URI = "mongodb://localhost:27017/oreo_test";
    validateEnvironment();
    for (const value of ["0", "-1", "bad", "1.5h", "999999999999d"]) {
      process.env.JWT_EXPIRES_IN = value; assert.throws(sessionSeconds);
    }
    process.env.JWT_EXPIRES_IN = "2h";
    process.env.JWT_SECRET = "short"; assert.throws(validateEnvironment, /JWT_SECRET/);
    process.env.JWT_SECRET = snapshot.JWT_SECRET;
    process.env.CLIENT_ORIGIN = "*"; assert.throws(validateEnvironment, /CLIENT_ORIGIN/);
    process.env.CLIENT_ORIGIN = snapshot.CLIENT_ORIGIN;
    process.env.COOKIE_SAME_SITE = "none"; assert.throws(validateEnvironment, /Secure cookies/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in snapshot)) delete process.env[key];
    Object.assign(process.env, snapshot);
  }
});

test("admin provisioning validates email/password and creates or resets Argon2id accounts safely", async (t) => {
  const previousUri = process.env.MONGODB_URI;
  t.after(() => {
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
  });
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/oreo_test_double";
  t.mock.method(mongoose, "connect", async () => mongoose);
  t.mock.method(mongoose, "disconnect", async () => {});
  t.mock.method(Admin, "init", async () => Admin);
  t.mock.method(console, "log", () => {});
  await assert.rejects(validateAdminInput({ email: "a@b..com", password, name: "Admin" }));
  await assert.rejects(validateAdminInput({ email: "valid@example.com", password: "short", name: "Admin" }));
  await assert.rejects(validateAdminInput({ email: "valid@example.com", password, name: " " }));
  const details = { email: " CLI@EXAMPLE.COM ", password, name: " CLI Admin " };
  await provisionAdmin(details);
  let created = [...admins.records.values()].find((admin) => admin.email === "cli@example.com");
  assert.ok(created); assert.equal(created.name, "CLI Admin");
  assert.match(created.passwordHash, /^\$argon2id\$/);
  assert.equal(await argon2.verify(created.passwordHash, password), true);
  const originalHash = created.passwordHash;
  await provisionAdmin({ ...details, password: "NewTestPassword456" });
  assert.equal(admins.records.get(String(created._id)).passwordHash, originalHash);
  await provisionAdmin({ ...details, name: "Default name should not replace the account name", password: "NewTestPassword456", reset: true, updateName: false });
  created = admins.records.get(String(created._id));
  assert.equal(await argon2.verify(created.passwordHash, "NewTestPassword456"), true);
  assert.equal(created.name, "CLI Admin");
});

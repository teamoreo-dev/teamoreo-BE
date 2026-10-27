import Blog from "../models/blog.js";
import Contact from "../models/contact.js";

export async function summary(_req, res, next) {
  try {
    const [totalArticles, publishedArticles, totalEnquiries, newEnquiries, recentEnquiries] =
      await Promise.all([
        Blog.countDocuments(),
        Blog.countDocuments({ status: "published" }),
        Contact.countDocuments(),
        Contact.countDocuments({ status: "new" }),
        Contact.find().select("name email subject status createdAt").sort({ createdAt: -1 }).limit(5),
      ]);

    res.json({
      success: true,
      data: { totalArticles, publishedArticles, totalEnquiries, newEnquiries, recentEnquiries },
    });
  } catch (err) { next(err); }
}

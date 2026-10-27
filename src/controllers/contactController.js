import Contact from "../models/contact.js";

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const paging = (req) => ({
  page: Math.max(1, parseInt(req.query.page) || 1),
  limit: Math.min(50, Math.max(1, parseInt(req.query.limit) || 10)),
});

const notFound = (res) =>
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Enquiry not found" } });

// Public
export async function submit(req, res, next) {
  try {
    const { name, companyName, email, phone, subject, message } = req.body;
    await Contact.create({ name, companyName, email, phone, subject, message });

    res.status(201).json({ success: true, data: null, message: "Thanks, we received your message" });
  } catch (err) { next(err); }
}

// Admin
export async function listAdmin(req, res, next) {
  try {
    const { page, limit } = paging(req);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ name: rx }, { email: rx }, { companyName: rx }, { subject: rx }];
    }
    const [items, total] = await Promise.all([
      Contact.find(filter)
        .select("name companyName email subject status createdAt")   // no message in the list
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Contact.countDocuments(filter),
    ]);
    res.json({ success: true, data: { items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (err) { next(err); }
}

export async function getAdmin(req, res, next) {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return notFound(res);
    res.json({ success: true, data: contact });
  } catch (err) { next(err); }
}

export async function updateStatus(req, res, next) {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!contact) return notFound(res);
    res.json({ success: true, data: contact, message: "Status updated" });
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return notFound(res);
    res.json({ success: true, data: null, message: "Enquiry deleted" });
  } catch (err) { next(err); }
}

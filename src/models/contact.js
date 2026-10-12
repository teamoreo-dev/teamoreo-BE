import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    companyName: { type: String, trim: true, maxlength: 150 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 30 },
    subject: { type: String, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    attachment: {
      key: String,
      originalName: String,
      mimeType: String,
      size: Number,
    },
    status: { type: String, enum: ["new", "read", "resolved"], default: "new" },
  },
  { timestamps: true }
);

contactSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Contact", contactSchema);
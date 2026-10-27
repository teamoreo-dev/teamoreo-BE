export const notFound = (_req, res) => res.status(404).json({
  success: false, error: { code: "NOT_FOUND", message: "Route not found" },
});

export function errorHandler(err, _req, res, next) {
  if (res.headersSent) return next(err);
  let status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  let code = typeof err.code === "string" ? err.code : "INTERNAL_ERROR";
  let message = err.message || "Internal server error";
  let fields = err.fields;
  if (err.type === "entity.parse.failed") {
    status = 400; code = "INVALID_JSON"; message = "Request body must be valid JSON";
  } else if (err.type === "entity.too.large") {
    status = 413; code = "PAYLOAD_TOO_LARGE"; message = "JSON body exceeds the 1 MB limit";
  } else if (err.name === "ValidationError") {
    status = 400; code = "VALIDATION_ERROR"; message = "Check the submitted fields";
    fields = Object.fromEntries(Object.keys(err.errors || {}).map((key) => [key, "Invalid value"]));
  } else if (err.code === 11000) {
    status = 409; code = "CONFLICT"; message = "A record with this unique value already exists";
  } else if (err.name === "CastError") {
    status = 400; code = "VALIDATION_ERROR"; message = "Invalid resource identifier or field value";
  } else if (err.name === "VersionError") {
    status = 409; code = "CONFLICT"; message = "Article changed; reload it before saving again";
  } else if (err.code === "LIMIT_FILE_SIZE") {
    status = 413; code = "FILE_TOO_LARGE"; message = "Uploaded file exceeds the 5 MB limit";
  } else if (err.name === "MulterError" || /^(Multipart:|Unexpected end of form)/.test(message)) {
    status = 400; code = "INVALID_FILE"; message = "Invalid multipart upload; send one file using the image field";
  }
  if (status >= 500) {
    // Keep upstream messages, request bodies, connection strings and credentials out of logs.
    console.error("Request failed:", code === "CLOUDINARY_ERROR" ? code : "INTERNAL_ERROR");
    message = code === "CLOUDINARY_ERROR" ? "Image service unavailable; try again later" : "Internal server error";
    code = code === "CLOUDINARY_ERROR" ? code : "INTERNAL_ERROR";
    fields = undefined;
  }
  res.status(status).json({ success: false, error: { code, message, ...(fields ? { fields } : {}) } });
}

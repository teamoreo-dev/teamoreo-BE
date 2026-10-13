const notFound = (_req, res) =>
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  // Malformed JSON body (thrown by express.json / body-parser)
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400 && 'body' in err)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' },
    });
  }

  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  let fields = err.fields;

  if (err.name === 'ValidationError') {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Check the submitted fields';
    fields = {};
    for (const [k, v] of Object.entries(err.errors || {})) fields[k] = v.message;
  } else if (err.code === 11000) {
    status = 409; code = 'CONFLICT'; message = 'A record with this unique value already exists';
  } else if (err.name === 'CastError') {
    status = 404; code = 'NOT_FOUND'; message = 'Resource not found';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413; code = 'FILE_TOO_LARGE';
  }

  if (status >= 500) {
    console.error('[error]', err); // log details server-side only
    message = 'Internal server error'; // never leak internals to clients
  }

  res.status(status).json({ success: false, error: { code, message, ...(fields ? { fields } : {}) } });
};

export default { notFound, errorHandler };
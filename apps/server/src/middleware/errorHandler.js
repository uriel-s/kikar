const multer = require("multer");
const ApiError = require("../lib/ApiError");

const notFound = (req, _res, next) => {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
};

/** Translates multer's upload failures into the status the client deserves. */
const normalize = (err) => {
  if (err instanceof ApiError) return err;

  if (err instanceof multer.MulterError) {
    return err.code === "LIMIT_FILE_SIZE"
      ? ApiError.payloadTooLarge("Image must be 5MB or smaller")
      : ApiError.badRequest(err.message);
  }

  // express.json() rejects malformed payloads with a SyntaxError carrying a status.
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return ApiError.badRequest("Request body is not valid JSON");
  }

  return null;
};

/**
 * Single exit point for every error.
 *
 * Express 5 forwards rejected async handlers here automatically, which is why
 * controllers contain no try/catch. Unrecognized errors are logged in full and
 * answered with a generic 500 — the previous handler echoed err.message to the
 * caller, exposing internals like Firestore query failures.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
const errorHandler = (err, req, res, _next) => {
  const apiError = normalize(err);

  if (!apiError) {
    req.log?.error({ err }, "Unhandled error");
    return res.status(500).json({ error: { message: "Internal server error" } });
  }

  if (apiError.status >= 500) {
    req.log?.error({ err: apiError }, apiError.message);
  } else {
    req.log?.warn({ status: apiError.status, msg: apiError.message }, "Request rejected");
  }

  return res.status(apiError.status).json({
    error: {
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  });
};

module.exports = { notFound, errorHandler };

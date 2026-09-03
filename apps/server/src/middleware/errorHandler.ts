import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ApiError } from "../lib/ApiError";

export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
};

/** Translates multer's upload failures into the status the client deserves. */
const normalize = (err: unknown): ApiError | null => {
  if (err instanceof ApiError) return err;

  if (err instanceof multer.MulterError) {
    return err.code === "LIMIT_FILE_SIZE"
      ? ApiError.payloadTooLarge("Image must be 5MB or smaller")
      : ApiError.badRequest(err.message);
  }

  // express.json() rejects malformed payloads with a SyntaxError carrying a status.
  // `"status" in err` narrows a property the built-in SyntaxError does not
  // declare; it cannot change the outcome, since reading an absent `status`
  // would be undefined and fail the comparison anyway.
  if (
    err instanceof SyntaxError &&
    "status" in err &&
    err.status === 400 &&
    "body" in err
  ) {
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
 *
 * Typed as ErrorRequestHandler, and the unused `_next` stays: Express decides
 * this is an error handler by counting the parameters, so a three-parameter
 * version would silently become ordinary middleware and never run.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
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

/**
 * An error carrying the HTTP status the client should see.
 *
 * Anything thrown that is not an ApiError is treated as an unexpected failure:
 * the error handler logs it in full and returns a generic 500, so internal
 * details never reach the response body.
 */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = "Bad request", details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError(401, message);
  }

  static forbidden(message = "You do not have permission to do that") {
    return new ApiError(403, message);
  }

  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }

  static payloadTooLarge(message = "Payload too large") {
    return new ApiError(413, message);
  }
}

module.exports = ApiError;

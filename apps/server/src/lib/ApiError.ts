/**
 * An error carrying the HTTP status the client should see.
 *
 * Anything thrown that is not an ApiError is treated as an unexpected failure:
 * the error handler logs it in full and returns a generic 500, so internal
 * details never reach the response body.
 */
export class ApiError extends Error {
  // `declare`, so nothing is emitted for these two lines. Target is ES2023, so
  // `useDefineForClassFields` is on and a plain `details?: unknown` would
  // compile to a real class field — defining `details: undefined` as an own
  // property of every ApiError, including the 4xx ones that carry no details.
  // errorHandler only reads it for truthiness so no response would change, but
  // pino serializes an error's own enumerable properties, so every rejected
  // request would start logging a `details: undefined` that was never there.
  declare status: number;
  declare details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = "Bad request", details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Authentication required"): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = "You do not have permission to do that"): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = "Not found"): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict"): ApiError {
    return new ApiError(409, message);
  }

  static payloadTooLarge(message = "Payload too large"): ApiError {
    return new ApiError(413, message);
  }
}

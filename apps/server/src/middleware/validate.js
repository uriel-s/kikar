const { ApiError } = require("../lib/ApiError");

/**
 * Validates req.body / req.params / req.query against zod schemas and replaces
 * each with the parsed result, so controllers receive coerced, trimmed,
 * known-shaped values and never re-check them.
 */
const validate = (schemas) => (req, _res, next) => {
  for (const source of ["body", "params", "query"]) {
    const schema = schemas[source];
    if (!schema) continue;

    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || source,
        message: issue.message,
      }));
      return next(ApiError.badRequest("Validation failed", details));
    }

    // req.query is a getter-only property in Express 5, so assign in place.
    if (source === "query") {
      Object.defineProperty(req, "query", { value: result.data, writable: true });
    } else {
      req[source] = result.data;
    }
  }

  return next();
};

module.exports = { validate };

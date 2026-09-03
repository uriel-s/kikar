import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../lib/ApiError";

/**
 * The three request parts a route may validate. Each is optional: most routes
 * describe only one or two of them, and an absent schema means "leave it".
 */
export interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Validates req.body / req.params / req.query against zod schemas and replaces
 * each with the parsed result, so controllers receive coerced, trimmed,
 * known-shaped values and never re-check them.
 */
export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req, _res, next) => {
    for (const source of ["body", "params", "query"] as const) {
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

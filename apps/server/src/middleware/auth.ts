import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "../lib/ApiError";

const BEARER = /^Bearer (.+)$/i;

/**
 * The two claims requireAuth copies off a verified ID token onto `req.user`.
 *
 * `email` is optional because firebase-admin's DecodedIdToken makes it
 * optional — an account signed in with a phone number or a custom token has
 * none. `uid` is not: it is the identity every authorization decision in this
 * codebase is made against, and it is also the User.id column.
 */
export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

/**
 * The one method of firebase-admin's Auth that this application calls.
 *
 * Structural and minimal on purpose, rather than the concrete `Auth` class:
 * tests/helpers/testApp.ts injects a fake exposing only `verifyIdToken`, and a
 * signature demanding the real class could only be satisfied by casting that
 * fake — which is how a type-checked refactor stops checking the dependency
 * injection it exists to protect.
 */
export interface TokenVerifier {
  verifyIdToken(idToken: string, checkRevoked?: boolean): Promise<AuthenticatedUser>;
}

/**
 * Express's own `req.params` — a plain string dictionary.
 *
 * Named here so a handler with no path parameters of its own can fill that slot
 * without importing from @types/express-serve-static-core, which this workspace
 * only has transitively.
 */
export type PathParams = Request["params"];

/**
 * A request as it reaches a controller: below `app.use(requireAuth(auth))`, and
 * past the route's own `validate(schemas.x)`.
 *
 * `user` is required here, unlike in the global augmentation in
 * types/express.d.ts, which has to leave it optional because Express's Request
 * covers /health as well. CLAUDE.md makes `req.user.uid` the single source of
 * the caller's identity, and re-checking it at each of the twenty read sites
 * would only invite one of them to fall back to a body field the way v1's
 * delete-post handler did.
 *
 * `ReqBody` and `ReqQuery` are what validate() parsed and put back, which is
 * why controllers may read `req.query.limit` as a number: nothing else in
 * Express could produce one.
 */
export type AuthenticatedRequest<
  P = PathParams,
  ReqBody = unknown,
  ReqQuery = Request["query"],
> = Request<P, unknown, ReqBody, ReqQuery> & { user: AuthenticatedUser };

/** A handler that may rely on those two middlewares having run. */
export type AuthenticatedHandler<
  P = PathParams,
  ReqBody = unknown,
  ReqQuery = Request["query"],
> = (
  req: AuthenticatedRequest<P, ReqBody, ReqQuery>,
  res: Response,
  next: NextFunction
) => unknown;

/**
 * Presents an AuthenticatedHandler as the RequestHandler Express accepts.
 *
 * Express hands every handler a plain Request — `user` optional, `body` and
 * `query` untouched — so an AuthenticatedHandler is deliberately *not*
 * assignable to RequestHandler, and this is the single place that gap is
 * bridged. It rests on two facts about how the routes are assembled, both of
 * which app.ts and routes/ have to keep true:
 *
 *   - every route wrapped here is registered under /api/users or /api/posts,
 *     which app.ts mounts *after* `app.use(requireAuth(auth))`, so `req.user`
 *     is set. Anything reachable without a verified token — /health today —
 *     must not use this;
 *   - every such route runs `validate(schemas.x)` first, which replaces body,
 *     params and query with the parsed values.
 *
 * The result is published as an ordinary `RequestHandler<P>`, only the path
 * parameters kept, because that is all the router has to agree with; a returned
 * handler still advertising `query: { limit: number }` cannot sit in the same
 * `router.get(...)` call as `validate`, whose own query is Express's ParsedQs.
 * Widening it back is what makes the assertion go through `unknown`.
 *
 * A cast rather than a wrapping function, so the handler Express calls is the
 * very function the controller defined: same identity, same arity, and the
 * rejected promise Express 5 forwards to errorHandler is still the handler's
 * own.
 */
export const authenticated = <
  P = PathParams,
  ReqBody = unknown,
  ReqQuery = Request["query"],
>(
  handler: AuthenticatedHandler<P, ReqBody, ReqQuery>
): RequestHandler<P> => handler as unknown as RequestHandler<P>;

/**
 * Verifies the Firebase ID token on the Authorization header.
 *
 * Every route that reads or writes user data goes through this. Before it
 * existed the API was fully open: anyone could rewrite any profile, befriend
 * anyone on anyone's behalf, or delete any post by naming its author id in the
 * request body.
 */
export const requireAuth =
  (auth: TokenVerifier): RequestHandler =>
  async (req, _res, next) => {
    const match = BEARER.exec(req.headers.authorization ?? "");

    if (!match) {
      return next(ApiError.unauthorized("Missing bearer token"));
    }

    try {
      // checkRevoked: a signed-out or disabled account stops working immediately
      // instead of staying valid until the token's natural expiry.
      const decoded = await auth.verifyIdToken(match[1], true);
      req.user = { uid: decoded.uid, email: decoded.email };
      return next();
    } catch (cause) {
      req.log?.debug({ err: cause }, "ID token verification failed");
      return next(ApiError.unauthorized("Invalid or expired token"));
    }
  };

/**
 * Rejects the request unless the caller owns the :<paramName> resource.
 *
 * Authentication only proves who is calling. This is what stops an
 * authenticated user from editing somebody else's profile.
 */
export const requireSelf =
  (paramName = "id"): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (req.params[paramName] !== req.user.uid) {
      return next(ApiError.forbidden("You can only modify your own account"));
    }
    return next();
  };

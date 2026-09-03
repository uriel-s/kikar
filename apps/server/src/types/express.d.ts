import type { AuthenticatedUser } from "../middleware/auth";

/**
 * What `requireAuth` adds to every request that reaches a route.
 *
 * `user` is optional here because on Express's own Request it genuinely is:
 * requireAuth is the only thing that assigns it, and /health is registered
 * above `app.use(requireAuth(auth))`, so a request can reach a handler having
 * never been authenticated. Declaring it required would make requireSelf's
 * `if (!req.user)` guard read as dead code — and that guard is the last thing
 * standing between an unauthenticated caller and somebody's account.
 *
 * Handlers mounted below requireAuth use `AuthenticatedRequest` from
 * middleware/auth instead, where the same field is required, so controllers do
 * not re-check an identity the middleware already proved.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

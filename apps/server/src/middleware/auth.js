const { ApiError } = require("../lib/ApiError");

const BEARER = /^Bearer (.+)$/i;

/**
 * Verifies the Firebase ID token on the Authorization header.
 *
 * Every route that reads or writes user data goes through this. Before it
 * existed the API was fully open: anyone could rewrite any profile, befriend
 * anyone on anyone's behalf, or delete any post by naming its author id in the
 * request body.
 */
const requireAuth = (auth) => async (req, _res, next) => {
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
const requireSelf =
  (paramName = "id") =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (req.params[paramName] !== req.user.uid) {
      return next(ApiError.forbidden("You can only modify your own account"));
    }
    return next();
  };

module.exports = { requireAuth, requireSelf };

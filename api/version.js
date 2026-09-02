/**
 * Reports the runtime this function actually got, and nothing else.
 *
 * The main handler in `index.js` failed to load on Vercel with ERR_REQUIRE_ESM
 * — firebase-admin reaches jose 6, which is ESM-only, through a `require()` in
 * jwks-rsa. That call is only supported from Node 22.12, and it works on a
 * developer machine running 22 or 24. Which Node the deployed function was
 * given could not be established from outside: `engines.node` did not change
 * the outcome, the dashboard reports one version as an uneditable "production
 * override" and another under project settings, and a handler that cannot load
 * cannot report anything about itself.
 *
 * This file imports nothing, so it loads whatever happens. It exists to replace
 * that guesswork with one fact, and should be deleted once the deployment is
 * healthy — it is a probe, not a feature.
 */

module.exports = (_req, res) => {
  res.status(200).json({
    node: process.version,
    // require(esm) landed unflagged in 22.12. Anything below that cannot load
    // firebase-admin's dependency chain, whatever the dashboard claims.
    supportsRequireEsm: (() => {
      const [major, minor] = process.versions.node.split(".").map(Number);
      return major > 22 || (major === 22 && minor >= 12);
    })(),
    platform: process.platform,
    arch: process.arch,
    region: process.env.VERCEL_REGION || null,
  });
};

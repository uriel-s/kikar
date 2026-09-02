/**
 * Diagnostic probe. Imports nothing at module scope, so it always loads.
 *
 * The real handler fails on Vercel with ERR_REQUIRE_ESM and cannot report
 * anything about itself. Four attempts to fix it from the outside — raising
 * engines.node, a dashboard setting, an invented vercel.json field, and an ESM
 * entry point — were all made without knowing which link in the chain actually
 * breaks, and all four failed.
 *
 * So this walks the chain one hop at a time and reports where it stops. Every
 * load happens inside the request, in a try/catch, so a failure becomes JSON
 * instead of another opaque FUNCTION_INVOCATION_FAILED.
 *
 * Delete once the deployment is healthy. This is a probe, not a feature.
 */

const attempt = async (label, load) => {
  const started = Date.now();
  try {
    await load();
    return { step: label, ok: true, ms: Date.now() - started };
  } catch (err) {
    return {
      step: label,
      ok: false,
      ms: Date.now() - started,
      code: err.code || null,
      error: String(err.message || err)
        .split("\n")[0]
        .slice(0, 300),
    };
  }
};

module.exports = async (_req, res) => {
  const [major, minor] = process.versions.node.split(".").map(Number);

  // Ordered from the leaf inward, so the first failure names the exact hop.
  const steps = [
    // Does an ESM import work here at all?
    await attempt("import jose (ESM)", () => import("jose")),
    // The failing call in the real chain: CommonJS require() of that ES module.
    await attempt("require jwks-rsa (CJS that require()s jose)", async () =>
      require("jwks-rsa")
    ),
    await attempt("import firebase-admin/auth", () => import("firebase-admin/auth")),
    await attempt("import the express app", () => import("../apps/server/src/app.js")),
    await attempt("import the handler itself", () => import("./index.mjs")),
  ];

  res.status(200).json({
    node: process.version,
    supportsRequireEsm: major > 22 || (major === 22 && minor >= 12),
    region: process.env.VERCEL_REGION || null,
    firstFailure: steps.find((s) => !s.ok)?.step ?? null,
    steps,
  });
};

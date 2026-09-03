/**
 * Boot checks for the two modules the jest suite never loads.
 *
 * `tests/helpers/testApp.js` injects a fake token verifier. That is what makes
 * the 52 tests fast and hermetic, and it also means `src/config/firebase.js` is
 * never reached by any of them. When firebase-admin 14 removed the legacy
 * `admin.apps` / `admin.credential` namespace, the server stopped booting
 * entirely — every request failed — and the suite stayed green throughout.
 * Dependency injection buys isolation; this is the blind spot it costs.
 *
 * `api/index.mjs` has the same problem for the same reason, and it matters more:
 * it is the entry point that actually runs in production. A wrong relative
 * require or a changed env contract there would first surface as a dead site.
 *
 * Both are loaded from `../dist`, not `../src`, and that is the point of this
 * script: it tests the shape that ships. The jest suite runs the TypeScript
 * sources; Vercel and the container both run what `npm run build
 * --workspace=@kikar/server` emitted. A build step that dropped a file, or a
 * relative path that only resolves inside src/, is invisible to a green suite
 * and fatal in production — so the one check that boots the real thing boots
 * the real artifact too. `checks.sh smoke` builds before running for that
 * reason; on its own this script needs `dist/` to already exist.
 *
 * Why this is a plain script rather than a jest test: firebase-admin/auth pulls
 * in jwks-rsa, which pulls in jose 6, which ships ESM only — no CJS build to
 * map to. Jest would need babel-jest and a transformIgnorePatterns exception to
 * parse it. Under plain node it needs nothing. When the suite moves to Vitest
 * (stage 9 of the refactor plan) this folds back in, because Vitest loads ESM
 * natively.
 *
 * No network and no real Firebase project: initializeApp only parses the
 * credential, and nothing is sent anywhere until a token is actually verified.
 *
 * Run: node apps/server/tests/startup.smoke.js   (or: checks.sh smoke)
 */

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const { initializeFirebase, loadServiceAccount } = require("../dist/config/firebase");

const BUCKET = "kikar-startup-test.appspot.com";

// cert() parses the PEM, so a placeholder string is rejected. Generating a
// throwaway key is better than committing a key-shaped secret that every
// scanner will flag for the rest of this repository's life.
const buildServiceAccount = () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  return {
    project_id: "kikar-startup-test",
    private_key: privateKey,
    client_email: "startup-test@kikar-startup-test.iam.gserviceaccount.com",
  };
};

const SERVICE_ACCOUNT_JSON = JSON.stringify(buildServiceAccount());
const env = {
  FIREBASE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON,
  FIREBASE_STORAGE_BUCKET: BUCKET,
};

const results = [];
const record = (name, run) => {
  try {
    run();
    results.push([true, name]);
  } catch (err) {
    results.push([false, name, err.message.split("\n")[0]]);
  }
};

// ---------------------------------------------------------------- firebase

record("initializes firebase-admin and returns the handles server.js injects", () => {
  const { auth, bucket } = initializeFirebase(env);

  // Exactly what server.js destructures and hands to createApp. If the SDK
  // surface moves again, this is the line that says so.
  assert.equal(typeof auth.verifyIdToken, "function");
  assert.equal(bucket.name, BUCKET);
});

record("reuses the existing app rather than initializing a second time", () => {
  const { getApps } = require("firebase-admin/app");

  // initializeApp throws on a duplicate app name; the getApps() guard in
  // config/firebase.js is the only thing preventing that on a second call.
  // Asserting the count as well, because "did not throw" would also pass if the
  // first check had failed and left nothing registered at all.
  assert.doesNotThrow(() => initializeFirebase(env));
  assert.equal(getApps().length, 1);
});

record("reports an unparseable service account instead of failing later", () => {
  // Checked through loadServiceAccount rather than initializeFirebase. The
  // getApps() guard means the credential is parsed on the first call only, so
  // by this point initializeFirebase would hand back the cached handles without
  // ever looking at the JSON.
  assert.throws(
    () => loadServiceAccount({ FIREBASE_SERVICE_ACCOUNT_JSON: "{not json" }),
    /not valid JSON/i
  );
});

record("the jwks-rsa patch is actually applied", () => {
  // patch-package only fails the install in CI; on a developer machine a patch
  // that stops applying prints red text and exits 0. And nothing else would
  // notice: every check here runs on Node >= 22.12, where the unpatched code
  // works perfectly. This assertion is the only thing standing between a
  // dependency bump and a Vercel deployment that dies on boot again.
  const fs = require("node:fs");
  const patched = fs.readFileSync(require.resolve("jwks-rsa/src/utils.js"), "utf8");
  assert.match(patched, /PATCHED/, "run npm install to reapply patches/");
});

// ------------------------------------------------------- the Vercel handler

/**
 * Boots `api/index.mjs` over a real HTTP server.
 *
 * These are the two requests the deployment guide tells you to make first, run
 * here so the answer is known before a deploy rather than after one. `/health`
 * proves the function is reachable and its dependencies resolved; `/api/users`
 * proves routing and `requireAuth` are wired, since a missing token must be
 * rejected before anything touches the database.
 */
const checkVercelHandler = async () => {
  // logger.js already treats "test" as its quiet level. Without this the two
  // requests below print two full pino records into every CI run.
  process.env.NODE_ENV = "test";

  // config/env.js loads the repository's real .env through dotenv, which does
  // not overwrite variables that are already set. Blanking the PATH variable
  // first keeps that file from supplying a second credential source — env.js
  // requires exactly one, and would otherwise fail with "both are set".
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH = "";
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = SERVICE_ACCOUNT_JSON;
  process.env.FIREBASE_STORAGE_BUCKET = BUCKET;
  process.env.DATABASE_URL = "postgresql://smoke:smoke@127.0.0.1:5432/smoke";
  process.env.CORS_ORIGINS = "https://kikar.example";

  // Dynamic import, not require: the entry point is ESM precisely because a
  // CommonJS one cannot load on Vercel. Requiring it from this CommonJS script
  // would test the shape that does not ship.
  const mod = await import("../../../api/index.mjs");
  const handler = mod.default;
  assert.equal(typeof handler, "function", "api/index.mjs must export a handler");

  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  const get = (path) =>
    new Promise((resolve, reject) => {
      const req = http.get({ host: "127.0.0.1", port, path }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
      req.on("error", reject);
    });

  try {
    const health = await get("/health");
    assert.equal(health.status, 200);
    assert.deepEqual(JSON.parse(health.body), { status: "ok" });

    // No token, so this must never reach a repository — there is no database
    // behind this check, and a 401 is what proves it did not try.
    const users = await get("/api/users");
    assert.equal(users.status, 401);
    assert.match(JSON.parse(users.body).error.message, /bearer token/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

const main = async () => {
  try {
    await checkVercelHandler();
    results.push([true, "api/index.mjs answers 200 on /health and 401 on /api/users"]);
  } catch (err) {
    results.push([
      false,
      "api/index.mjs answers 200 on /health and 401 on /api/users",
      err.message.split("\n")[0],
    ]);
  }

  let failed = 0;
  for (const [ok, name, detail] of results) {
    if (ok) {
      console.log(`  ok    ${name}`);
    } else {
      failed += 1;
      console.error(`  FAIL  ${name}`);
      console.error(`        ${detail}`);
    }
  }

  if (failed > 0) {
    console.error(`smoke: ${failed} of ${results.length} checks failed`);
    process.exit(1);
  }

  console.log(`smoke: ${results.length} startup checks passed`);
};

main();

/**
 * Boot check for the one module the jest suite never loads.
 *
 * `tests/helpers/testApp.js` injects a fake token verifier. That is what makes
 * the 52 tests fast and hermetic, and it also means `src/config/firebase.js` is
 * never reached by any of them. When firebase-admin 14 removed the legacy
 * `admin.apps` / `admin.credential` namespace, the server stopped booting
 * entirely — every request failed — and the suite stayed green throughout.
 * Dependency injection buys isolation; this is the blind spot it costs.
 *
 * Why this is a plain script rather than a jest test: firebase-admin/auth pulls
 * in jwks-rsa, which pulls in jose 6, which ships ESM only — no CJS build to
 * map to. Jest would need babel-jest and a transformIgnorePatterns exception to
 * parse it. Running it under plain node needs nothing at all. When the suite
 * moves to Vitest (stage 9 of the refactor plan) this folds back in, because
 * Vitest loads ESM natively.
 *
 * No network and no real Firebase project: initializeApp only parses the
 * credential, and nothing is sent anywhere until a token is actually verified.
 *
 * Run: node apps/server/tests/startup.smoke.js   (or: checks.sh smoke)
 */

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { initializeFirebase, loadServiceAccount } = require("../src/config/firebase");

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

const env = {
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(buildServiceAccount()),
  FIREBASE_STORAGE_BUCKET: BUCKET,
};

const checks = [
  [
    "initializes firebase-admin and returns the handles server.js injects",
    () => {
      const { auth, bucket } = initializeFirebase(env);

      // Exactly what server.js destructures and hands to createApp. If the SDK
      // surface moves again, this is the line that says so.
      assert.equal(typeof auth.verifyIdToken, "function");
      assert.equal(bucket.name, BUCKET);
    },
  ],
  [
    "reuses the existing app rather than initializing a second time",
    () => {
      // initializeApp throws on a duplicate app name; the getApps() guard in
      // config/firebase.js is the only thing preventing that on a second call.
      assert.doesNotThrow(() => initializeFirebase(env));
    },
  ],
  [
    "reports an unparseable service account instead of failing later",
    () => {
      // Checked through loadServiceAccount rather than initializeFirebase.
      // The getApps() guard means the credential is parsed on the first call
      // only, so by this point initializeFirebase would hand back the cached
      // handles without ever looking at the JSON.
      assert.throws(
        () => loadServiceAccount({ FIREBASE_SERVICE_ACCOUNT_JSON: "{not json" }),
        /not valid JSON/i
      );
    },
  ],
];

let failed = 0;

for (const [name, run] of checks) {
  try {
    run();
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message.split("\n")[0]}`);
  }
}

if (failed > 0) {
  console.error(`smoke: ${failed} of ${checks.length} checks failed`);
  process.exit(1);
}

console.log(`smoke: ${checks.length} startup checks passed`);

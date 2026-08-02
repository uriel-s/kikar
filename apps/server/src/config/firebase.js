const fs = require("node:fs");
const admin = require("firebase-admin");

/**
 * Reads the service account from whichever source the environment supplies.
 *
 * Inline JSON suits containers and CI, where mounting a key file is awkward and
 * the value comes from a secret manager. A file path suits local development.
 * env.js guarantees exactly one of the two is set.
 */
const loadServiceAccount = (env) => {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (cause) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${cause.message}`
      );
    }
  }

  const keyPath = env.FIREBASE_SERVICE_ACCOUNT_PATH;
  try {
    return JSON.parse(fs.readFileSync(keyPath, "utf8"));
  } catch (cause) {
    throw new Error(
      `Cannot read service account at FIREBASE_SERVICE_ACCOUNT_PATH ` +
        `(${keyPath}): ${cause.message}`
    );
  }
};

/**
 * Initializes firebase-admin once and returns the handles the app needs.
 *
 * Firebase covers identity and file storage only. Application data lives in
 * PostgreSQL, reached through the repository layer.
 */
const initializeFirebase = (env) => {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(loadServiceAccount(env)),
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
    });
  }

  return {
    auth: admin.auth(),
    bucket: admin.storage().bucket(),
  };
};

module.exports = { initializeFirebase, loadServiceAccount };

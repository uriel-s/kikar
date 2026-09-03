import fs from "node:fs";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import type { Env } from "./env";

// Only the fields each function reads — see the note on `Env` in ./env. It also
// keeps tests/startup.smoke.js honest: it calls both of these with a hand-built
// object rather than a parsed environment, which is the only way to reach them
// without a real Firebase project.
type ServiceAccountEnv = Pick<
  Env,
  "FIREBASE_SERVICE_ACCOUNT_JSON" | "FIREBASE_SERVICE_ACCOUNT_PATH"
>;
type FirebaseEnv = ServiceAccountEnv & Pick<Env, "FIREBASE_STORAGE_BUCKET">;

// `catch` binds `unknown` under strict. Both throwers below raise real Errors,
// so narrowing costs nothing here and is honest about the one case a cast would
// have quietly rendered as the string "undefined" in an operator's only clue.
const reason = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Reads the service account from whichever source the environment supplies.
 *
 * Inline JSON suits containers and CI, where mounting a key file is awkward and
 * the value comes from a secret manager. A file path suits local development.
 * env.ts guarantees exactly one of the two is set.
 */
export const loadServiceAccount = (env: ServiceAccountEnv): ServiceAccount => {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (cause) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${reason(cause)}`
      );
    }
  }

  // Typed as the string the exactly-one-of check in env.ts guarantees, which is
  // a cross-field refine the compiler cannot follow. Left as a plain read
  // rather than a guard on purpose: a direct caller that supplies neither still
  // falls into the catch below and gets the "(undefined)" message it always
  // got, instead of a new error shape from a new branch.
  const keyPath = env.FIREBASE_SERVICE_ACCOUNT_PATH as string;
  try {
    return JSON.parse(fs.readFileSync(keyPath, "utf8"));
  } catch (cause) {
    throw new Error(
      `Cannot read service account at FIREBASE_SERVICE_ACCOUNT_PATH ` +
        `(${keyPath}): ${reason(cause)}`
    );
  }
};

/**
 * Initializes firebase-admin once and returns the handles the app needs.
 *
 * Firebase covers identity and file storage only. Application data lives in
 * PostgreSQL, reached through the repository layer.
 */
export const initializeFirebase = (env: FirebaseEnv) => {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(loadServiceAccount(env)),
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
    });
  }

  return {
    auth: getAuth(),
    bucket: getStorage().bucket(),
  };
};

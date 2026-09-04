import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

/**
 * Firebase web configuration.
 *
 * These values are public by design — they identify the project and ship inside
 * every browser bundle. They are read from the environment anyway so the same
 * source can point at a staging project, and so nothing about the deployment
 * target is hardcoded.
 *
 * Access control lives in Firebase Auth and in this app's API, never here.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  // Failing here names the problem. Without it the app renders fine and then
  // every sign-in fails with an opaque Firebase error instead.
  throw new Error(
    `Missing Firebase configuration: ${missing.join(", ")}. ` +
      `Copy .env.example to apps/client/.env and fill in the values.`
  );
}

const app = initializeApp(config);

export const auth = getAuth(app);
export default app;

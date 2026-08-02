import firebase from "firebase/compat/app";
import "firebase/compat/auth";

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
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  // Failing here names the problem. Without it the app renders fine and then
  // every sign-in fails with an opaque Firebase error instead.
  throw new Error(
    `Missing Firebase configuration: ${missing.join(", ")}. ` +
      `Copy .env.example to .env at the repository root and fill in the values.`
  );
}

const app = firebase.initializeApp(config);

export const auth = app.auth();
export default app;

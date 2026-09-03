/// <reference types="vite/client" />

// Only VITE_API_URL for now — the only VITE_* variable the files converting in
// this stage (src/lib, src/api) touch. Firebase's VITE_FIREBASE_* variables
// get added here when firebase.js itself converts, in a later stage.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

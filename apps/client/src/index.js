import React from "react";
import { createRoot } from "react-dom/client";

// Self-hosted through @fontsource rather than a Google Fonts <link>: the app
// ships as a Docker image behind nginx, and a runtime request to fonts.gstatic
// .com is a first paint that depends on someone else's uptime and on the
// visitor not being behind a filter. Vite fingerprints the woff2 files into
// dist/assets like any other asset.
import "@fontsource/archivo-black/400.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";

import "tachyons";
import "bootstrap/dist/css/bootstrap.min.css";
// Declared as a dependency but never imported, so every <i className="fas ..."> in
// the app rendered as nothing.
import "@fortawesome/fontawesome-free/css/all.min.css";
// Before ./index.css deliberately — the old stylesheet has to keep winning
// every collision until the screen it serves has been rebuilt. See the header
// of theme.css.
import "./styles/theme.css";
import "./index.css";

import App from "./App";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

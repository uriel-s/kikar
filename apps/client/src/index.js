import React from "react";
import { createRoot } from "react-dom/client";

import "tachyons";
import "bootstrap/dist/css/bootstrap.min.css";
// Declared as a dependency but never imported, so every <i className="fas ..."> in
// the app rendered as nothing.
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./index.css";

import App from "./App";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

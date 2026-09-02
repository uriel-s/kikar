import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { transform } from "esbuild";

// CRA let JSX live in plain .js files; Vite/esbuild only treat .jsx/.tsx that
// way by default. Setting esbuild.loader alone is not enough for the
// production build (Rollup's import-analysis parses the file before that
// option is consulted), so source .js files under src/ are explicitly
// re-parsed with esbuild's jsx loader here. This mirrors the standard Vite
// workaround for CRA-style codebases (vitejs/vite#7869) rather than renaming
// every .js file to .jsx.
function loadJsFilesAsJsx(): Plugin {
  const jsInSrc = /[/\\]src[/\\].*\.js$/;
  return {
    name: "load-js-files-as-jsx",
    async transform(code, id) {
      if (!jsInSrc.test(id)) return null;
      const result = await transform(code, {
        loader: "jsx",
        sourcefile: id,
        sourcemap: true,
      });
      return { code: result.code, map: result.map || null };
    },
  };
}

// build.outDir "dist" matches Vite's own default and the refactor plan; kept
// explicit for clarity.
export default defineConfig({
  // Tailwind v4 has no PostCSS step and no tailwind.config.js: the Vite plugin
  // is the whole build integration, and the configuration lives in
  // src/styles/theme.css as an @theme block. Nothing here needs a content/
  // sources list — v4 discovers source files itself, honouring .gitignore.
  plugins: [loadJsFilesAsJsx(), react(), tailwindcss()],

  // Vite's default port is 5173, and the server's CORS allowlist is
  // http://localhost:3000 — in env.js's default, .env.example and
  // docker-compose alike. Left unset, every cross-origin response in local
  // development is blocked by the browser, which reads as "the API is down"
  // rather than as a configuration problem. CRA got 3000 from PORT in
  // apps/client/.env; Vite ignores PORT entirely, so it is pinned here.
  //
  // strictPort so a port clash fails loudly instead of silently sliding to
  // 3001 and reintroducing the same CORS failure.
  server: { port: 3000, strictPort: true },
  // The dependency pre-bundling scan runs on raw esbuild before any Rollup-style
  // plugin (including loadJsFilesAsJsx above) sees the files, so it needs its
  // own loader mapping for the same CRA-style .js-with-JSX files.
  optimizeDeps: {
    esbuildOptions: {
      loader: { ".js": "jsx" },
    },
  },
  build: {
    outDir: "dist",
  },
});

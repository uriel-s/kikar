import react from "@vitejs/plugin-react";
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
  plugins: [loadJsFilesAsJsx(), react()],
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

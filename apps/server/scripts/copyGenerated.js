/**
 * Puts the generated Prisma client where the compiled server expects it.
 *
 * `prisma/schema.prisma` generates into `src/generated/prisma`, and
 * `src/lib/prisma.js` imports it relatively as `../generated/prisma`. That
 * relative path survives compilation unchanged, so `dist/lib/prisma.js`
 * resolves it to `dist/generated/prisma` — a directory tsc does not create.
 * Without this step the build succeeds and the server dies on its first import.
 *
 * It is copied rather than compiled on purpose. tsc reads the client's
 * `index.d.ts` for the model types, but the package also ships `.wasm` and
 * `.mjs` loader files that tsc will not carry across, so a compiled copy would
 * be missing the query compiler. `apps/server/tsconfig.json` excludes it for
 * that reason, and `schema.prisma` keeps its current `output` so nothing else
 * has to know about this.
 *
 * Run by `npm run build --workspace=@kikar/server`, after tsc.
 */

const fs = require("node:fs");
const path = require("node:path");

const source = path.join(__dirname, "..", "src", "generated");
const target = path.join(__dirname, "..", "dist", "generated");

if (!fs.existsSync(source)) {
  console.error("copyGenerated: apps/server/src/generated does not exist.");
  console.error("  Run: npm run db:generate --workspace=@kikar/server");
  process.exit(1);
}

// Removed first rather than copied over. `prisma generate` renames and drops
// files between versions, and a plain overwrite would leave the stale ones
// behind in dist/ — where they would keep resolving and hide the fact that the
// client changed shape.
fs.rmSync(target, { recursive: true, force: true });

// fs.cpSync rather than shelling out to `cp -r`: this runs on Windows
// developer machines as well as in Linux CI and the Docker build stage.
fs.cpSync(source, target, { recursive: true });

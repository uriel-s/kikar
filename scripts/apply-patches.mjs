/**
 * Runs patch-package where it belongs, and steps aside where it does not.
 *
 * A root `postinstall` fires for *every* install in this repository, including
 * workspace-scoped ones. `npm ci --workspace=@kikar/client` — what the client
 * Dockerfile runs — installs neither patch-package nor the package it patches,
 * so a bare `"postinstall": "patch-package"` there fails with `command not
 * found` and takes the image build down with it. That is not a real failure:
 * there is nothing in that tree to patch.
 *
 * So the rule is: patch when the tooling and the patches are both present, skip
 * loudly when they are not, and never swallow a patch that fails on its own
 * terms — patch-package's exit code is propagated unchanged.
 *
 * The one risk this leaves is a context where the patch *should* apply and the
 * tool is silently missing. Two things cover it: patch-package is a dependency
 * of @kikar/server, the workspace that owns the patched package, so any install
 * carrying jwks-rsa carries the tool as well; and `checks.sh smoke` asserts the
 * PATCHED marker is present, so an unapplied patch fails a gate rather than
 * reaching production.
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

if (!existsSync(join(repoRoot, "patches"))) {
  console.log("apply-patches: no patches/ directory here, nothing to do");
  process.exit(0);
}

try {
  require.resolve("patch-package");
} catch {
  // Expected in a workspace-scoped install that does not include the server.
  console.log("apply-patches: patch-package is not installed in this tree, skipping");
  process.exit(0);
}

// --error-on-warn because bare patch-package exits 0 outside CI even when a
// patch fails to apply, which would leave a developer running unpatched code
// after an ordinary npm install.
const result = spawnSync(
  process.execPath,
  [require.resolve("patch-package/index.js"), "--error-on-warn"],
  { cwd: repoRoot, stdio: "inherit" }
);

process.exit(result.status ?? 1);

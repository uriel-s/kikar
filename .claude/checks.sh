#!/usr/bin/env bash
# Toolchain contract for the Claude command system.
# subcommands: test | lint | format | arch | types | sec | smoke | build | all
#
# Relationship to CI, stated exactly because the earlier "mirrors CI step for
# step" claim was false in both directions and CLAUDE.md repeated it:
#   - test, lint, format, build  — run in both, same commands
#   - sec                        — here only (npm audit is not a CI job)
#   - migrations, docker         — CI only; both need services (Postgres 17,
#                                  Buildx) that this script deliberately does
#                                  not start
# So green here is necessary but not sufficient: a migration drift or a broken
# Dockerfile is still only caught by CI.
# Checks whose tool isn't installed are SKIPPED with a warning. `all` runs every
# check and reports ALL failures, not just the first. (exit 0 = green)
#
# Ported from ~/.claude/templates/checks.sh. Three deliberate differences from
# the Python template, each noted at the function it affects:
#   - `build` is a new subcommand: the client has no tests, so compiling it is
#     the only regression signal that exists for it.
#   - `test` asserts the suite size against .claude/test-baseline. This is a
#     refactor; a green suite that shrank is a failure, not a pass.
#   - the Prisma client is generated, not committed, so `test` ensures it exists
#     before running anything that imports it, and `smoke` compiles the server
#     first because it boots apps/server/dist — the artifact that ships.
set -u

# jest switches to interactive watch mode without this, and an automated caller
# would hang forever waiting on a keypress.
export CI=true

SERVER="@kikar/server"
CLIENT="@kikar/client"
SHARED="@kikar/shared"
GENERATED="apps/server/src/generated/prisma"
SCHEMA="apps/server/prisma/schema.prisma"
SERVER_SRC="apps/server/src"
SHARED_SRC="packages/shared/src"
DIST="apps/server/dist"
SHARED_DIST="packages/shared/dist"
BASELINE_FILE=".claude/test-baseline"
AUDIT_BASELINE=".claude/audit-baseline"

# True if a tool is runnable from the local install. --no-install stops npx from
# silently downloading something that is not actually a dependency.
have() { npx --no-install "$1" --version >/dev/null 2>&1; }

# The Prisma client is gitignored and generated. Nothing that imports it — the
# server or its tests — runs until this has happened once. Regenerated when it is
# missing or older than the schema, so a schema edit cannot leave a stale client
# behind and produce a confusing failure three layers down.
ensure_prisma_client() {
  if [ ! -d "$GENERATED" ] || [ "$SCHEMA" -nt "$GENERATED" ]; then
    echo "checks.sh: generating the Prisma client"
    npm run db:generate --workspace="$SERVER" >/dev/null 2>&1 || {
      echo "checks.sh: prisma generate FAILED" >&2
      return 1
    }
  fi
}

# @kikar/shared is a real workspace dependency, resolved through ordinary
# node_modules resolution rather than a tsconfig path alias — so, exactly like
# the generated Prisma client, nothing that imports it (server src, server
# tests, the root type-check) runs or resolves until it has been built at least
# once. Rebuilt when missing or stale so an edit to a shared schema is picked
# up by every consumer's next check rather than needing a manual build first.
ensure_shared_build() {
  local stale=""
  if [ -d "$SHARED_DIST" ]; then
    stale="$(find "$SHARED_SRC" packages/shared/tsconfig.json tsconfig.base.json -newer "$SHARED_DIST" -print -quit 2>/dev/null)"
  fi

  if [ ! -d "$SHARED_DIST" ] || [ -n "$stale" ]; then
    echo "checks.sh: building @kikar/shared"
    local output
    if ! output="$(npm run build --workspace="$SHARED" 2>&1)"; then
      printf '%s\n' "$output" >&2
      echo "checks.sh: @kikar/shared build FAILED" >&2
      return 1
    fi
  fi
}

# apps/server/dist is what actually runs: api/index.mjs imports it, the
# container's CMD points at it, and `npm start` starts it. So the same reasoning
# as ensure_prisma_client applies one layer up — rebuilt when it is missing or
# older than any source file or compiler config, because a check that boots a
# stale dist proves yesterday's code green and says nothing about the edit in
# front of you. The build copies the generated client into dist, so that has to
# exist first. Output is kept and printed only on failure: from stage 4 onward
# the failure is a type error, and it is unreadable if it is swallowed.
ensure_server_build() {
  ensure_prisma_client || return 1
  ensure_shared_build || return 1

  local stale="" output
  if [ -d "$DIST" ]; then
    # $SCHEMA, not the generated client itself: files under src/generated/ are
    # excluded below, because ensure_prisma_client already regenerated them by
    # this point and their mtime is "just now" on every run regardless of
    # whether the schema actually changed — that would mark dist stale on
    # every single invocation. The schema file's own mtime is what actually
    # tells us a regeneration happened, so a schema edit reaches dist even
    # though the generated files that resulted from it are excluded.
    stale="$(find "$SERVER_SRC" "$SCHEMA" apps/server/tsconfig.json tsconfig.base.json -newer "$DIST" -not -path "*/generated/*" -print -quit 2>/dev/null)"
  fi

  if [ ! -d "$DIST" ] || [ -n "$stale" ]; then
    echo "checks.sh: building the server"
    if ! output="$(npm run build --workspace="$SERVER" 2>&1)"; then
      printf '%s\n' "$output" >&2
      echo "checks.sh: server build FAILED" >&2
      return 1
    fi
  fi
}

# --max-warnings pins the warning count the same way `test` pins the suite size.
# Four are expected today, each deferred to the stage that rewrites the code
# rather than patched now (see the reasoning at each rule in eslint.config.js):
#   2x react-hooks/set-state-in-effect  — AllUsers, PostsPage; TanStack Query
#   2x jsx-a11y/*                       — Navbar's <div onClick>; Tailwind stage
# Without the flag ESLint exits 0 on any number of warnings, which would leave
# every warn-level rule — react-hooks/exhaustive-deps among them — structurally
# incapable of turning this gate red. The exit code is the only thing an
# automated caller reads. Raising this number is a deliberate act, like the
# test baseline: it means accepting a new piece of debt, not absorbing one.
run_lint()   { npx eslint . --max-warnings 4; }
run_format() { npx prettier --check .; }

run_arch() { echo "SKIP: no import-linter equivalent wired up"; }

run_types() {
  if [ -f "tsconfig.json" ] && have tsc; then
    # src/lib/prisma.ts imports the generated client for its types, and the
    # routes/controllers import @kikar/shared — tsc cannot resolve the program
    # without both existing first, the same dependency run_test and
    # ensure_server_build already account for.
    ensure_prisma_client || return 1
    ensure_shared_build || return 1
    npx tsc --noEmit
  else
    echo "SKIP: no TypeScript yet (added in the TS migration stage)"
  fi
}

# Gates on production dependencies — the code that actually ships and runs.
# While CRA was the bundler every high-severity advisory was transitive through
# its build chain, so `--omit=dev` reported nothing and this gate passed by
# being empty. With react-scripts gone what remains is real: `@prisma/client`
# pulls the `prisma` CLI into the production tree, and it carries a high
# `deepmerge-ts` advisory.
#
# There is no upstream fix to take. `@prisma/config` pins `deepmerge-ts` to
# 7.1.5 exactly — still true in prisma 7.10.0 — `npm audit fix --force` "fixes"
# it by downgrading Prisma 7 to 6, and npm ignores an `overrides` entry for it
# here. The reachable harm is close to nil: @prisma/config merges
# prisma.config.js, a local trusted file, never attacker input.
#
# So the known advisories are pinned BY NAME rather than the gate being lowered,
# the same way the test count and the warning count are pinned. Anything new —
# or anything that disappears — fails the run and has to be looked at on
# purpose. When Prisma ships a fixed @prisma/config, empty the baseline file.
run_sec() {
  local expected actual
  expected="$(grep -vE '^[[:space:]]*(#|$)' "$AUDIT_BASELINE" 2>/dev/null | tr -d '\r' | sort)"
  actual="$(npm audit --omit=dev --json 2>/dev/null |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s).vulnerabilities||{};console.log(Object.values(v).filter(x=>x.severity==='high'||x.severity==='critical').map(x=>x.name).sort().join('\n'))}catch(e){process.exit(1)}})")"

  if [ $? -ne 0 ]; then
    echo "checks.sh: could not read npm audit output" >&2
    return 1
  fi

  if [ "$actual" = "$expected" ]; then
    if [ -n "$actual" ]; then
      echo "checks.sh: $(printf '%s\n' "$actual" | grep -c .) production high/critical advisories, all pinned in $AUDIT_BASELINE"
    else
      echo "checks.sh: no production high/critical advisories"
    fi
    return 0
  fi

  echo "checks.sh: production high/critical advisories no longer match $AUDIT_BASELINE." >&2
  echo "  pinned: $(printf '%s ' $expected)" >&2
  echo "  found:  $(printf '%s ' $actual)" >&2
  echo "  This is an accepted-risk list, not a scratchpad — investigate before editing it." >&2
  return 1
}

# Scoped to the server workspace on purpose: it is the only workspace with tests,
# and CI runs the same scoped form. (Under CRA this also avoided a hang — the
# root `npm test` fanned out into react-scripts' watch-mode runner. Vite ships no
# test runner, so the client now has no `test` script at all and `--if-present`
# skips it.)
#
# Extra args narrow the run to specific paths (`checks.sh test tests/auth.test.js`),
# so callers never need to bypass this wrapper and lose the environment setup.
# A narrowed run skips the baseline assertion, since a subset is expected to be
# smaller than the whole.
run_test() {
  ensure_prisma_client || return 1
  ensure_shared_build || return 1

  if [ "$#" -gt 0 ]; then
    npm run test --workspace="$SERVER" -- "$@"
    return $?
  fi

  local output rc
  output="$(npm run test --workspace="$SERVER" 2>&1)"
  rc=$?
  printf '%s\n' "$output"
  [ "$rc" -ne 0 ] && return 1

  assert_test_count "$output"
}

# A refactor must not change behaviour, and the suite is what proves it. Exit
# code alone cannot tell "52 passed" apart from "52 passed because 8 were deleted
# and 3 were weakened", so the count is pinned. Drift in either direction fails:
# upward drift is legitimate often enough to be worth stating out loud, and
# stating it means editing the baseline on purpose.
assert_test_count() {
  local output="$1" expected actual

  if [ ! -f "$BASELINE_FILE" ]; then
    echo "SKIP: no $BASELINE_FILE, suite size not pinned"
    return 0
  fi

  expected="$(tr -dc '0-9' < "$BASELINE_FILE")"
  actual="$(printf '%s\n' "$output" | grep -E '^Tests:' | grep -oE '[0-9]+ total' | grep -oE '[0-9]+')"

  if [ -z "$actual" ]; then
    echo "checks.sh: could not read a test count from the jest summary" >&2
    return 1
  fi

  if [ "$actual" != "$expected" ]; then
    echo "checks.sh: test count is $actual, baseline is $expected." >&2
    echo "  A refactor stage should not change it. If the change is intended," >&2
    echo "  say so by writing $actual into $BASELINE_FILE." >&2
    return 1
  fi

  echo "checks.sh: $actual tests, matching the baseline"
}

# The client has no tests at all, so a successful production build is the only
# thing standing between a broken component and a merge. Placeholder Firebase
# values because src/firebase.js fails fast on missing configuration and the
# build only needs them to be present — the same values CI uses.
run_build() {
  # VITE_API_URL is deliberately EMPTY. That is the production shape: client and
  # API share an origin on Vercel, so the base URL resolves to a relative /api.
  # This gate used to build with a localhost value, which is precisely what hid
  # a bug that pointed every deployed API call at the visitor's own machine.
  # Build the shape that ships, not a convenient one.
  VITE_API_URL= \
  VITE_FIREBASE_API_KEY=ci-placeholder \
  VITE_FIREBASE_AUTH_DOMAIN=ci-placeholder \
  VITE_FIREBASE_PROJECT_ID=ci-placeholder \
  VITE_FIREBASE_STORAGE_BUCKET=ci-placeholder \
  VITE_FIREBASE_MESSAGING_SENDER_ID=ci-placeholder \
  VITE_FIREBASE_APP_ID=ci-placeholder \
    npm run build --workspace="$CLIENT" || return 1

  # Vite inlines env values at build time, so a leftover localhost default is
  # visible in the emitted bundle and nowhere else — the client has no tests,
  # and a build that merely succeeds proves nothing about what it resolved to.
  if grep -rq "localhost:5000" apps/client/dist/assets 2>/dev/null; then
    echo "checks.sh: the client bundle contains localhost:5000." >&2
    echo "  A production build must resolve the API to a same-origin /api." >&2
    return 1
  fi
}

# The jest suite proves the application logic; this proves the process can
# actually start. They are different questions, and 52 green tests answering the
# first one is exactly how a total startup crash reached main: testApp.ts injects
# a fake token verifier, so src/config/firebase.ts is the one module the suite
# never loads. Plain node rather than jest because firebase-admin/auth reaches
# jose 6, which is ESM-only; see the header of the script itself.
#
# It is also the only check that loads the compiled output rather than the
# sources, which is the other half of "the shape that ships" — hence the build.
run_smoke() {
  ensure_server_build || return 1
  node apps/server/tests/startup.smoke.js
}

run_all() {
  local rc=0
  run_lint   || rc=1
  run_format || rc=1
  run_arch   || rc=1
  run_types  || rc=1
  run_sec    || rc=1
  run_test   || rc=1
  run_smoke  || rc=1
  run_build  || rc=1
  return $rc
}

case "${1:-all}" in
  test)   shift; run_test "$@" ;;
  lint)   run_lint ;;
  format) run_format ;;
  arch)   run_arch ;;
  types)  run_types ;;
  sec|security) run_sec ;;
  smoke)  run_smoke ;;
  build)  run_build ;;
  all)    run_all ;;
  *) echo "usage: checks.sh {test|lint|format|arch|types|sec|smoke|build|all}" >&2; exit 2 ;;
esac

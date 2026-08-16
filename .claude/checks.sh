#!/usr/bin/env bash
# Toolchain contract for the Claude command system.
# subcommands: test | lint | format | arch | types | sec | build | all
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
#     before running anything that imports it.
set -u

# react-scripts and jest both switch to interactive watch mode without this, and
# an automated caller would hang forever waiting on a keypress.
export CI=true

SERVER="@kikar/server"
CLIENT="@kikar/client"
GENERATED="apps/server/src/generated/prisma"
SCHEMA="apps/server/prisma/schema.prisma"
BASELINE_FILE=".claude/test-baseline"

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
    npx tsc --noEmit
  else
    echo "SKIP: no TypeScript yet (added in the TS migration stage)"
  fi
}

# Gates on production dependencies only — that is the code that actually ships
# and runs. Build-tool advisories are reported but do not fail the run: every
# one of them is transitive through react-scripts, `npm audit fix` cannot reach
# them while CRA is the bundler, and failing here would leave the whole contract
# permanently red for a reason no stage before the Vite migration can fix.
#
# Once Vite replaces react-scripts, drop the --omit=dev and the informational
# block: there will be nothing left to exempt.
run_sec() {
  local rc=0
  npm audit --omit=dev --audit-level=high || rc=1

  local dev_high
  dev_high="$(npm audit --json 2>/dev/null |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const m=JSON.parse(s).metadata.vulnerabilities;console.log((m.high||0)+(m.critical||0))}catch{console.log(0)}})")"
  if [ "${dev_high:-0}" -gt 0 ]; then
    echo "NOTE: $dev_high high/critical advisories in build tooling (react-scripts chain), not gated. Resolved by the Vite migration."
  fi

  return $rc
}

# Scoped to the server workspace on purpose. The root `npm test` fans out to
# every workspace, which includes the client's react-scripts runner — that has no
# tests to run and stalls the whole script. CI runs the scoped form for the same
# reason.
#
# Extra args narrow the run to specific paths (`checks.sh test tests/auth.test.js`),
# so callers never need to bypass this wrapper and lose the environment setup.
# A narrowed run skips the baseline assertion, since a subset is expected to be
# smaller than the whole.
run_test() {
  ensure_prisma_client || return 1

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
  REACT_APP_API_URL=http://localhost:5000 \
  REACT_APP_FIREBASE_API_KEY=ci-placeholder \
  REACT_APP_FIREBASE_AUTH_DOMAIN=ci-placeholder \
  REACT_APP_FIREBASE_PROJECT_ID=ci-placeholder \
  REACT_APP_FIREBASE_STORAGE_BUCKET=ci-placeholder \
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID=ci-placeholder \
  REACT_APP_FIREBASE_APP_ID=ci-placeholder \
    npm run build --workspace="$CLIENT"
}

run_all() {
  local rc=0
  run_lint   || rc=1
  run_format || rc=1
  run_arch   || rc=1
  run_types  || rc=1
  run_sec    || rc=1
  run_test   || rc=1
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
  build)  run_build ;;
  all)    run_all ;;
  *) echo "usage: checks.sh {test|lint|format|arch|types|sec|build|all}" >&2; exit 2 ;;
esac

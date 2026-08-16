# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Kikar — a social platform (posts, likes, comments, friendships). npm-workspaces
monorepo: `apps/client` (React 18 / CRA) and `apps/server` (Express 5 / Prisma 7 /
PostgreSQL 17). Version 2 is a rebuild of two older repositories; `README.md`
documents what changed and what is deliberately still missing.

## Commands

Run from the repository root unless noted.

```bash
npm install
npm run db:generate --workspace=@kikar/server   # REQUIRED after clone — see below
npm run dev                                     # client :3000 + server :5000

docker compose up --build                       # whole stack, migrations applied on boot
docker compose up db -d                         # just PostgreSQL
npm run db:migrate --workspace=@kikar/server    # create/advance schema (dev)
npm run db:deploy  --workspace=@kikar/server    # apply existing migrations (prod/CI)
npm run db:studio  --workspace=@kikar/server

npm run test --workspace=@kikar/server          # 52 tests, jest + supertest
npm run test --workspace=@kikar/server -- tests/authorization.test.js   # one file
npm run test --workspace=@kikar/server -- -t "cannot"                  # by name
npm run build --workspace=@kikar/client
npm run format                                  # prettier
```

`npm run db:import --workspace=@kikar/server -- --dry-run` imports the legacy
Firestore data; it is idempotent.

### `bash .claude/checks.sh` — the definition of "green"

One command answers "is this repository in a good state". It mirrors
`.github/workflows/ci.yml` step for step, so green here means green in CI.
**Prefer it over the individual commands above** — there is one definition of
green, not two.

```bash
bash .claude/checks.sh all           # lint, format, arch, types, sec, test, build
bash .claude/checks.sh test          # full suite + suite-size assertion
bash .claude/checks.sh test tests/auth.test.js   # narrowed; skips the assertion
bash .claude/checks.sh lint
```

Checks whose tool is not wired up yet print `SKIP:` and pass. Two behaviours are
specific to this repository and worth knowing:

- **`test` pins the suite size** against `.claude/test-baseline` (currently 52).
  A green suite that shrank is a failure. During a refactor the count must not
  move; when a change to it is intended, write the new number into that file
  deliberately.
- **`build` is part of `all`.** The client has no tests, so compiling it is the
  only regression signal it has.

### Two setup facts that are not obvious

- **The Prisma client is generated, not committed** (`apps/server/src/generated/`
  is gitignored). Nothing that imports it — server or tests — runs until
  `db:generate` has been run once.
- **The client needs its own `.env`.** `src/config/env.js` and `prisma.config.js`
  load the _root_ `.env` explicitly, but Create React App only reads
  `apps/client/.env`. A root-only `.env` leaves the client throwing
  "Missing Firebase configuration" at startup. Copy the `REACT_APP_*` values into
  `apps/client/.env` as well.
- **`react-scripts` lives in `devDependencies`, not `dependencies`.** CRA's
  generator puts it in the wrong one. Moving it is what makes
  `npm audit --omit=dev` mean anything: every high-severity advisory in this
  repository is transitive through the CRA build chain, so auditing production
  dependencies alone is the only signal about code that actually ships.

## Development Workflow

**MANDATORY — follow this for every implementation task (build, fix, refactor,
create).** Discussion-only or exploration tasks are exempt.

Before writing ANY code:

1. **Plan** — break the task into small, focused sub-tasks. List them explicitly.
   Include a scope estimate (expected number of files changed).
2. **Confirm** — get user approval on the sub-task list before proceeding.

Then for EACH sub-task, repeat this cycle:

3. **Write** — code, and the tests that prove it.
4. **Review** — check the result against the rules in this file: layer
   boundaries, `req.user.uid` as the only identity source, `.strict()` schemas,
   comments that explain _why_.
5. **Refactor** — fix what the review found.
6. **Verify** — `bash .claude/checks.sh test <the files you touched>`, then
   `bash .claude/checks.sh lint`. Red → back to step 4 and iterate until clean.
   Do not substitute a bare `npm test`: the root script fans out to the client's
   watch-mode runner and hangs.
7. **Commit** — ask before committing; one focused commit per sub-task.

After ALL sub-tasks are complete:

8. **Full verify** — `bash .claude/checks.sh all`. This is the gate, and it
   includes the client build and the suite-size assertion.
9. **Scope check** — compare `git diff --stat main` against the estimate from
   step 1. More than 50% or 3+ files over, say so rather than absorbing it.
10. **Review** — `/review` on the branch. Note it is a no-op on `main`: there is
    nothing to diff, so every stage needs its own branch.

> Do NOT skip steps. Do NOT combine sub-tasks. Do NOT commit until checks pass.

### While the v3 refactor is in progress

`docs/REFACTOR-PLAN.md` is the plan; `docs/code-quality-review-2026-08-04.md` is
the measured "before" state. One rule governs every stage:

**Behaviour must not change.** The 52 server tests are the safety net that
proves it, which is why `checks.sh test` pins their count. A stage that makes
tests disappear has not passed — it has removed the evidence. If a test genuinely
must change, change it deliberately and say so.

## Architecture

### Identity is Firebase, data is PostgreSQL

`User.id` in the database **is** the Firebase UID. No password ever reaches this
codebase. Every request outside `/health` carries a Firebase ID token that
`requireAuth` verifies with `firebase-admin` (`verifyIdToken(token, true)` — the
`true` checks revocation, so a signed-out account fails immediately).

Consequence for any new endpoint: **the caller's identity comes from
`req.user.uid`, never from the request body or a path parameter.** Every write
schema is `.strict()` so an unexpected `userId` field is a 400, not a silent
authorization bypass — this is the exact class of bug v1 shipped.

### Dependency injection is what makes the tests work

`createApp({ env, auth, bucket, prisma, logger })` receives everything it
touches; nothing is constructed at import time. `tests/helpers/testApp.js` builds
the _real_ application over a fake token verifier (tokens of the form
`valid:<uid>`), a fake storage bucket, and a hand-stubbed Prisma object — so the
suite exercises real routing, middleware, and error handling with no database and
no network.

Every layer follows the same `createX(deps) => ({ ...methods })` factory shape:
`repositories/` → `controllers/` → `routes/` → `app.js`. Match it when adding
code.

### Request path and layer rules

```
routes/ → validate(schemas.x) → requireSelf('id') → controller → repository → prisma
```

- **`routes/`** — wiring only. Ordering matters: `/search` is registered before
  `/:id` so it is not swallowed as a user id.
- **`middleware/validate.js`** — parses `body`/`params`/`query` with zod and
  _replaces_ them with the parsed result. Controllers therefore receive coerced,
  trimmed, known-shaped values and must not re-validate. (`req.query` is
  getter-only in Express 5, hence the `Object.defineProperty` assignment.)
- **`middleware/auth.js`** — `requireAuth` proves _who_; `requireSelf(param)`
  proves _ownership_. Any route that mutates a user's own resources needs both.
- **`controllers/`** — HTTP shaping and Prisma error-code translation
  (`P2002` → 409, `P2025` → 404, `P2003` → 404). **No Prisma queries here.**
- **`repositories/`** — the only place `prisma` is touched. Field selection is
  centralized as `PUBLIC_FIELDS` / `PRIVATE_FIELDS`; email, address, and birth
  date are only ever selected when the viewer is the account owner.
- **Errors** — throw `ApiError.*`; never `res.status(500)` by hand. Express 5
  forwards rejected async handlers to `errorHandler` automatically, which is why
  controllers have no `try/catch` except around Prisma codes they translate.
  Unrecognized errors are logged in full and answered with a generic
  `Internal server error` — do not put internal detail in a response body.
- **Response shape** — success bodies are named (`{ user }`, `{ posts, nextCursor }`);
  errors are always `{ error: { message, details? } }`.

### Data model invariants enforced by the database

These are constraints, not conventions — do not reimplement them in application
code:

- **`likes`** has composite PK `(postId, userId)`. Liking uses `createMany({
skipDuplicates: true })` and reports whether it was new. There is no
  read-modify-write.
- **`friendships`** is one row per pair with `userAId < userBId` enforced by a
  `CHECK` constraint. Always route through `canonicalPair()` in
  `userRepository.js`; the asymmetric "A knows B but B does not know A" state
  cannot be represented.
- **Search** relies on `pg_trgm` GIN indexes created in the initial migration.
  `contains` + `mode: "insensitive"` compiles to `ILIKE '%…%'`, which those
  indexes make indexable — do not drop them.

### Pagination

Every list is keyset-paginated through the shared `page(rows, limit, cursorOf)`
helper: over-fetch `limit + 1`, slice, return `nextCursor` (`null` = end). Page
size is capped at 50 by the zod `pagination` schema. New list endpoints must use
this rather than `skip`/`take` offsets.

### Feed shape

`GET /posts` returns posts with the author embedded and likes/comments as
`_count` aggregates plus a viewer-scoped `likedByMe`. This is deliberate: the v1
feed was 41 requests because each card fetched its own author and comments. Do
not add per-item fetches to `PostCard`; comments load only when a reader opens
them.

### Client

- `src/lib/apiClient.js` is the single axios instance. Its request interceptor
  attaches the Firebase ID token to _every_ call — never build a bare axios
  request or hand-set an `Authorization` header. It deliberately sets no default
  `Content-Type` so `FormData` uploads keep their multipart boundary.
- `src/api/*.js` are the only modules where URLs appear. Components import from
  there, not from `apiClient` directly.
- Its response interceptor normalizes the API's error envelope into
  `ApiRequestError` (`message`, `status`, `details`) — catch that, not raw axios
  errors.
- Firebase uses the **compat** SDK (`firebase/compat/app`), so it is
  `auth.signInWithEmailAndPassword(...)`, not the modular v9 API.
- Routing is React Router **v5** (`Switch`, `component=`), not v6.

### Avatar uploads

Uploads are identified by **magic bytes** (`lib/imageType.js`), and the detected
type — never the declared `Content-Type` — is what gets stored. Each user has
exactly one object at the deterministic path `profile_pictures/<uid>`, so
replacing is a plain overwrite. 5 MB cap, enforced by multer and surfaced as 413.

## Conventions

- CommonJS on the server (`require`/`module.exports`), ES modules on the client.
- Prettier: 90-column width, double quotes, semicolons, ES5 trailing commas.
- Comments in this codebase explain _why_, usually citing the v1 bug the current
  shape exists to prevent. Follow that when the reasoning is non-obvious;
  do not add comments that restate the code.
- Node 22 (`.nvmrc`); `engines` requires >= 20.

## Tests

`apps/server/tests/` covers the security-critical surface — `auth`,
`authorization`, `validation`, `avatarUpload`. When adding a route, the
expectation is a case proving it rejects an unauthenticated caller and a case
proving one user cannot act on another's resources. **The client has no tests.**

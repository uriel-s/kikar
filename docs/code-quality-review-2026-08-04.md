# Kikar — Code Quality Review

**Date:** 2026-08-04
**Branch:** `main` @ `30fe0ee`
**Purpose:** BEFORE-baseline, taken immediately prior to the multi-stage refactor
described in [docs/REFACTOR-PLAN.md](REFACTOR-PLAN.md). Re-run this review after
Stage 8 and compare.

## Context

Kikar is an npm-workspaces monorepo hosting a social platform (posts, likes,
comments, friendships).

|                  |                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Client**       | React 18, Create React App, React Router 5, Bootstrap 5 + react-bootstrap + tachyons + FontAwesome, axios, Firebase compat SDK             |
| **Server**       | Node 22, Express 5, Prisma 7, PostgreSQL 17, zod 4, pino, helmet, express-rate-limit, multer, firebase-admin                               |
| **Architecture** | Layered with constructor injection: `routes → middleware → controllers → repositories → prisma`, composed once in `server.js`              |
| **Guidelines**   | `CLAUDE.md` (8.5 KB, architecture + conventions), `README.md` (15 KB), `docs/DEPLOYMENT.md`, `docs/SECURITY-REMEDIATION.md`, `.prettierrc` |
| **Tests**        | jest + supertest, `apps/server/tests/` — **52 passing**, verified this session. Client: **zero**                                           |
| **Size**         | 53 source files, 5,865 LOC (excluding `apps/server/src/generated/` and `node_modules/`)                                                    |

Measured this session:

```
tests            52 passed / 52 total          ✅
npm run lint     FAILS — no ESLint config      ❌
prettier --check 27 files fail                 ❌
npm audit        33 vulns (14 high)            ❌  all via react-scripts
client tests     none                          ❌
```

Version 2 was a security-driven rebuild of a 2021 codebase whose API had no
authentication at all. That history is visible throughout and is the project's
main strength.

---

## 1. Modularity & SOLID — Score: 7.5/10

| Principle                   | Score   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S** Single Responsibility | **8**   | Server layering is strictly observed: `postController.js` contains zero Prisma calls; every query lives in `postRepository.js`. `validate.js` (33 lines), `ApiError.js` (44), `imageType.js` (39) each do exactly one thing. **Deduction:** client pages mix concerns — `PostsPage.js` owns fetching, pagination, optimistic like state, deletion, error state, and rendering in 143 lines; `UpdateProfile.js` (235 lines) issues three sequential API calls in one submit handler                                                                                  |
| **O** Open/Closed           | **7**   | The `createX(deps) => ({ ...methods })` factory shape is applied uniformly and _is_ the extension seam — `services/storageService.js` is 28 lines and constitutes the entire storage surface, so swapping providers touches one file. `SIGNATURES` in `imageType.js:16` is a clean extension table: a new format is a new row. **Deduction:** `schemas/index.js` is one flat literal and `app.js` hardcodes its routers, so a new resource edits shared files                                                                                                       |
| **L** Liskov Substitution   | **N/A** | The only inheritance in the codebase is `class ApiError extends Error` (`ApiError.js:8`), which honors the contract it extends (`name`, `message`, `captureStackTrace`). No subtype hierarchies and no polymorphic dispatch exist, so there is nothing to violate                                                                                                                                                                                                                                                                                                   |
| **I** Interface Segregation | **6**   | Consumers receive only what they use: `createPostController({ posts })` never sees `storage`. **Deduction:** the repository objects are wide — `createUserRepository` exposes 10 methods, the controller calls 8, and `fieldsFor` is called by **nothing** (see Reachability). Test doubles must mirror the exact Prisma surface per route (`prisma: { user: { update: … } }`), a hand-stub per test                                                                                                                                                                |
| **D** Dependency Inversion  | **9**   | The strongest dimension. `server.js` is the sole composition root; nothing is constructed at import time. `createApp({ env, auth, bucket, prisma, logger })` (`app.js:40`) receives all five. Proof it is real rather than decorative: `tests/helpers/testApp.js:39` builds the _actual_ application over a fake `verifyIdToken`, a fake bucket, and a stub Prisma — 52 tests run with no database and no network. **Deduction:** `lib/prisma.js:2` and both controllers import `../generated/prisma` directly, so generated code reaches into the controller layer |

### Architecture Highlights

- **Constructor injection is genuine, not test-shaped.** The shape would be correct
  with no tests at all; the suite is a consequence of it.
- **Database invariants are enforced by the database.** `likes` has composite PK
  `(postId, userId)`; `friendships` carries `CHECK ("userAId" < "userBId")`
  (`migration.sql:104`). Verified present, not merely documented.
- **Keyset pagination is centralized.** One `page(rows, limit, cursorOf)` helper
  (`userRepository.js:107`) backs every list; page size capped at 50 in zod.
- **One error exit.** `errorHandler.js` is the single point at which a response
  status is decided.

### Improvement Opportunities

1. **Extract shared post-mutation logic.** `patchPost`, `handleLike`, and
   `handleCommentAdded` are duplicated near-verbatim between `PostsPage.js:50-90`
   and `SearchResults.js:65-96` — ~35 lines. Any change to like behavior requires
   two edits.
2. **Delete `userRepository.fieldsFor`.** No caller; controllers use
   `findById(id, { includePrivate })`.
3. **Split `UpdateProfile.js`.** Profile fields, password change, and avatar
   upload are three operations sharing one handler and one error slot.

---

## 2. Guidelines & Policy Adherence — Score: 6.2/10

| Category          | Rating            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation     | **Excellent** (9) | Comments explain _why_, consistently anchored to the v1 bug the code prevents — e.g. `postRepository.js:65-72` on `like`, `userRepository.js:8-10` on `PRIVATE_FIELDS`. Length is proportional: no docstring exceeds the function it documents. `Regex.js` is 12 lines carrying 11 lines of comment, but the comment documents a real vulnerability, so it earns its size. **Claims verified against reality:** `pg_trgm` GIN indexes (`migration.sql:110-114`) and the friendship `CHECK` constraint both genuinely exist                                                                                                                                                                                |
| Naming            | **Excellent** (9) | `canonicalPair`, `PUBLIC_FIELDS`/`PRIVATE_FIELDS`, `requireSelf`, `detectImageType`, `MAX_AVATAR_BYTES` — descriptive and consistent. **Nit:** `App.js:9` imports Dashboard under the misspelled alias `Dashbord`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Type safety       | **Major gap** (2) | **Zero TypeScript.** No JSDoc type annotations anywhere. No `prop-types` on any of the 11 client components. zod validates only at the HTTP edge — everything past `validate()` is unchecked `any` in practice. This is the single largest deduction in the review                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Security          | **Minor gap** (7) | Strong by construction: helmet, CORS allowlist, 300-req/15-min rate limiting, 100 kB body cap, `.strict()` on every write schema, magic-byte upload verification (`imageType.js`), Authorization/cookie redaction in logs (`logger.js:12`), generic 500s, TLS verification on by default with the downgrade documented as deliberate (`prisma.js:14-24`). No `eval`, no hardcoded secrets. **Deductions:** (a) 33 npm advisories, 14 high — _all_ traced to `react-scripts` build tooling, none in the runtime path; (b) `GET /api/users/:id/friends` and `/:id/friends/:friendId` carry no `requireSelf`, so any authenticated user can enumerate any other user's friend list — undocumented either way |
| Test conventions  | **Major gap** (4) | _What exists is disciplined:_ tests assert through HTTP and on mock call arguments, never reaching into private members; `testApp.js` is a proper shared helper rather than copy-paste. _What is missing is most of it:_ all 52 tests cover the security surface (auth, authorization, validation, avatarUpload); **no test covers business logic** — not cursor pagination, not `canonicalPair` ordering, not `toApiPost` shaping, not `like` idempotency. **Client has zero tests.** No `test.each` parameterization anywhere                                                                                                                                                                           |
| Code organization | **Minor gap** (6) | Layering is clean, no circular imports, largest file 359 lines. **Deductions:** `Components/` is PascalCase while `pages/`, `api/`, `lib/`, `contexts/` are lowercase; **three competing CSS systems load side by side** (`index.js:4-8`: tachyons, Bootstrap, FontAwesome) on top of 1,172 lines of hand-written CSS containing 51 unique hex literals and no design tokens; `npm run lint` is broken; `prettier --check` fails on 27 files including source                                                                                                                                                                                                                                             |

### Bottom line

The documentation and security posture are the work of someone who understood
what went wrong the first time and wrote it down. The gap is entirely in
**typing and test breadth** — the two things that make a codebase safe to change
rather than safe to read.

One artifact of the broken lint worth noting: `errorHandler.js:34` carries
`// eslint-disable-next-line no-unused-vars`, a directive with no ESLint to
receive it. The intent is right; the tool is absent.

---

## 3. Changeability & Debuggability — Score: 7.6/10

| Sub-dimension         | Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Changeability**     | **8** | Injection makes provider swaps cheap — replacing Firebase Storage with R2 rewrites `storageService.js` (28 lines) and nothing else; the tests that inject a fake bucket keep passing untouched. **Deduction:** no static types means every rename is a grep, and the duplicated like/comment logic across two pages doubles the edit surface                                                                                                                                                                                                                                                         |
| **Reachability**      | **6** | Every route has a client caller; every component is mounted. But **11 exported symbols have no importer outside their own module**: `MAX_AVATAR_BYTES`, `ALLOWED_IMAGE_TYPES` (`app.js`), `canonicalPair`, `PRIVATE_FIELDS` (`userRepository.js`), `toApiPost` (`postRepository.js`), `firebaseUid`, `searchQuery` (`schemas/index.js`), `loadServiceAccount` (`config/firebase.js`), `fakeAuth`, `fakeBucket`, `TEST_ENV`, `silentLogger` (`testApp.js`). And **one genuinely dead method**: `userRepository.fieldsFor` (`userRepository.js:23`) is on the repository object and invoked by nothing |
| **Debuggability**     | **9** | pino structured logging, `pino-http` per-request, credential redaction, and an error handler that logs the full error while returning a generic message (`errorHandler.js:38-41`). Configuration fails at boot with a list of exactly what is missing (`env.js:65-70`), and `firebase.js:30` names the absent variables. **Deduction:** `server.js:52` falls back to `console.error(err.message)`, discarding the stack at the one moment it matters most; no request-id correlation                                                                                                                 |
| **Testability**       | **8** | **Reverse check passes cleanly.** There are no re-export shims, no patch-only seams, no indirection existing solely to be mocked. The injection is the correct shape independently of testing. **Deductions:** hand-stubbed Prisma means tests encode exact call shapes (`findUnique.mock.calls[0][0]`), so a repository refactor breaks tests unrelated to it; the client has no test harness at all                                                                                                                                                                                                |
| **Error Handling**    | **9** | Single exit point; `ApiError` taxonomy; Prisma code translation (`P2002`→409, `P2025`→404, `P2003`→404); multer and malformed-JSON normalization. Client-side, `apiClient.js` normalizes the error envelope into `ApiRequestError`, optimistic updates roll back on failure (`PostsPage.js:79-82`), and a 404 on delete deliberately leaves the post gone. **Deduction:** a revoked session surfaces as a red banner rather than a redirect to sign-in                                                                                                                                               |
| **State Management**  | **6** | Server is stateless. `AuthContext` is correctly memoized. **Deduction:** client server-state is hand-rolled per page — `PostsPage` holds 5 `useState`s, `AllUsers` 6, each re-implementing loading/error/pagination. There is no cache: navigating away and back refetches everything. Two pages hold overlapping copies of post state with duplicated mutation logic                                                                                                                                                                                                                                |
| **Configuration**     | **9** | `env.js` is a zod schema with defaults, coercion, and a cross-field `refine` enforcing exactly one of `FIREBASE_SERVICE_ACCOUNT_JSON`/`_PATH`, failing with a readable list. `.env.example` is complete. **Deduction:** the client requires a second duplicate `.env` because CRA cannot read the root one — documented in `CLAUDE.md` as a known trap, which makes it a known trap rather than a fixed problem                                                                                                                                                                                      |
| **Code Organization** | **6** | Server structure is clean and consistently followed. Client carries the mixed casing, the three CSS systems, the untokenized 1,172-line stylesheet, the broken lint, and 27 unformatted files                                                                                                                                                                                                                                                                                                                                                                                                        |

### Key Risks

1. **No types plus no client tests means the client refactor is unguarded.**
   The 52 server tests will catch a broken API contract. Nothing at all will catch
   a broken React component — Stages 4, 6, and 7 of the plan rewrite most of them.
   _The client build is currently the only regression signal that exists._
2. **14 high-severity advisories are structural, not patchable.** Every one runs
   through `react-scripts`; `npm audit fix` cannot resolve them while CRA remains.
   Stage 1 (Vite) eliminates the entire set as a side effect.
3. **`checks.sh all` cannot go green today.** `npm run lint` fails outright, so any
   automation gating on a green toolchain is blocked until Stage 0 lands.

---

## Overall Summary

| Dimension                     | Score      |
| ----------------------------- | ---------- |
| Modularity & SOLID            | **7.5/10** |
| Guidelines & Policy           | **6.2/10** |
| Changeability & Debuggability | **7.6/10** |
| **Overall**                   | **7.1/10** |

The server would score around 8.5 on its own. The client and the toolchain are
what pull the number down — which is precisely what the refactor plan targets.

### Top 5 Actionable Improvements (Priority Order)

1. **TypeScript end to end.** Type safety scores 2/10 and is the largest single
   deduction in the review. With Prisma and zod already in place, most types are
   derived rather than written. _(Plan Stages 3–5)_
2. **CRA → Vite.** Removes all 14 high-severity advisories at once, since every
   one is transitive through `react-scripts`. _(Plan Stage 1)_
3. **Repair the toolchain.** `npm run lint` currently fails; `prettier --check`
   fails on 27 files. Nothing can be gated on "green" until both pass.
   _(Plan Stage 0)_
4. **Client test infrastructure.** Zero tests today against 21 components and
   pages about to be rewritten. Vitest + Testing Library + MSW. _(Plan Stage 9)_
5. **Adopt TanStack Query.** Removes the duplicated mutation logic across
   `PostsPage`/`SearchResults` and the 5–6 `useState` blocks per page, and adds
   the caching the app currently lacks. _(Plan Stage 6)_

**Quick wins, unrelated to the plan (under an hour, no risk):** delete the 11
unreferenced exports and the dead `fieldsFor` method; fix the `Dashbord` typo;
run `prettier --write .`; decide explicitly whether friend lists are public and
document the answer either way.

### What NOT to Change

Each item below was verified to have a live runtime caller, not merely to look
sound:

- **The composition root.** `createApp({ env, auth, bucket, prisma, logger })` in
  `app.js:40`, called from `server.js:20` in production and `testApp.js:39` in
  tests. This is what makes the whole suite possible; preserve it verbatim
  through the TypeScript migration.
- **The controller/repository split.** Verified: `postController.js` contains no
  Prisma call, and every query in `postRepository.js` is reached through it.
- **`.strict()` on write schemas.** Verified by `authorization.test.js:33-45` — an
  injected `id` in the registration body is rejected outright rather than
  silently ignored. This is the exact bug class v1 shipped.
- **The single-exit error handler.** Reached by every route via Express 5's
  automatic async rejection forwarding, which is why no controller has a
  `try/catch` except around Prisma codes it translates.
- **Database-level invariants.** Composite PK on `likes`, `CHECK` on
  `friendships`, `pg_trgm` GIN indexes — all confirmed present in
  `migration.sql`. Do not reimplement any of them in application code.
- **Magic-byte upload verification.** `imageType.js:32`, called from
  `userController.js:132`. Note for Stage 8: moving to presigned direct-to-R2
  uploads removes the server from the upload path and would bypass this check —
  it needs a deliberate replacement, not deletion.
- **The comment style.** Explaining _why_ with reference to the bug being
  prevented is the most valuable documentation in the repository.

# Kikar

A social platform where people write posts, like and comment on each other's
posts, and connect as friends.

Originally two repositories built in 2021–2025; consolidated and rebuilt in
2026. This document describes what the code actually does — see
[What changed in v2](#what-changed-in-v2) for the rebuild, and
[Known gaps](#known-gaps) for what is deliberately still missing.

---

## Stack

| Layer      | Choice                                        | Why |
|------------|-----------------------------------------------|-----|
| Client     | React 18, React Router 5, Create React App     | Existing UI, upgraded in place |
| API        | Node 22, Express 5                             | Express 5 forwards async errors to the error handler natively |
| Data       | PostgreSQL 17, Prisma 7                        | Relational data with real constraints and indexed search |
| Identity   | Firebase Auth                                  | Keeps passwords out of this system entirely |
| Files      | Firebase Storage                               | Avatar images |
| Validation | zod                                            | One schema language for both request bodies and environment config |
| Logging    | pino                                           | Structured JSON in production, readable in development |
| Container  | Docker, nginx                                  | Multi-stage builds, non-root runtime |

**Identity is on Firebase, data is in PostgreSQL.** A user's `id` in the
database *is* their Firebase UID, so there is no second source of truth for who
someone is, and no password ever reaches this codebase. Every API request
carries a Firebase ID token, which the server verifies with `firebase-admin`.

---

## Running it

### Prerequisites

- Node.js 20 or newer
- Docker (for PostgreSQL — or point `DATABASE_URL` at any Postgres instance)
- A Firebase project with Email/Password authentication enabled

### Setup

```bash
git clone <this repository>
cd kikar
npm install

cp .env.example .env
# Fill in the Firebase values. Everything else has a working local default.
```

You need two things from Firebase:

1. **Web config** (Project settings → General → Your apps) → the
   `REACT_APP_FIREBASE_*` values.
2. **Service account key** (Project settings → Service accounts → Generate new
   private key) → either paste the JSON into `FIREBASE_SERVICE_ACCOUNT_JSON` or
   save the file outside the repository and point
   `FIREBASE_SERVICE_ACCOUNT_PATH` at it.

> The service account key grants full administrative access to your Firebase
> project. It must never be committed. `.gitignore` blocks the usual filenames,
> but the safe habit is to keep it outside the working tree.

### The whole stack

```bash
docker compose up --build
```

Client on <http://localhost:3000>, API on <http://localhost:5000>. Migrations
are applied automatically on startup.

### Piece by piece

```bash
docker compose up db -d                       # just PostgreSQL
npm run db:migrate --workspace=@kikar/server  # create the schema
npm run dev                                   # client and server together
```

### Importing the old Firestore data

If you have data in the original Firestore project:

```bash
npm run db:import --workspace=@kikar/server -- --dry-run   # report only
npm run db:import --workspace=@kikar/server                # write
```

The script unpacks the embedded `likes`, `comments`, and `friends` arrays into
rows, reports anything referencing a document that no longer exists, and is
safe to re-run.

---

## Layout

```
apps/
  client/            React application
    src/api/         One module per resource, the only place URLs appear
    src/lib/         Axios instance that attaches the Firebase ID token
  server/
    prisma/          Schema and SQL migrations
    scripts/         Firestore import
    src/
      config/        Environment parsing, Firebase initialization
      controllers/   HTTP handling, no data access
      middleware/    Authentication, validation, error handling
      repositories/  All database access
      routes/        Express routers
      schemas/       zod request schemas
    tests/           Jest and supertest
```

Dependencies are passed in rather than imported: `createApp({ env, auth, bucket,
prisma, logger })`. That is what lets the test suite run the real application
against a fake token verifier and a stub Prisma client, with no database and no
network.

---

## API

Every route below requires `Authorization: Bearer <firebase-id-token>`.
`/health` is the only public endpoint.

| Method   | Path                             | Notes |
|----------|----------------------------------|-------|
| `GET`    | `/health`                        | Public — for load balancer checks |
| `POST`   | `/api/users`                     | Creates the caller's own profile |
| `GET`    | `/api/users`                     | Paginated |
| `GET`    | `/api/users/search?q=`           | Minimum 2 characters |
| `GET`    | `/api/users/:id`                 | Private fields only when `:id` is the caller |
| `PATCH`  | `/api/users/:id`                 | Caller only |
| `PUT`    | `/api/users/:id/avatar`          | Caller only, multipart, 5 MB limit |
| `GET`    | `/api/users/:id/friends`         | |
| `GET`    | `/api/users/:id/friends/:friendId` | Friendship check |
| `POST`   | `/api/users/:id/friends`         | Caller only |
| `DELETE` | `/api/users/:id/friends/:friendId` | Caller only |
| `GET`    | `/api/posts`                     | Newest first, keyset-paginated |
| `POST`   | `/api/posts`                     | Author taken from the token |
| `GET`    | `/api/posts/search?q=`           | |
| `DELETE` | `/api/posts/:postId`             | Author only |
| `PUT`    | `/api/posts/:postId/like`        | Idempotent |
| `DELETE` | `/api/posts/:postId/like`        | Idempotent |
| `GET`    | `/api/posts/:postId/comments`    | Paginated |
| `POST`   | `/api/posts/:postId/comments`    | |

Errors are always `{ "error": { "message": string, "details"?: [...] } }`.
Internal failures return a generic message; the details go to the logs.

Lists are keyset-paginated: pass the `nextCursor` from the previous response as
`?cursor=`. A `null` cursor means the end.

---

## Data model

```
users ──< posts ──< comments
  │         └────< likes
  └──< friendships >──┘
```

Likes, comments, and friendships are tables. In the Firestore version they were
arrays inside the parent document, which caused two specific problems:

- **Lost updates.** Liking a post read the `likes` array, appended to it, and
  wrote it back. Two people liking at the same moment both read the same
  starting array, and the second write erased the first. `likes` now has a
  composite primary key of `(postId, userId)`, so a duplicate is rejected by
  Postgres rather than resolved by whoever writes last.
- **Half-written friendships.** Befriending appended to *both* users' `friends`
  arrays in two separate, untransacted writes. If the second failed, A was
  friends with B while B was not friends with A. A friendship is now one row
  with `userAId < userBId` enforced by a `CHECK` constraint, so the asymmetric
  state cannot be represented.

Search uses `pg_trgm` GIN indexes. The old implementation downloaded the entire
`users` or `posts` collection and filtered it in Node on every request.

---

## Testing

```bash
npm run test --workspace=@kikar/server
```

52 tests over four areas:

- **`auth.test.js`** — every data route rejects missing, malformed, and forged
  tokens; `/health` stays open.
- **`authorization.test.js`** — a user cannot edit another profile, delete
  another's post, or befriend on someone else's behalf; a `userId` in the
  request body never influences an ownership decision; private fields are not
  selected for other users.
- **`validation.test.js`** — bad input is rejected at the edge, page sizes are
  capped, unknown fields are refused, and internal error text never reaches the
  response body.
- **`avatarUpload.test.js`** — an upload is identified by its magic bytes, so
  arbitrary content declaring `Content-Type: image/png` is refused; a user
  cannot replace someone else's avatar.

CI additionally builds the client, applies the migrations against a real
PostgreSQL service to prove they run from empty, and builds both images.

---

## What changed in v2

<details>
<summary>Security</summary>

- **The API had no authentication.** Not weak authentication — none. There was
  no middleware, and no route checked a token. Anyone who knew the URL could
  read every profile, rewrite any of them, add friends on other people's behalf,
  and delete any post.
- **Post deletion trusted the request body.** `deletePost` looked for
  `req.user.uid`, then fell back to `req.body.userId` — and nothing ever
  populated `req.user`. Sending the author's id was enough to delete their post.
- **The search endpoint leaked private data.** A comment reading
  `// Remove sensitive information` sat directly above the line that returned
  every matched user's email, home address, and date of birth to any caller.
- **Errors echoed internals.** The handler returned `err.message` verbatim.
- **A Firebase service account key was committed** and remained reachable in the
  published history from 2021. It has been removed from the rewritten history.
  The key belonged to `moveo-de052`, an earlier Firebase project for this app,
  whose service account has since been deleted — which permanently invalidates
  every key issued to it. See
  [docs/SECURITY-REMEDIATION.md](docs/SECURITY-REMEDIATION.md) for how that was
  verified.
</details>

<details>
<summary>Bugs fixed</summary>

- `getFirstComment` ran `where("comments", "array-contains", { id })` against
  an object literal that could never match a stored comment, and read a route
  parameter (`commnetID`) that the route did not define.
- `GET /posts` returned **404** when there were simply no posts yet.
- Avatar upload listed the whole storage prefix and deleted the first object
  whose name *contained* the user's id — a substring match that could delete
  another user's picture — then wrote its response from inside a stream callback
  after a possible earlier response.
- The signup flow created the Firebase account first and the profile second with
  no rollback, so a failure in between left an account that could sign in but
  had no profile, and no path to recovery.
- Password validation required 3 characters while telling the user 6.
- `"Failed: " + err.response?.data?.message || err.message` — `+` binds tighter
  than `||`, so the fallback never ran and users saw `undefined`.
- `index.html` loaded Bootstrap 4.5 from a CDN while `index.js` imported
  Bootstrap 5.1 from npm, applying two incompatible versions to one page.
- Comment submission pushed the raw input string into a list of comment
  objects, which is why the markup carried a `JSON.stringify` fallback for
  comments that had no `.content`.
</details>

<details>
<summary>Performance</summary>

- **The feed was 41 requests.** Every `PostCard` independently fetched its
  author's profile and its own comment list on mount. Posts now arrive with the
  author embedded and likes and comments as counts: one request. Comments load
  when a reader opens them.
- **Avatars cost a round trip each.** Three components called the Firebase
  Storage SDK to resolve a download URL per avatar per render, and threw for
  every user who had never uploaded one. The URL is a column now.
- **Nothing was paginated.** Every list returned the entire collection.
- **Search scanned everything.** Now indexed.
</details>

<details>
<summary>Dependencies and tooling</summary>

- The client shipped `firebase-admin` — a server SDK, in the browser bundle —
  plus `clarifai`, `node-uuid`, `acorn`, `cors`, and `web-vitals`, none of which
  were imported. `package.json` was still named `"face"`, from a different
  project.
- The server carried `axios`, `bcrypt`, `body-parser`, `express-validator`,
  `jsonwebtoken`, the Firebase *client* SDK, and a package called `save`, none
  of them used.
- `react-scripts` 4 → 5, which removes the `--openssl-legacy-provider` flag the
  start and build scripts needed to run at all.
- `react-bootstrap` 1 (Bootstrap 4 markup) → 2, matching the Bootstrap 5 CSS
  that was already installed.
- `.github/workflows/npm-publish.yml` installed dependencies and printed
  `node -v`. It did not build, test, or publish anything. Replaced with CI that
  runs the test suite, builds the client, applies migrations against a real
  PostgreSQL instance, and builds both images.
- The server Dockerfile ran `nodemon` — a development file watcher — as root in
  production, and used `npm install` rather than `npm ci`.
- Three files were unreachable code: `services/avatarService.js` referenced an
  undefined variable and had no importers, `config/firebase.js` required a
  `serviceAccountKey.json` that does not exist, and `models/userModel.js` was a
  comment.
</details>

---

## Known gaps

Stated plainly rather than implied away:

- **No friend request flow.** Adding a friend is immediate and one-sided in the
  UI — there is no accept or reject step. The original README described one; the
  code never had it.
- **No notifications.** The original README advertised real-time notifications.
  Nothing of the sort existed then or now.
- **Avatars are public objects.** `makePublic()` means anyone with the URL can
  read one. Signed URLs would be the fix.
- **No refresh-token handling beyond the SDK's.** A revoked session surfaces as
  a 401 the UI reports as an error rather than redirecting to sign-in.
- **The client has no tests.** The server suite covers the security-critical
  paths; the React components are unverified.
- **Create React App is deprecated.** It builds and runs fine, but it is no
  longer maintained. Vite is the natural next step and would cut the install
  from roughly 2,300 packages to a few hundred.
- **Avatars are checked but not re-encoded.** Uploads are identified by their
  magic bytes rather than the declared Content-Type, but the original file is
  stored as-is — a malformed image carrying a valid signature still gets through.
  Re-encoding through `sharp` would close that.

---

## Further reading

- [docs/SECURITY-REMEDIATION.md](docs/SECURITY-REMEDIATION.md) — the leaked
  service account key: what it was, how it was confirmed dead, and the
  procedure had it still been live
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploying to AWS, with costs

---

## License

MIT

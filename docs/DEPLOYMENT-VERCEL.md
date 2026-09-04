# Deploying to Vercel and Neon

Stage 2 of `REFACTOR-PLAN.md`. `DEPLOYMENT.md` describes the AWS shape the
project was built for; this is the free one it actually runs on.

Everything in the repository is already done. What is left is account setup,
which cannot be scripted — it is roughly fifteen minutes of clicking.

## What is already in place

| File                            | What it does                                                           |
| ------------------------------- | ---------------------------------------------------------------------- |
| `api/index.mjs`                 | Wraps `createApp()` from `apps/server/dist/` as a serverless function  |
| `vercel.json`                   | Builds the server then the client, routes `/api/*` and `/health` to it |
| `apps/server/tsconfig.json`     | Compiles the server to the CommonJS `dist/` the function imports       |
| `apps/server/prisma.config.js`  | Runs migrations through `DIRECT_URL`, not the pooler                   |
| `apps/server/src/config/env.ts` | Accepts the optional `DIRECT_URL`                                      |

Verified locally without a network or a database, and re-verified by
`checks.sh smoke` on every push: the handler boots, `/health` answers
`200 {"status":"ok"}`, and `/api/users` without a token answers `401`. That
check builds the server first and loads `dist/`, not `src/`, so it is testing
the same files the deployed function loads.

The server is compiled from stage 3 of `REFACTOR-PLAN.md` onward, which is why
`buildCommand` names two builds. **A deploy that builds only the client has no
`apps/server/dist/`, and `api/index.mjs` imports it at the top level — so the
function never loads and every request, `/health` included, returns
`FUNCTION_INVOCATION_FAILED`.** That is the same symptom as the jose failure
below and it is not the same cause; check that the build log ran two builds
before going anywhere near the dependency tree.

One limit changes meaning on this target and is worth knowing before you rely
on it: the rate limiter is per-instance here rather than global — see the note
at `apps/server/src/app.ts`. (Vercel also caps a request body at 4.5 MB, below
the 5 MB avatar limit — this does not bite avatars, though: stage 8a moved
those to a presigned POST straight to R2 (its own policy conditions cap size
and content type before the object can even land), so avatar bytes never pass
through the Vercel function body at all. See the R2 CORS step below for what
replaced it as the thing to get right.)

## The one thing that decides whether this works

Neon gives you **two** connection strings and they are not interchangeable.

- The **pooled** one has `-pooler` in the hostname. It is pgbouncer in
  transaction mode. This is what the application uses, because serverless runs
  many instances at once and each one holding its own connections is how a
  Postgres connection limit gets exhausted under mild load.
- The **direct** one has no `-pooler`. Migrations must use this: a
  transaction-mode pooler cannot hold the session state that DDL needs, and
  migrations run through it fail in ways that look random.

Getting these backwards is the most common way this stack fails, and the failure
does not look like a configuration error.

```
DATABASE_URL = the -pooler one     (the app)
DIRECT_URL   = the plain one       (migrations)
```

## Steps

**1. Neon** — create a project, region close to you.

Copy both connection strings from the dashboard. Then, from your machine:

```bash
DIRECT_URL='<the direct one>' npm run db:deploy --workspace=@kikar/server
```

This creates the schema. It is the same command CI already runs against a
throwaway Postgres, so if CI is green this will work.

**2. Vercel** — import the GitHub repository. It reads `vercel.json`; leave the
framework preset as "Other" and change nothing it offers to detect.

**3. Cloudflare R2** — create the bucket avatars are stored in.

- **Create a bucket**, named whatever `R2_BUCKET_NAME` will be set to below.
- **Enable public access** for it (bucket → Settings → Public access → Allow
  Access, or attach a custom domain, whichever becomes `R2_PUBLIC_URL` below).
  Avatar URLs are served straight from that address, unauthenticated — there is
  no signed-read path in this codebase.
- **Set a CORS policy** on the bucket (bucket → Settings → CORS Policy). The
  client POSTs avatar bytes directly to a presigned R2 upload policy
  (`apps/client/src/api/users.ts`) — a cross-origin request from the Vercel
  domain that triggers a browser preflight. Without a CORS rule allowing it,
  every avatar upload fails in production even with every other setting
  correct:

  ```json
  [
    {
      "AllowedOrigins": ["https://<your-vercel-domain>"],
      "AllowedMethods": ["POST"],
      "AllowedHeaders": ["*"]
    }
  ]
  ```

  The Vercel domain is not known until after the first deploy (step 5 below) —
  come back and fill this in once you have it, and again for any Preview
  domain you rely on.

Generate an R2 API token scoped to this bucket (Manage R2 API Tokens) for the
`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` values below.

**4. Environment variables** in Vercel, for Production and Preview both:

| Variable                        | Value                                                                     |
| ------------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Neon **pooled** string                                                    |
| `DIRECT_URL`                    | Neon **direct** string                                                    |
| `DATABASE_SSL`                  | `true` — Neon always requires TLS                                         |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | the whole service account JSON, on one line                               |
| `R2_ACCOUNT_ID`                 | Cloudflare account id                                                     |
| `R2_ACCESS_KEY_ID`              | R2 API token access key id                                                |
| `R2_SECRET_ACCESS_KEY`          | R2 API token secret                                                       |
| `R2_BUCKET_NAME`                | the R2 bucket avatars are stored in                                       |
| `R2_PUBLIC_URL`                 | the bucket's public base URL (r2.dev subdomain or a custom domain)        |
| `CORS_ORIGINS`                  | your Vercel URL — fill in after the first deploy                          |
| `VITE_API_URL`                  | leave unset — a production build already resolves to a same-origin `/api` |
| `VITE_FIREBASE_*`               | the six web-config values, same as `apps/client/.env`                     |

Do not set `FIREBASE_SERVICE_ACCOUNT_PATH`. `env.ts` requires exactly one of the
two and fails at boot if both are present — which is the error you will see if
you paste both out of habit.

**Do not add `NODE_ENV=production`.** It looks harmless and it breaks the build:
npm's `omit` config defaults to `dev` whenever `NODE_ENV` is `production`, so
`npm ci` would skip devDependencies — and `vite` is one of them. The build then
fails with `vite: not found`. Vercel already sets `NODE_ENV` correctly in the
function runtime, so there is nothing to add. `vercel.json` passes
`--include=dev` as a second line of defence.

**5. Deploy.** Then set `CORS_ORIGINS` to the URL Vercel gave you and redeploy,
because the first deploy is what tells you the domain. This is also the moment
to go back and add that domain to the R2 CORS policy from step 3 — avatar
uploads will 200 on everything except the direct-to-R2 POST until that is done.

**6. Firebase** — add the Vercel domain under Authentication → Settings →
Authorized domains, or sign-in will be rejected by Firebase rather than by us.

## The one that actually broke it: require() of an ESM-only package

The API returned `FUNCTION_INVOCATION_FAILED` for every request, `/health`
included, because the server could not start at all:

    ERR_REQUIRE_ESM: require() of ES Module .../jose/... from .../jwks-rsa/src/utils.js

jose 6 ships ESM only and jwks-rsa still reaches it with `require()`. Node has
supported that since 22.12, so it works on any modern developer machine — but a
Vercel function is loaded through the platform's own CommonJS loader, which does
not implement it. `patches/jwks-rsa+4.1.0.patch` fixes the two call sites, and
`postinstall: patch-package` reapplies it on every install, Vercel's included.

**The error message is misleading and cost four wrong fixes here.** It reads
exactly like an outdated Node version, and it is not: the deployed function runs
Node 24. If something like this happens again, deploy a probe that imports
nothing and reports what it can load, before changing anything. That took five
minutes to write and settled in one request what four attempts had not.

## Two settings that are not in this repository

Both of these were found the hard way, on a deploy that returned
`FUNCTION_INVOCATION_FAILED` for every API request while the pages loaded fine.

### Node.js version — the project setting overrides package.json

Vercel keeps a Node.js Version under **Settings → General** and it wins over
`engines.node`, so raising that field alone does not move a project that was
imported under an older default. Changing the setting does not rebuild anything
either; a redeploy is needed.

Worth knowing, but **it was not the cause of the outage above** — the deployed
function already ran Node 24. This section is here so nobody spends time on it
twice.

### Region — match the function to the database

The function runs in the region the project was created with, which is not
necessarily near Neon. The `x-vercel-id` response header names it (`fra1` is
Frankfurt, `iad1` is Washington). If it does not match the Neon region, every
query crosses that distance twice.

Either create the Neon project in the matching region, or move the function by
adding to `vercel.json`:

```json
"regions": ["iad1"]
```

## Check it in this order

Each step isolates a different layer, so the first failure tells you where to
look instead of leaving you guessing.

```
/health           -> {"status":"ok"}   the function runs at all
/api/users        -> 401               routing and auth are wired
sign up in the UI                      Firebase domain is authorised
post something                         the pooled DB connection works
```

## Verify on the first deploy

One thing could not be checked from here, because it depends on how Vercel
rewrites a path before handing it to a function: whether Express receives
`/api/users` or just the rewritten `/api`.

The symptom to watch for is **everything answering 401, `/health` included**.
`requireAuth` is mounted before the `/api/*` routers, so if every request
arrives as a bare `/api`, it is rejected by auth before any route matches — and
`/health`, which lives at the root, never matches at all.

If that happens, log `req.url` at the top of the handler in `api/index.mjs` to
see what actually arrives, and adjust the rewrite from there. Do not reach for
`x-vercel-original-path`: that header does not exist, and an earlier draft of
this document recommended it — a fix that would have appeared to change nothing
while the outage continued.

## Known limit: resolved

Vercel caps a request body at 4.5 MB, and the avatar limit is 5 MB — until
`REFACTOR-PLAN.md` stage 8a this was a live gap for anything uploaded between
the two. It no longer is: avatars upload with a presigned POST straight to R2
(`apps/server/src/services/storageService.ts`), whose own policy conditions
enforce the size cap and an `image/*` Content-Type before the object can even
land, so avatar bytes never pass through the Vercel function body at all,
regardless of size. What replaced it as the thing to get right in production
is R2's own CORS policy — see step 3 above.

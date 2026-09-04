/**
 * Vercel serverless entry point for the API.
 *
 * This file lives at the repository root rather than in `apps/server/` because
 * that is where Vercel looks for functions — `/api/*` at the project root is
 * the platform's convention, not something `vercel.json` can relocate. It is a
 * deployment adapter and nothing more: every line of application code it
 * touches lives in the server workspace, unchanged.
 *
 * ## Why this is `.mjs` when the entire server is CommonJS
 *
 * As a CommonJS file, this could not load at all on Vercel. The deployed
 * function died before running a line of project code:
 *
 *     Error [ERR_REQUIRE_ESM]: require() of ES Module .../jose/dist/webapi/index.js
 *     from .../jwks-rsa/src/utils.js not supported
 *
 * The chain is firebase-admin → jwks-rsa → jose 6, and jose 6 ships ESM only
 * while jwks-rsa still reaches it with `require()`. Node itself has supported
 * that since 22.12, and a probe deployed alongside this reported the function
 * runs on Node v24.18.0 — so the runtime was never the problem, despite the
 * error reading exactly like an outdated one. What differs on Vercel is that a
 * CommonJS entry point is compiled and loaded through the platform's own
 * loader, which does not implement require(esm).
 *
 * An ESM entry point is loaded by Node directly, so the whole dependency graph
 * — CommonJS parts included — goes through the loader that does support it.
 *
 * ## Why the imports point at `dist/` rather than `src/`
 *
 * The server is TypeScript from stage 3 of `REFACTOR-PLAN.md` onward, and tsc
 * compiles it to CommonJS in `apps/server/dist/` (`npm run build
 * --workspace=@kikar/server`). So this file still imports plain JavaScript —
 * the same shape that is proven to load above — with a build step in front of
 * it rather than a different module format. Compiling to ESM instead would
 * change the very thing that made the deployment work.
 *
 * `vercel.json` therefore has to build the server as well as the client. These
 * are top-level imports, so a deploy that skipped that build does not fall
 * through to the 503 below — the module never loads and every request,
 * `/health` included, returns FUNCTION_INVOCATION_FAILED.
 *
 * The imports below are ESM importing CommonJS, which Node exposes as a default
 * export, hence the destructuring rather than named imports.
 *
 * ## How this differs from `apps/server/src/server.ts`
 *
 * - **No `app.listen`.** The platform invokes this handler per request.
 * - **No `prisma.$connect()`.** server.ts connects eagerly so a bad
 *   DATABASE_URL fails at boot; here that would add a round trip to every cold
 *   start and turn a transient blip into a failed invocation. Prisma connects
 *   on first query.
 * - **No SIGTERM handling.** Draining is the platform's job.
 * - **A single pooled connection.** See the note at the pool below.
 */

import envModule from "../apps/server/dist/config/env.js";
import firebaseModule from "../apps/server/dist/config/firebase.js";
import storageModule from "../apps/server/dist/config/storage.js";
import prismaModule from "../apps/server/dist/lib/prisma.js";
import loggerModule from "../apps/server/dist/lib/logger.js";
import appModule from "../apps/server/dist/app.js";

const { parse } = envModule;
const { initializeFirebase } = firebaseModule;
const { createR2Bucket } = storageModule;
const { createPrismaClient } = prismaModule;
const { createLogger } = loggerModule;
const { createApp } = appModule;

// Built once per container and reused by every warm invocation. Rebuilding per
// request would re-parse the environment, re-initialise firebase-admin, and
// open a new connection pool each time.
let app;

const getApp = () => {
  if (app) return app;

  const env = parse();
  const logger = createLogger(env);
  const { auth } = initializeFirebase(env);
  const bucket = createR2Bucket(env);

  // One connection per instance, not the pg default of ten.
  //
  // Serverless scales by running many instances at once, so pool size is
  // multiplied by the number of live containers rather than shared with them.
  // Ten each is how a serverless deployment exhausts a Postgres connection
  // limit under mild load. DATABASE_URL must point at Neon's *pooled* endpoint,
  // which is the pgbouncer that actually multiplexes these; migrations use
  // DIRECT_URL instead, because a transaction-mode pooler cannot run them.
  const prisma = createPrismaClient(env, { max: 1 });

  app = createApp({ env, auth, bucket, prisma, logger });
  return app;
};

export default function handler(req, res) {
  // server.ts ends in `main().catch(err => console.error(err.message))` so that
  // a configuration failure prints one readable line. Without the equivalent
  // here, a bad env var throws out of the handler and the caller gets the
  // platform's generic failure page instead of this API's documented
  // `{ error: { message } }` shape — and the operator has to go digging in
  // function logs to learn that R2_BUCKET_NAME was misspelled.
  //
  // `app` is only assigned after a successful build, so a failed boot is
  // retried on the next request rather than cached.
  let built;
  try {
    built = getApp();
  } catch (err) {
    console.error(err.message);
    // 503, not 500: the process is misconfigured, not the request. The body
    // carries no internal detail, per the rule in CLAUDE.md.
    return res
      .status(503)
      .json({ error: { message: "Service temporarily unavailable" } });
  }

  return built(req, res);
}

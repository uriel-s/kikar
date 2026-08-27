/**
 * Vercel serverless entry point for the API.
 *
 * This file lives at the repository root rather than in `apps/server/` because
 * that is where Vercel looks for functions — `/api/*` at the project root is
 * the platform's convention, not something `vercel.json` can fully relocate.
 * It is a deployment adapter and nothing more: every line of application code
 * it touches lives in the server workspace, unchanged.
 *
 * How this differs from `apps/server/src/server.js`, and why:
 *
 * - **No `app.listen`.** The platform invokes this handler per request; there
 *   is no port to bind.
 * - **No `prisma.$connect()`.** server.js connects eagerly so that a bad
 *   DATABASE_URL fails at boot rather than on the first request. Here, eagerly
 *   connecting would add a round trip to every cold start and turn a transient
 *   database blip into a failed invocation. Prisma connects on first query.
 * - **No SIGTERM handling.** Draining in-flight requests is the platform's job.
 * - **A single pooled connection.** See the pool note below.
 *
 * The app is built once per container and reused by every warm invocation.
 * Rebuilding it per request would re-parse the environment, re-initialize
 * firebase-admin, and open a new connection pool each time.
 */

const { parse } = require("../apps/server/src/config/env");
const { initializeFirebase } = require("../apps/server/src/config/firebase");
const { createPrismaClient } = require("../apps/server/src/lib/prisma");
const { createLogger } = require("../apps/server/src/lib/logger");
const { createApp } = require("../apps/server/src/app");

let app;

const getApp = () => {
  if (app) return app;

  const env = parse();
  const logger = createLogger(env);
  const { auth, bucket } = initializeFirebase(env);

  // One connection per instance, not the pg default of ten.
  //
  // Serverless scales by running many instances at once, so the pool size is
  // multiplied by the number of live containers rather than shared with them.
  // Ten each is how a serverless deployment exhausts a Postgres connection
  // limit under mild load. DATABASE_URL must point at Neon's *pooled* endpoint,
  // which is the pgbouncer in front of the database and is what actually
  // multiplexes these; migrations use DIRECT_URL instead, because pgbouncer in
  // transaction mode cannot run them.
  const prisma = createPrismaClient(env, { max: 1 });

  app = createApp({ env, auth, bucket, prisma, logger });
  return app;
};

module.exports = (req, res) => getApp()(req, res);

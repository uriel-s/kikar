import { parse } from "./config/env";
import { initializeFirebase } from "./config/firebase";
import { createR2Bucket } from "./config/storage";
import { createPrismaClient } from "./lib/prisma";
import { createLogger } from "./lib/logger";
import { createApp } from "./app";

const SHUTDOWN_GRACE_MS = 10_000;

const main = async () => {
  // Throws with a readable list of what is missing, before anything binds a port.
  const env = parse();
  const logger = createLogger(env);

  const prisma = createPrismaClient(env);
  const { auth } = initializeFirebase(env);
  const bucket = createR2Bucket(env);

  await prisma.$connect();
  logger.info("Connected to PostgreSQL");

  const app = createApp({ env, auth, bucket, prisma, logger });
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "Server listening");
  });

  /**
   * Drains in-flight requests before exiting.
   *
   * ECS and Kubernetes send SIGTERM and then kill the container; without this,
   * every request in flight at deploy time fails.
   */
  const shutdown = async (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Shutting down");
    const timer = setTimeout(() => {
      logger.error("Shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_GRACE_MS).unref();

    server.close(async () => {
      await prisma.$disconnect();
      clearTimeout(timer);
      logger.info("Shutdown complete");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

main().catch((err: unknown) => {
  // The logger may not exist yet if config parsing is what failed, so this
  // prints rather than logs.
  //
  // Narrowed the way config/firebase.ts's reason() does. Everything that can
  // reject here — parse(), initializeFirebase(), prisma.$connect() — raises a
  // real Error, so this reads identically to the plain `err.message` it
  // replaces; the fallback only covers the case that would otherwise have put
  // the word "undefined" in an operator's single clue.
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

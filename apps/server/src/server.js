const { parse } = require("./config/env");
const { initializeFirebase } = require("./config/firebase");
const { createPrismaClient } = require("./lib/prisma");
const { createLogger } = require("./lib/logger");
const { createApp } = require("./app");

const SHUTDOWN_GRACE_MS = 10_000;

const main = async () => {
  // Throws with a readable list of what is missing, before anything binds a port.
  const env = parse();
  const logger = createLogger(env);

  const prisma = createPrismaClient(env);
  const { auth, bucket } = initializeFirebase(env);

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
  const shutdown = async (signal) => {
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

main().catch((err) => {
  // The logger may not exist yet if config parsing is what failed.
  console.error(err.message);
  process.exit(1);
});

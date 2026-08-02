const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../generated/prisma");

/**
 * Builds the Prisma client over the node-postgres driver adapter.
 *
 * Prisma 7 no longer ships its own query engine binary; the connection is made
 * by pg, which is what lets the same client talk to a local container and to
 * RDS with TLS without a different build.
 */
const createPrismaClient = (env) => {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // RDS presents an Amazon-signed certificate. Verifying it properly needs the
    // RDS CA bundle mounted into the image; until then, TLS is on but the chain
    // is not verified. Local development connects without TLS at all.
    ...(env.DATABASE_SSL ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  return new PrismaClient({ adapter });
};

module.exports = { createPrismaClient };

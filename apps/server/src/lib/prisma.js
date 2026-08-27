const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../generated/prisma");

/**
 * Builds the Prisma client over the node-postgres driver adapter.
 *
 * Prisma 7 no longer ships its own query engine binary; the connection is made
 * by pg, which is what lets the same client talk to a local container and to
 * RDS with TLS without a different build.
 */
const createPrismaClient = (env, poolOptions = {}) => {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // Certificate verification is on by default. RDS certificates chain to
    // Amazon Root CA 1, which Node already trusts, so this works without
    // mounting a CA bundle. Encrypting the connection while accepting any
    // certificate would leave it open to anyone on the network path — which is
    // most of what TLS is there to prevent.
    //
    // DATABASE_SSL_REJECT_UNAUTHORIZED=false exists for hosts using a private
    // CA, and is a deliberate, logged downgrade rather than the default.
    ...(env.DATABASE_SSL
      ? { ssl: { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED } }
      : {}),

    // Last, so a caller can override the pg pool defaults. The only caller that
    // does is the Vercel handler, which sets `max: 1`: serverless multiplies the
    // pool size by the number of live instances instead of sharing one, so the
    // pg default of ten per instance is how a deployment exhausts the database's
    // connection limit under mild load.
    ...poolOptions,
  });

  return new PrismaClient({ adapter });
};

module.exports = { createPrismaClient };

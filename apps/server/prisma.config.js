const path = require("node:path");

// Migrations run from the CLI, outside the app, so they load the root .env
// themselves rather than relying on src/config/env.js.
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});

module.exports = {
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrations: {
    path: path.join(__dirname, "prisma", "migrations"),
  },
  datasource: {
    // Migrations need a direct connection. Neon's pooled endpoint is pgbouncer
    // in transaction mode, which cannot hold the session-level state a
    // migration needs — DDL through it fails in ways that read as random.
    // DIRECT_URL is Neon's non-pooled address. Anywhere without a pooler there
    // is no DIRECT_URL and DATABASE_URL is already direct, so this falls
    // through to it unchanged.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
};

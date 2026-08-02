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
    url: process.env.DATABASE_URL,
  },
};

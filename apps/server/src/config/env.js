const path = require("node:path");
const { z } = require("zod");

// Load .env from the monorepo root so client and server share one file.
require("dotenv").config({
  path: path.resolve(__dirname, "../../../../.env"),
  quiet: true,
});

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  // Comma-separated allowlist. An empty value blocks all cross-origin browsers,
  // which is the safe default if someone forgets to configure it.
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres:// or postgresql:// connection string"
    ),

  // RDS terminates TLS; a local docker-compose Postgres does not.
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  FIREBASE_STORAGE_BUCKET: z.string().min(1, "FIREBASE_STORAGE_BUCKET is required"),

  // Exactly one of these must be set — see refine below.
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
});

/**
 * Parses and validates process.env, failing fast with a readable message.
 *
 * The old server started, logged "Failed to initialize Firebase", and then
 * silently refused to listen — leaving no server and no clear reason. Validating
 * up front turns that into one actionable error at boot.
 */
const parse = (source = process.env) => {
  const result = schema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const env = result.data;
  const hasJson = Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const hasPath = Boolean(env.FIREBASE_SERVICE_ACCOUNT_PATH);

  if (hasJson === hasPath) {
    throw new Error(
      "Invalid environment configuration:\n" +
        "  - set exactly one of FIREBASE_SERVICE_ACCOUNT_JSON or " +
        "FIREBASE_SERVICE_ACCOUNT_PATH " +
        `(currently ${hasJson ? "both are set" : "neither is set"})`
    );
  }

  return env;
};

module.exports = { parse, schema };

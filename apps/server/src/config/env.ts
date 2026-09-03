import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Load .env from the monorepo root so client and server share one file.
dotenv.config({
  path: path.resolve(__dirname, "../../../../.env"),
  quiet: true,
});

export const schema = z.object({
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

  // Optional, and only meaningful on a pooled host such as Neon, where
  // DATABASE_URL points at pgbouncer. Migrations cannot run through a
  // transaction-mode pooler, so prisma.config.js reaches for this instead and
  // falls back to DATABASE_URL when it is absent. The running application never
  // uses it: it wants the pooled address.
  DIRECT_URL: z.string().optional(),

  // RDS terminates TLS; a local docker-compose Postgres does not.
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  // Only set this to false for a database fronted by a private CA. Turning it
  // off keeps the connection encrypted but stops verifying who is on the other
  // end of it.
  DATABASE_SSL_REJECT_UNAUTHORIZED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),

  FIREBASE_STORAGE_BUCKET: z.string().min(1, "FIREBASE_STORAGE_BUCKET is required"),

  // Exactly one of these must be set — see refine below.
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
});

/**
 * The environment as the application sees it: the *parsed* shape, so
 * CORS_ORIGINS is already a string[] and the DATABASE_SSL pair are booleans.
 *
 * Consumers should take a `Pick` of this rather than the whole thing. Every
 * dependency here is injected — `createApp({ env, ... })` — and
 * `tests/helpers/testApp.ts` injects a four-field object as the real env. A
 * module that demands the full type makes that impossible to typecheck, and the
 * reflex fix is to widen or cast the fake, which throws away the checking this
 * type exists to provide.
 */
export type Env = z.infer<typeof schema>;

/**
 * Parses and validates process.env, failing fast with a readable message.
 *
 * The old server started, logged "Failed to initialize Firebase", and then
 * silently refused to listen — leaving no server and no clear reason. Validating
 * up front turns that into one actionable error at boot.
 */
export const parse = (source: unknown = process.env): Env => {
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

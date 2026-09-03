import pino from "pino";
import type { Env } from "../config/env";

// NODE_ENV only, not the whole Env. Nothing here is stylistic: the logger is an
// injected dependency, and tests/helpers/testApp.js builds a four-field stand-in
// for the environment. Asking for more than is read would make that stand-in
// untypeable and invite a cast that switches the checking off everywhere.
export const createLogger = (env: Pick<Env, "NODE_ENV">) =>
  pino({
    level:
      env.NODE_ENV === "test"
        ? "silent"
        : env.NODE_ENV === "production"
          ? "info"
          : "debug",
    // Human-readable in development, newline-delimited JSON in production so
    // CloudWatch and friends can parse it.
    transport:
      env.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss" },
          }
        : undefined,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
      ],
      remove: true,
    },
  });

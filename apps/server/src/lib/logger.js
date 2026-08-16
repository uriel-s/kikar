const pino = require("pino");

const createLogger = (env) =>
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

module.exports = { createLogger };

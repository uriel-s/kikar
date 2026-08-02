const pino = require("pino");
const { createApp } = require("../../src/app");

const TEST_ENV = {
  NODE_ENV: "test",
  PORT: 5000,
  CORS_ORIGINS: ["http://localhost:3000"],
  FIREBASE_STORAGE_BUCKET: "test-bucket",
};

// A real pino instance rather than a hand-rolled stub: pino-http reaches into
// the logger's internals, so a duck-typed fake throws at wiring time.
const silentLogger = pino({ level: "silent" });

/**
 * A stand-in for firebase-admin's Auth that accepts tokens of the form
 * "valid:<uid>" and rejects everything else.
 */
const fakeAuth = (users = {}) => ({
  verifyIdToken: async (token) => {
    const match = /^valid:(.+)$/.exec(token);
    if (!match) {
      throw new Error("Invalid token");
    }
    const uid = match[1];
    return { uid, email: users[uid]?.email ?? `${uid}@example.test` };
  },
});

const fakeBucket = () => ({
  file: () => ({
    save: async () => {},
    makePublic: async () => {},
    publicUrl: () => "https://storage.test/avatar",
  }),
});

/** Builds the real app wired to whatever fakes a test hands it. */
const buildTestApp = ({ prisma, users } = {}) =>
  createApp({
    env: TEST_ENV,
    auth: fakeAuth(users),
    bucket: fakeBucket(),
    prisma,
    logger: silentLogger,
  });

const authHeader = (uid) => ({ Authorization: `Bearer valid:${uid}` });

module.exports = { buildTestApp, authHeader, fakeAuth, fakeBucket, TEST_ENV, silentLogger };

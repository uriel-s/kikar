import pino from "pino";
import { createApp } from "../../src/app";
import type { CreateAppDeps } from "../../src/app";
import type { AvatarBucket } from "../../src/services/storageService";

const TEST_ENV = {
  NODE_ENV: "test",
  PORT: 5000,
  CORS_ORIGINS: ["http://localhost:3000"],
};

// A real pino instance rather than a hand-rolled stub: pino-http reaches into
// the logger's internals, so a duck-typed fake throws at wiring time.
const silentLogger = pino({ level: "silent" });

/**
 * The accounts fakeAuth() will vouch for, keyed by uid. Only `email` is read,
 * and only to override the address this file otherwise makes up from the uid.
 */
export interface FakeUsers {
  [uid: string]: { email?: string } | undefined;
}

/**
 * A stand-in for firebase-admin's Auth that accepts tokens of the form
 * "valid:<uid>" and rejects everything else.
 */
const fakeAuth = (users: FakeUsers = {}) => ({
  verifyIdToken: async (token: string) => {
    const match = /^valid:(.+)$/.exec(token);
    if (!match) {
      throw new Error("Invalid token");
    }
    const uid = match[1];
    return { uid, email: users[uid]?.email ?? `${uid}@example.test` };
  },
});

/**
 * A stand-in for R2: an in-memory object store keyed exactly like the real
 * bucket. `seed` has no counterpart on the real AvatarBucket — it exists so a
 * test can simulate the browser's direct PUT to R2, which in production never
 * touches this server at all.
 */
const fakeBucket = () => {
  const store = new Map<string, Buffer>();
  const contentTypes = new Map<string, string>();

  return {
    createUploadUrl: async (key: string) => `https://storage.test/upload/${key}`,
    // Mirrors the real bucket's HEAD-before-GET shape: reports size without
    // handing back the bytes, which is what lets the oversized-upload path be
    // rejected without ever downloading the object.
    headSize: async (key: string) => store.get(key)?.length ?? null,
    download: async (key: string) => store.get(key) ?? null,
    retagContentType: async (key: string, contentType: string) => {
      contentTypes.set(key, contentType);
    },
    delete: async (key: string) => {
      store.delete(key);
      contentTypes.delete(key);
    },
    publicUrl: (key: string) => `https://storage.test/${key}`,
    seed: (key: string, data: Buffer) => {
      store.set(key, data);
    },
    /** Test-only: what retagContentType last recorded for `key`, or undefined. */
    contentTypeOf: (key: string) => contentTypes.get(key),
  };
};

/**
 * A hand-stubbed Prisma client: a plain object carrying only the model methods
 * the route under test will actually reach — `{ user: { update } }`,
 * `{ post: { findMany } }`, or `{}` for a route that must be rejected before it
 * queries anything.
 */
export type PrismaStub = Record<string, unknown>;

/**
 * The argument a repository hands one of those stubbed methods.
 *
 * Deliberately loose. A single stub stands in for `findUnique`, `create`,
 * `update` and `findMany` across four files, and the assertions only ever read
 * `select` or `data` back out of it; the real `Prisma.*Args` types make both
 * optional, which would put a non-null assertion at every read.
 */
export interface PrismaCallArgs {
  data: Record<string, unknown>;
  select: Record<string, unknown>;
  where: Record<string, unknown>;
}

/**
 * The one type assertion in the suite, kept in a single named place.
 *
 * Every other dependency createApp takes is typed on what app.ts actually uses
 * — `Pick<Env, "CORS_ORIGINS">`, a verifier that is only `verifyIdToken`, an
 * `AvatarBucket` — so TEST_ENV, fakeAuth(), fakeBucket() and the silent pino
 * instance above all satisfy `CreateAppDeps` with no cast. `prisma`
 * is the exception: the repositories take the generated `PrismaClient`, a class
 * with hundreds of members that a suite with no database cannot honestly
 * produce. Asserting here rather than in each test file keeps that seam visible
 * and countable — it is one, and it should stay one.
 */
const asPrismaClient = (stub: PrismaStub | undefined): CreateAppDeps["prisma"] =>
  stub as unknown as CreateAppDeps["prisma"];

export interface TestAppOptions {
  prisma?: PrismaStub;
  users?: FakeUsers;
  bucket?: AvatarBucket;
}

/** Builds the real app wired to whatever fakes a test hands it. */
const buildTestApp = ({ prisma, users, bucket }: TestAppOptions = {}) =>
  createApp({
    env: TEST_ENV,
    auth: fakeAuth(users),
    bucket: bucket ?? fakeBucket(),
    prisma: asPrismaClient(prisma),
    logger: silentLogger,
  });

const authHeader = (uid: string) => ({ Authorization: `Bearer valid:${uid}` });

export { buildTestApp, authHeader, fakeAuth, fakeBucket, TEST_ENV, silentLogger };

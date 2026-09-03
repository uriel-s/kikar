import express from "express";
import type { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import pinoHttp from "pino-http";
import type { Options as PinoHttpOptions } from "pino-http";
import rateLimit from "express-rate-limit";

import type { PrismaClient } from "./generated/prisma";
import type { Env } from "./config/env";
import type { ImageMimeType } from "./lib/imageType";
import { createUserRepository } from "./repositories/userRepository";
import { createPostRepository } from "./repositories/postRepository";
import { createUserController } from "./controllers/userController";
import { createPostController } from "./controllers/postController";
import { createStorageService } from "./services/storageService";
import type { AvatarBucket } from "./services/storageService";
import { createUserRoutes } from "./routes/userRoutes";
import { createPostRoutes } from "./routes/postRoutes";
import { requireAuth } from "./middleware/auth";
import type { TokenVerifier } from "./middleware/auth";
import { notFound, errorHandler } from "./middleware/errorHandler";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Declared as the types lib/imageType.ts can actually recognise from magic
// bytes, so adding a fourth here without teaching the detector about it is a
// compile error rather than an upload that gets rejected after the fact.
// Widened to ReadonlySet<string> because multer only ever offers the declared
// Content-Type, which is a bare string — and a lie, which is why the stored
// type still comes from the bytes.
const ALLOWED_IMAGE_TYPES: ReadonlySet<string> = new Set<ImageMimeType>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
    return cb(null, true);
  },
});

/**
 * Everything createApp touches, so nothing is constructed at import time.
 *
 * Each field is typed on what this module actually needs rather than on the
 * concrete class that supplies it in production. That is what keeps
 * `tests/helpers/testApp.js` type-checkable: it injects a four-field stand-in
 * for the environment, a fake token verifier and a fake bucket, and a signature
 * naming `Env`, firebase-admin's `Auth` or `@google-cloud/storage`'s `Bucket`
 * could only be satisfied by casting those away — which is how a type-checked
 * refactor stops checking the dependency injection it exists to protect.
 */
export interface CreateAppDeps {
  // CORS_ORIGINS is the only variable read below; the rest of the environment
  // is consumed by server.ts and the modules it constructs.
  env: Pick<Env, "CORS_ORIGINS">;
  auth: TokenVerifier;
  bucket: AvatarBucket;
  // The repositories take the real client, so this is where the fake in the
  // test helper stops being structurally sufficient.
  prisma: PrismaClient;
  // Whatever pino-http accepts, taken from its own options type rather than
  // restated: pino-http reaches into the logger's internals, which is why the
  // suite injects a real silent pino instance instead of a stub.
  logger: NonNullable<PinoHttpOptions["logger"]>;
}

/**
 * Builds the Express app from its dependencies.
 *
 * Everything the app touches is passed in, so a test can hand it a fake auth
 * verifier and an in-memory Prisma client. The old index.js created its Firebase
 * connection at import time and exported a bare, unconfigured app, which is why
 * the test directory ended up deleted rather than fixed.
 */
const createApp = ({ env, auth, bucket, prisma, logger }: CreateAppDeps): Express => {
  const app = express();

  // Behind an ALB or nginx, this is what makes req.ip the real client address
  // instead of the proxy's — rate limiting is useless without it.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(pinoHttp({ logger }));

  app.use(
    rateLimit({
      // Note the store: express-rate-limit's default is in-process memory. On a
      // long-lived server that makes this a real global cap. On Vercel it is
      // per-instance and resets on every cold start, so the effective limit is
      // 300 x live containers and it loosens exactly when traffic rises. Making
      // it mean the same thing there needs a shared store (Upstash, @vercel/kv)
      // or a limit at the platform edge.
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    })
  );

  // Unauthenticated on purpose: this is what a load balancer polls.
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  const users = createUserRepository(prisma);
  const posts = createPostRepository(prisma);
  const storage = createStorageService(bucket);

  // Everything below this line requires a valid Firebase ID token. The
  // `authenticated()` adapter the controllers are wrapped in asserts that this
  // ran, so a route mounted above it must not use one.
  app.use(requireAuth(auth));

  app.use(
    "/api/users",
    createUserRoutes({
      controller: createUserController({ users, storage }),
      uploadAvatar,
    })
  );
  app.use(
    "/api/posts",
    createPostRoutes({ controller: createPostController({ posts }) })
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export { createApp, MAX_AVATAR_BYTES, ALLOWED_IMAGE_TYPES };

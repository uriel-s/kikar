const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const pinoHttp = require("pino-http");
const rateLimit = require("express-rate-limit");

const { createUserRepository } = require("./repositories/userRepository");
const { createPostRepository } = require("./repositories/postRepository");
const { createUserController } = require("./controllers/userController");
const { createPostController } = require("./controllers/postController");
const { createStorageService } = require("./services/storageService");
const { createUserRoutes } = require("./routes/userRoutes");
const { createPostRoutes } = require("./routes/postRoutes");
const { requireAuth } = require("./middleware/auth");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
 * Builds the Express app from its dependencies.
 *
 * Everything the app touches is passed in, so a test can hand it a fake auth
 * verifier and an in-memory Prisma client. The old index.js created its Firebase
 * connection at import time and exported a bare, unconfigured app, which is why
 * the test directory ended up deleted rather than fixed.
 */
const createApp = ({ env, auth, bucket, prisma, logger }) => {
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

  // Everything below this line requires a valid Firebase ID token.
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

module.exports = { createApp, MAX_AVATAR_BYTES, ALLOWED_IMAGE_TYPES };

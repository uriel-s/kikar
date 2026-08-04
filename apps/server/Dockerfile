# syntax=docker/dockerfile:1

# ---- dependencies -----------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# npm ci installs exactly what the lockfile pins. The old image used
# `npm install`, which is free to resolve different versions than the ones that
# were tested.
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
RUN npm ci --workspace=@kikar/server --omit=dev

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
RUN npm ci --workspace=@kikar/server

COPY apps/server ./apps/server
# The Prisma client is generated code; generating it here keeps it out of the
# repository and guarantees it matches the schema in this image.
RUN npm run db:generate --workspace=@kikar/server

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# node:alpine ships an unprivileged `node` user. The old image ran everything as
# root and started the app under nodemon, a file watcher meant for development.
RUN apk add --no-cache tini

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/server/src/generated ./apps/server/src/generated
COPY --chown=node:node apps/server ./apps/server
COPY --chown=node:node package.json ./

USER node
EXPOSE 5000

# tini reaps zombies and forwards SIGTERM, which is what lets the server's
# graceful shutdown actually run when the orchestrator stops the container.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/server/src/server.js"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

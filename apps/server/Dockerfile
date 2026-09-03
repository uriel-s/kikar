# syntax=docker/dockerfile:1

# ---- dependencies -----------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# npm ci installs exactly what the lockfile pins. The old image used
# `npm install`, which is free to resolve different versions than the ones that
# were tested.
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
# @kikar/shared is a workspace dependency of @kikar/server (see its
# package.json): npm ci resolves it by symlinking to this directory rather
# than fetching it, and it errors trying the registry instead if the
# directory — or even just its package.json — is missing from the context.
COPY packages/shared/package.json ./packages/shared/
# patches/ has to be here before npm ci: the root postinstall runs patch-package,
# which fixes jwks-rsa's require() of an ESM-only jose. Without the directory the
# install still succeeds — patch-package reports "no patch files" and exits 0 —
# and the image would then quietly run unpatched code. patch-package is a
# production dependency for the same reason: this stage installs --omit=dev, and
# a missing binary here fails the build outright.
COPY patches ./patches
COPY scripts ./scripts
RUN npm ci --workspace=@kikar/server --omit=dev

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
COPY patches ./patches
COPY scripts ./scripts
RUN npm ci --workspace=@kikar/server

# apps/server/tsconfig.json extends this, so tsc cannot start without it. It is
# named separately because the COPY below only reaches into the workspace.
COPY tsconfig.base.json ./
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared
# The Prisma client is generated code; generating it here keeps it out of the
# repository and guarantees it matches the schema in this image. The build below
# needs it twice over: tsc reads its index.d.ts, and the build's second step
# copies the directory into dist/ beside the compiled code.
RUN npm run db:generate --workspace=@kikar/server
# @kikar/shared first: apps/server imports it, resolved through ordinary
# node_modules resolution rather than a tsconfig path alias, so tsc cannot
# even find its types until this workspace has been compiled to dist/.
RUN npm run build --workspace=@kikar/shared
# tsc src/ -> dist/. This is the only thing the runtime stage ships, and the
# .dockerignore keeps any dist/ from a developer's machine out of the context,
# so what runs here is always compiled from the sources in this image.
RUN npm run build --workspace=@kikar/server

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# node:alpine ships an unprivileged `node` user. The old image ran everything as
# root and started the app under nodemon, a file watcher meant for development.
RUN apk add --no-cache tini

# Exactly what the running container reads, and nothing else. dist/ already
# contains the generated Prisma client — the build's copy step puts it there,
# because dist/lib/prisma.js resolves `../generated/prisma` relative to itself.
#
# src/ and tests/ deliberately stop shipping here: the process starts from
# dist/, and an image carrying both invites the two to drift. prisma/ and
# prisma.config.js stay because the container's command runs `db:deploy` before
# serving (docker-compose.yml), and all three package.json files (root,
# apps/server, packages/shared) are what make `--workspace=@kikar/server`
# resolve at all.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/server/dist ./apps/server/dist
COPY --chown=node:node apps/server/package.json apps/server/prisma.config.js ./apps/server/
COPY --chown=node:node apps/server/prisma ./apps/server/prisma
COPY --chown=node:node package.json ./
# deps' node_modules/@kikar/shared is a workspace symlink to ./packages/shared,
# not a copy — npm links local workspaces rather than installing them. That
# path does not otherwise exist in this stage, so without these two lines the
# symlink dangles and `require("@kikar/shared")` fails at the first request.
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --chown=node:node packages/shared/package.json ./packages/shared/

USER node
EXPOSE 5000

# tini reaps zombies and forwards SIGTERM, which is what lets the server's
# graceful shutdown actually run when the orchestrator stops the container.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/server/dist/server.js"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

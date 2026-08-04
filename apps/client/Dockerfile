# syntax=docker/dockerfile:1

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/client/package.json ./apps/client/
RUN npm ci --workspace=@kikar/client

COPY apps/client ./apps/client

# Create React App inlines env vars at build time, so these are build arguments
# rather than runtime environment. They are all public values: the Firebase web
# config identifies the project, it does not grant access to it.
ARG REACT_APP_API_URL
ARG REACT_APP_FIREBASE_API_KEY
ARG REACT_APP_FIREBASE_AUTH_DOMAIN
ARG REACT_APP_FIREBASE_PROJECT_ID
ARG REACT_APP_FIREBASE_STORAGE_BUCKET
ARG REACT_APP_FIREBASE_MESSAGING_SENDER_ID
ARG REACT_APP_FIREBASE_APP_ID

RUN npm run build --workspace=@kikar/client

# ---- runtime ----------------------------------------------------------------
# nginx serves the static bundle. The old image kept the whole Node toolchain
# and 2,000-odd build dependencies in the running container just to run `serve`.
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/apps/client/build /usr/share/nginx/html
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

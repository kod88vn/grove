# ─── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache git python3 make g++

# Copy only manifests first so this layer is cached until deps change
COPY package.json yarn.lock ./
COPY apps/nora/package.json ./apps/nora/

RUN yarn install --frozen-lockfile --production

# ─── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache git

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Commit hash injected at build time; falls back to "dev"
ARG COMMIT_HASH=dev
RUN printf "NEXT_PUBLIC_COMMIT_HASH=%s\n" "${COMMIT_HASH}" > apps/nora/.env.local

RUN yarn workspace nora build

# ─── Stage 3: production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only copy what next start needs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/nora/package.json ./apps/nora/
COPY --from=builder /app/apps/nora/next.config.js ./apps/nora/
COPY --from=builder /app/apps/nora/.next ./apps/nora/.next

EXPOSE 80
WORKDIR /app/apps/nora

CMD ["node", "../../node_modules/.bin/next", "start", "-p", "80"]

# ─── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache git python3 make g++

# Copy only manifests first so this layer is cached until deps change
COPY package.json yarn.lock ./
COPY packages/grove-shell/package.json ./packages/grove-shell/
COPY apps/gateway/package.json       ./apps/gateway/
COPY apps/grove/package.json         ./apps/grove/
COPY apps/nora/package.json          ./apps/nora/
COPY apps/games/package.json         ./apps/games/
COPY apps/shopping-list/package.json ./apps/shopping-list/
COPY apps/reminders/package.json     ./apps/reminders/
COPY apps/homeworks/package.json     ./apps/homeworks/

RUN yarn install --frozen-lockfile --ignore-scripts && \
	npm rebuild better-sqlite3

# ─── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache git

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Commit hash injected at build time; falls back to "dev"
ARG COMMIT_HASH=dev
RUN printf "NEXT_PUBLIC_COMMIT_HASH=%s\n" "${COMMIT_HASH}" > apps/nora/.env.local

# Disable Turbopack for nora: Turbopack generates hash-based native module IDs
# (e.g. better-sqlite3-<hash>) that are architecture-specific. Since node_modules
# are compiled for Alpine here but may differ from the build host, the hash won't
# resolve at runtime. Webpack handles serverExternalPackages correctly.
ENV TURBOPACK=0

# Build all zone apps
RUN yarn workspace @grove/grove build && \
    yarn workspace nora build && \
    yarn workspace @grove/games build && \
    yarn workspace @grove/shopping-list build && \
    yarn workspace @grove/reminders build && \
    yarn workspace @grove/homeworks build

# ─── Stage 3: production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install build tools needed for native module compilation
RUN apk add --no-cache make g++ python3

# Copy node_modules first (before rebuild, so we can run npm in the right context)
COPY --from=builder /app/node_modules ./node_modules

# Rebuild native modules (better-sqlite3) for this stage's Alpine environment
RUN npm rebuild better-sqlite3

COPY --from=builder /app/package.json ./
COPY --from=builder /app/watt.json    ./
COPY --from=builder /app/packages/grove-shell ./packages/grove-shell

# Gateway (entrypoint)
COPY --from=builder /app/apps/gateway ./apps/gateway

# Grove shell
COPY --from=builder /app/apps/grove/package.json         ./apps/grove/
COPY --from=builder /app/apps/grove/next.config.js       ./apps/grove/
COPY --from=builder /app/apps/grove/.next                ./apps/grove/.next

# Nora
COPY --from=builder /app/apps/nora/package.json          ./apps/nora/
COPY --from=builder /app/apps/nora/next.config.js        ./apps/nora/
COPY --from=builder /app/apps/nora/.next                 ./apps/nora/.next

# Games
COPY --from=builder /app/apps/games/package.json         ./apps/games/
COPY --from=builder /app/apps/games/next.config.js       ./apps/games/
COPY --from=builder /app/apps/games/.next                ./apps/games/.next

# Shopping List
COPY --from=builder /app/apps/shopping-list/package.json         ./apps/shopping-list/
COPY --from=builder /app/apps/shopping-list/next.config.js       ./apps/shopping-list/
COPY --from=builder /app/apps/shopping-list/.next                ./apps/shopping-list/.next

# Reminders
COPY --from=builder /app/apps/reminders/package.json     ./apps/reminders/
COPY --from=builder /app/apps/reminders/next.config.js   ./apps/reminders/
COPY --from=builder /app/apps/reminders/.next            ./apps/reminders/.next

# Homeworks
COPY --from=builder /app/apps/homeworks/package.json     ./apps/homeworks/
COPY --from=builder /app/apps/homeworks/next.config.js   ./apps/homeworks/
COPY --from=builder /app/apps/homeworks/.next            ./apps/homeworks/.next

# App port + Prometheus metrics port
EXPOSE 80
EXPOSE 9090

CMD ["node_modules/.bin/watt", "start"]

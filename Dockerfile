# syntax=docker/dockerfile:1
FROM oven/bun:1-slim AS base
WORKDIR /app

# Stage 1: Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Build the Next.js application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Stage 3: Production runner
FROM base AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libnss3 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1
ENV CHROME_BIN="/usr/bin/chromium"

# Ensure ownership for non-root bun user
RUN chown -R bun:bun /app

# Copy built application & essential runtime files
COPY --from=builder --chown=bun:bun /app/.next ./.next
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/package.json ./package.json
COPY --from=builder --chown=bun:bun /app/schema.sql ./schema.sql
COPY --from=builder --chown=bun:bun /app/next.config.ts ./next.config.ts

USER bun
EXPOSE 3000

CMD ["bun", "run", "start"]


# syntax=docker/dockerfile:1

# ── Stage 1: build ─────────────────────────────────────────────────────────
# Install dev deps (prisma CLI needed for generate), compile TS → dist.
FROM node:22-slim AS builder
WORKDIR /app

# prisma.config.ts reads DATABASE_URL when generating (and @prisma/client's
# postinstall may too). No .env exists in the image — this placeholder is
# overridden by the real value injected at runtime.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/ecoserve

COPY package.json package-lock.json ./
RUN npm ci

# Schema + generated client live inside src/generated (Prisma 7, see
# prisma.config.ts). Generate before compiling so tsc picks up the client.
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: runtime ───────────────────────────────────────────────────────
# Production deps only. The app also serves Socket.IO on the same HTTP server,
# so no extra proxy needed. Migrations are included so operators can run
# `npx prisma migrate deploy` against the database before/after deploy.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/ecoserve

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]

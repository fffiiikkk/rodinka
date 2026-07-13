# ── Build stage ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /workspace

# Copy manifests first for layer cache
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

RUN npm ci --ignore-scripts

# Copy source
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
COPY packages/frontend ./packages/frontend
COPY tsconfig.base.json ./

# Build shared
RUN npm run build --workspace=packages/shared

# Generate Prisma client BEFORE backend build (needed for TypeScript types)
# In npm workspaces, Prisma client is hoisted to /workspace/node_modules/.prisma
RUN cd packages/backend && npx prisma generate

# Build frontend → Vite outDir is '../backend/dist/public' (relative to frontend package)
# so output goes directly to packages/backend/dist/public
ARG APP_VERSION=local
ENV APP_VERSION=$APP_VERSION
RUN npm run build --workspace=packages/frontend

# Build backend (TypeScript → dist/, frontend is already in dist/public/)
RUN npm run build --workspace=packages/backend

# ── Production stage ────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init openssl

WORKDIR /app

# Copy only production dependencies
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN npm ci --omit=dev --ignore-scripts --workspace=packages/backend --workspace=packages/shared

# Copy built artifacts
COPY --from=builder /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=builder /workspace/packages/backend/dist ./packages/backend/dist

# Copy Prisma generated client (hoisted to root node_modules in workspace)
COPY --from=builder /workspace/node_modules/.prisma ./node_modules/.prisma

# Copy full prisma directory: schema + all migrations (needed for prisma migrate deploy)
COPY packages/backend/prisma ./packages/backend/prisma

# Create upload directory and fix permissions so the node user can write to Prisma engines
RUN mkdir -p /app/uploads/photos /app/uploads/attachments && \
    chown -R node:node /app/uploads && \
    chown -R node:node /app/node_modules/.prisma 2>/dev/null || true && \
    chown -R node:node /app/node_modules/@prisma 2>/dev/null || true

ARG APP_VERSION=local
ENV APP_VERSION=$APP_VERSION \
    NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads

EXPOSE 3000

USER node

# Run migrations then start
CMD ["sh", "-c", "cd packages/backend && npx prisma migrate deploy && node dist/index.js"]

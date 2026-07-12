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

# Build frontend → outputs to packages/frontend/dist
ARG APP_VERSION=local
ENV APP_VERSION=$APP_VERSION
RUN npm run build --workspace=packages/frontend

# Copy frontend dist into backend's static folder
RUN mkdir -p packages/backend/dist/public && \
    cp -r packages/frontend/dist/. packages/backend/dist/public/

# Build backend
RUN npm run build --workspace=packages/backend

# ── Production stage ────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

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

COPY packages/backend/prisma/schema.prisma ./packages/backend/prisma/schema.prisma

# Create upload directory
RUN mkdir -p /app/uploads/photos /app/uploads/attachments

ARG APP_VERSION=local
ENV APP_VERSION=$APP_VERSION \
    NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads

EXPOSE 3000

USER node

# Run migrations then start
CMD ["sh", "-c", "cd packages/backend && npx prisma migrate deploy && node dist/index.js"]

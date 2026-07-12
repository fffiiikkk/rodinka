#!/usr/bin/env bash
# ── Rodinka — First-time setup on Synology NAS ───────────────────────────────
# Run once from the project directory on the NAS after cloning the repo.
#
# Prerequisites:
#   • Docker + docker compose installed on Synology
#   • .env.prod file created from .env.prod.example
#   • Cloudflare tunnel running (see cloudflare-tunnel.md)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "────────────────────────────────────────────────────────────"
echo "  Rodinka — Synology first-time setup"
echo "────────────────────────────────────────────────────────────"

# 1. Check .env.prod exists
if [ ! -f ".env.prod" ]; then
  echo "❌  .env.prod not found!"
  echo "    cp .env.prod.example .env.prod  && nano .env.prod"
  exit 1
fi

# 2. Log in to GHCR so we can pull private images (if needed)
echo ""
echo "ℹ️   If the repo is private, log in to GHCR first:"
echo "    echo \$GH_PAT | docker login ghcr.io -u fffiiikkk --password-stdin"
echo ""

# 3. Pull latest image
echo "📦  Pulling latest image from GHCR…"
docker pull ghcr.io/fffiiikkk/rodinkal:latest

# 4. Start all services
echo "🚀  Starting services (db + app + webhook)…"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 5. Wait for DB
echo "⏳  Waiting for PostgreSQL to be ready…"
sleep 10

# 6. Seed the database (first run only)
echo "🌱  Running database seed…"
docker exec rodinka_app sh -c \
  "cd packages/backend && npx tsx prisma/seed/index.ts" || true

echo ""
echo "✅  Setup complete!"
echo "    App:     http://$(hostname):3001"
echo "    Webhook: http://$(hostname):3002/deploy"
echo ""
echo "👉  Add calendar.krataf.dev to your Cloudflare tunnel config:"
echo "    See synology/cloudflare-tunnel.md for instructions."

# Deploy Runbook — Synology NAS + Cloudflare Tunnel

## First-time setup

### 1. Prepare Synology NAS

```bash
# SSH into Synology
# Enable Container Manager (Docker) from Package Center

# Create application directory
mkdir -p /volume1/docker/rodinkal
cd /volume1/docker/rodinkal

# Create .env file (NEVER commit this file)
nano .env
```

Required `.env` values:
```
POSTGRES_USER=rodinkal
POSTGRES_PASSWORD=<generate strong password>
POSTGRES_DB=rodinkal
SESSION_SECRET=<generate with: openssl rand -hex 64>
APP_URL=https://your-domain.com
RESEND_API_KEY=re_xxxx
EMAIL_FROM=kalendar@yourdomain.com
VAPID_PUBLIC_KEY=<from: npx web-push generate-vapid-keys>
VAPID_PRIVATE_KEY=<from: npx web-push generate-vapid-keys>
VAPID_SUBJECT=mailto:admin@yourdomain.com
GHCR_IMAGE=ghcr.io/YOUR_GITHUB_USER/rodinkal
APP_VERSION=latest
TUNNEL_TOKEN=<from Cloudflare dashboard>
DEPLOY_WEBHOOK_SECRET=<generate with: openssl rand -hex 32>
```

### 2. Set up Cloudflare Tunnel

1. Go to Cloudflare Zero Trust → Tunnels → Create tunnel
2. Note the tunnel token
3. Configure public hostname: your-domain.com → http://app:3000
4. Set `TUNNEL_TOKEN` in `.env`

### 3. Copy docker-compose.yml to NAS

```bash
# From your dev machine or GitHub Actions:
scp docker-compose.yml user@nas-ip:/volume1/docker/rodinkal/
```

### 4. First start

```bash
cd /volume1/docker/rodinkal

# Pull images
docker compose pull

# Start (with cloudflare tunnel)
docker compose --profile cloudflare up -d

# Check logs
docker compose logs -f app

# Seed database (only first time)
docker compose exec app sh -c "cd packages/backend && npx tsx prisma/seed/index.ts"
```

### 5. Set up deploy webhook

Create `/volume1/docker/rodinkal/webhook.sh`:
```bash
#!/bin/bash
# Simple deploy webhook script
# Called by GitHub Actions on each push to main

SECRET="${DEPLOY_WEBHOOK_SECRET}"
DIR="/volume1/docker/rodinkal"

# Read the POST body
BODY=$(cat)
AUTH_HEADER="${HTTP_AUTHORIZATION:-}"

if [ "$AUTH_HEADER" != "Bearer $SECRET" ]; then
  echo "HTTP/1.1 401 Unauthorized"
  echo ""
  exit 1
fi

echo "HTTP/1.1 200 OK"
echo "Content-Type: application/json"
echo ""
echo '{"status":"deploying"}'

# Deploy in background
(
  cd "$DIR"
  docker compose pull app
  docker compose up -d app
  sleep 5
  docker compose logs --tail=50 app
) &
```

Or use a small webhook server like `webhook` (Go):
```bash
docker run -d --name webhook \
  -p 9000:9000 \
  -v /volume1/docker/rodinkal:/scripts \
  almir/webhook \
  -hooks /scripts/hooks.json
```

## Updating the app

Updates happen automatically via GitHub Actions. After a push to `main`:
1. CI runs tests and builds Docker image
2. Deploy workflow calls the webhook
3. NAS pulls new image and restarts container
4. Workflow verifies `/health` returns the new SHA

### Manual update

```bash
cd /volume1/docker/rodinkal
docker compose pull app
docker compose up -d app
# Verify
curl http://localhost:3000/health
```

## Rollback

```bash
cd /volume1/docker/rodinkal

# List available versions in GHCR (see GitHub Packages)
# Edit .env: APP_VERSION=1.0.<previous_run>+<sha>
# Then:
docker compose up -d app

# Verify old version
curl http://localhost:3000/health
```

## Viewing logs

```bash
# All services
docker compose logs -f

# App only (JSON logs)
docker compose logs -f app

# Pretty print with jq
docker compose logs -f app | jq .

# Search for errors
docker compose logs app | grep '"level":50'  # pino level 50 = error

# Last 100 lines
docker compose logs --tail=100 app
```

## Backup and restore

### Automated backup (set up cron on NAS)

```bash
# Add to Synology Task Scheduler (run as root, daily at 2:00 AM)
#!/bin/bash
BACKUP_DIR="/volume1/backups/rodinkal"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Database dump
docker exec rodinkal-postgres-1 pg_dump -U rodinkal rodinkal | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Keep last 30 days
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +30 -delete

echo "Backup complete: $BACKUP_DIR/db_$DATE.sql.gz"
```

The `uploads/` volume is included in Synology Hyper Backup automatically (configure via Synology Hyper Backup UI for `/volume1/docker/rodinkal` folder).

### Restore from backup

```bash
cd /volume1/docker/rodinkal

# Stop app (keep postgres running)
docker compose stop app

# Restore database
gunzip -c /volume1/backups/rodinkal/db_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i rodinkal-postgres-1 psql -U rodinkal rodinkal

# Restart
docker compose up -d app
```

## Health check

```bash
curl -s http://localhost:3000/health | jq .
# Expected: { "status": "ok", "version": "1.0.42+a1b2c3d", "uptime": 1234, ... }
```

## Database maintenance

```bash
# Run Prisma Studio (while app is running)
docker compose exec app sh -c "cd packages/backend && npx prisma studio"

# Connect with psql
docker compose exec postgres psql -U rodinkal rodinkal
```

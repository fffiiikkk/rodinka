# Rodinka — Deployment on Synology NAS

## Overview

```
GitHub push → CI tests → Docker image pushed to GHCR
                              ↓
                     deploy.yml triggers
                              ↓
               cloudflared access ssh → ssh.krataf.dev
                              ↓
               /volume1/docker/rodinka on NAS
               docker pull + prisma migrate + restart
                              ↓
               Public: https://calendar.krataf.dev
```

---

## GitHub Secrets required

Set these at https://github.com/fffiiikkk/rodinka/settings/secrets/actions:

| Secret | Description |
|--------|-------------|
| `CF_ACCESS_CLIENT_ID` | Cloudflare Access Service Token ID |
| `CF_ACCESS_CLIENT_SECRET` | Cloudflare Access Service Token Secret |
| `SYNOLOGY_SSH_KEY` | SSH private key (PEM) for NAS access |
| `SYNOLOGY_SSH_USER` | SSH user on NAS (e.g. `krataf`) |

---

## One-time Cloudflare Zero Trust setup

**This must be done once before any deployment can succeed via GitHub Actions.**

### Step 1 — Tunnel ingress rules

Log in to [Cloudflare Zero Trust](https://one.dash.cloudflare.com) →
Networks → Tunnels → your tunnel → Edit → Public Hostname tab.

Ensure ALL of these rules exist (order matters — catch-all must be last):

```yaml
# SSH gateway — shared by all apps (rodinka, training-diary, etc.)
- hostname: ssh.krataf.dev
  service: ssh://localhost:22

# Rodinka family calendar
- hostname: calendar.krataf.dev
  service: http://localhost:3010

# Hub / main site
- hostname: krataf.dev
  service: http://localhost:8080   # adjust to actual hub port

# Training diary / Sportige
- hostname: sportige.krataf.dev
  service: http://localhost:3001   # adjust if different

# Catch-all — must be the very last rule
- service: http_status:404
```

> **Warning:** Never let an individual app's deployment overwrite this config.
> The `cloudflared` service is managed separately (see "Tunnel management" below).

### Step 2 — Access Application for SSH

Go to Zero Trust → Access → Applications.
Find or create an application for `ssh.krataf.dev`:

| Field | Value |
|-------|-------|
| Type | Self-hosted |
| Application domain | `ssh.krataf.dev` |
| Session duration | 24 hours |

Add a policy:

| Field | Value |
|-------|-------|
| Policy name | `service-token-deploy` |
| Action | Allow |
| Include | Service Token → select the token whose Client ID matches `CF_ACCESS_CLIENT_ID` |

**This Access Application is what allows `cloudflared access ssh` to authenticate
using the service token. Without it, every SSH attempt fails with
"websocket: bad handshake" even if the tunnel ingress rule is correct.**

### Step 3 — Verify

From your local machine (with cloudflared installed):

```bash
cloudflared access ssh \
  --hostname ssh.krataf.dev \
  --service-token-id <CF_ACCESS_CLIENT_ID> \
  --service-token-secret <CF_ACCESS_CLIENT_SECRET>
```

Or simply trigger a manual deploy from GitHub Actions and watch the
"Test SSH connectivity" step — it prints a clear diagnostic if anything is broken.

---

## First-time NAS setup

SSH into your NAS and run:

```bash
ssh krataf@<NAS_IP>

mkdir -p /volume1/docker/rodinka
cd /volume1/docker/rodinka

# Pull the latest image (log in first if the package is private)
echo <GITHUB_PAT> | docker login ghcr.io -u fffiiikkk --password-stdin
docker pull ghcr.io/fffiiikkk/rodinkal:latest

# Create the env file
cp .env.prod.example .env.prod
nano .env.prod   # fill in DB_PASSWORD, SESSION_SECRET, VAPID_*, etc.

# Start everything
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Wait for DB, then seed (first run only)
sleep 15
docker exec rodinka_app sh -c \
  "cd packages/backend && npx tsx prisma/seed/index.ts"
```

---

## Cloudflare tunnel management

The `cloudflared` daemon on the NAS runs as a **single shared container**,
separate from any application. Do NOT add a `cloudflared` service to
`docker-compose.prod.yml` — this would start a second daemon that attempts
to claim the same tunnel and overwrite the shared ingress rules.

The cloudflared container should be started once, independently:

```bash
# /volume1/docker/cloudflared/docker-compose.yml (managed separately)
docker run -d \
  --name cloudflared \
  --restart unless-stopped \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate run \
  --token <TUNNEL_TOKEN>
```

Or use the Cloudflare Tunnel package from Synology Package Center if available.

To update ingress rules, always edit them through the **Cloudflare Zero Trust
dashboard** (Networks → Tunnels → your tunnel → Edit) — never by replacing
the tunnel config file on disk.

---

## Routine deploy (automated)

Every push to `main`:
1. CI runs lint, type-check, unit tests, integration tests, E2E smoke tests
2. Docker image `ghcr.io/fffiiikkk/rodinkal:latest` is built and pushed
3. `deploy.yml` triggers after CI succeeds
4. The deploy job SSHes into the NAS via `ssh.krataf.dev` (Cloudflare Access)
5. Pulls the pre-built `:latest` image (no rebuild in deploy)
6. Runs `prisma migrate deploy` in a disposable container
7. Restarts `rodinka_app` with `--force-recreate`
8. Polls `http://localhost:3010/health` until it responds (up to 60 s)

---

## Manual deploy / rollback

```bash
ssh krataf@ssh.krataf.dev   # or via local IP if on same network

cd /volume1/docker/rodinka

# Pull and restart
docker pull ghcr.io/fffiiikkk/rodinkal:latest
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  up -d --no-deps --force-recreate app

# Rollback to a specific SHA
docker pull ghcr.io/fffiiikkk/rodinkal:<sha>
# edit docker-compose.prod.yml: image: ghcr.io/fffiiikkk/rodinkal:<sha>
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  up -d --no-deps --force-recreate app
```

---

## Useful commands on NAS

```bash
# Live application logs
docker logs -f rodinka_app

# Database logs
docker logs -f rodinka_db

# Health check
curl http://localhost:3010/health

# Restart all services
docker compose -f docker-compose.prod.yml --env-file .env.prod restart

# Stop all services
docker compose -f docker-compose.prod.yml --env-file .env.prod down

# Prune old images (safe — keeps current and previous)
docker image prune -f
```

---

## Troubleshooting

### "websocket: bad handshake" in deploy log

The SSH Access Application is missing or the service token is not in the
allow policy. See "One-time Cloudflare Zero Trust setup → Step 2" above.

### "ssh.krataf.dev" returns 404

The tunnel ingress rule for `ssh.krataf.dev` is missing. See Step 1 above.
This can happen if another app's `cloudflared` container was started and
overwrote the shared tunnel configuration.

### "ERROR: .env.prod not found"

The `.env.prod` file was not created on the NAS. Run the first-time setup.

### App container crashes on start

```bash
docker logs rodinka_app
```

Common causes: wrong `DB_PASSWORD` in `.env.prod`, missing migration,
or `SESSION_SECRET` too short (must be 32+ chars).

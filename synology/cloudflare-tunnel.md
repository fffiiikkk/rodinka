# Cloudflare Tunnel — krataf.dev canonical configuration

## All ingress rules (manage via Cloudflare Zero Trust dashboard)

Log in to [Cloudflare Zero Trust](https://one.dash.cloudflare.com) →
Networks → Tunnels → your tunnel → Edit → Public Hostname.

```yaml
# ── SSH gateway (shared by ALL apps for CI/CD deployments) ──────────────────
# Used by: rodinka deploy.yml, training-diary deploy-synology.yml, etc.
- hostname: ssh.krataf.dev
  service: ssh://localhost:22

# ── Rodinka — family calendar ────────────────────────────────────────────────
- hostname: calendar.krataf.dev
  service: http://localhost:3010

# ── Training diary / Sportige ────────────────────────────────────────────────
- hostname: sportige.krataf.dev
  service: http://localhost:3001

# ── Hub / main landing page ──────────────────────────────────────────────────
- hostname: krataf.dev
  service: http://localhost:8080   # adjust to actual port

# ── Catch-all (must be last) ─────────────────────────────────────────────────
- service: http_status:404
```

---

## DNS records (Cloudflare dashboard → krataf.dev → DNS)

| Type | Name | Content | Proxied |
|------|------|---------|---------|
| CNAME | `@` | `<TUNNEL_ID>.cfargotunnel.com` | Yes |
| CNAME | `calendar` | `<TUNNEL_ID>.cfargotunnel.com` | Yes |
| CNAME | `ssh` | `<TUNNEL_ID>.cfargotunnel.com` | Yes |
| CNAME | `sportige` | `<TUNNEL_ID>.cfargotunnel.com` | Yes |

---

## Access Application for SSH (REQUIRED for CI/CD)

Go to Zero Trust → Access → Applications. Find `ssh.krataf.dev`.

If it does not exist, create it:

| Field | Value |
|-------|-------|
| Type | Self-hosted |
| Application domain | `ssh.krataf.dev` |

Add a policy named `service-token-deploy`:

| Field | Value |
|-------|-------|
| Action | Allow |
| Include | Service Token → your deploy service token |

The service token Client ID = `CF_ACCESS_CLIENT_ID` GitHub secret.

Without this policy the deployment step fails with "websocket: bad handshake"
even when the tunnel ingress rule is correctly configured.

---

## Cloudflared on NAS — standalone container

The cloudflared daemon must run as a **single shared container**, NOT as part
of any individual application's docker-compose file.

```bash
# Start once on the NAS — do not add to app compose files
docker run -d \
  --name cloudflared \
  --restart unless-stopped \
  --network host \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate run \
  --token <TUNNEL_TOKEN_FROM_DASHBOARD>
```

Updating ingress rules: always use the **Cloudflare Zero Trust dashboard**.
Restarting cloudflared picks up the latest rules automatically.

```bash
docker restart cloudflared
```

---

## Verify connectivity

From a machine with cloudflared installed:

```bash
# Test SSH access
ssh -o ProxyCommand="cloudflared access ssh --hostname ssh.krataf.dev \
  --service-token-id <ID> --service-token-secret <SECRET>" \
  krataf@ssh.krataf.dev "echo OK"

# Test HTTP apps
curl -I https://calendar.krataf.dev/health
curl -I https://krataf.dev
```

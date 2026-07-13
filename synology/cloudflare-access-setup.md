# Cloudflare Zero Trust — Complete Setup Guide

Step-by-step instructions for configuring the Cloudflare tunnel ingress rules
and the Access Application required for SSH-based CI/CD deployments.

---

## Accessing the tunnel configuration

1. Log in to [one.dash.cloudflare.com](https://one.dash.cloudflare.com)
2. Left sidebar → **Networks** → **Tunnels**
3. Find your tunnel (the one running on the NAS — it will show **Healthy** if cloudflared is running)
4. Click the tunnel name → **Edit** → tab **Public Hostname**

This is the GUI version of the ingress YAML. Each row is one rule.
Rules are matched **top-to-bottom** — the first match wins. Order is critical.

---

## Ingress rules — exact order required

### Rule 1 — SSH gateway (shared by all apps)

| Field | Value |
|-------|-------|
| Subdomain | `ssh` |
| Domain | `krataf.dev` |
| Service type | **SSH** |
| URL | `localhost:22` |

> Select **SSH** from the service type dropdown — not HTTP/HTTPS.
> This tells Cloudflare to treat the connection as an SSH proxy.
> Port 22 is the Synology SSH daemon listening on the NAS host itself (not inside a Docker container).

### Rule 2 — Rodinka family calendar

| Field | Value |
|-------|-------|
| Subdomain | `calendar` |
| Domain | `krataf.dev` |
| Service type | **HTTP** |
| URL | `localhost:3010` |

> Port 3010 is what `docker-compose.prod.yml` maps: `"3010:3000"`.
> The container listens on 3000 internally; the NAS host exposes it on 3010.

### Rule 3 — Training diary / Sportige

| Field | Value |
|-------|-------|
| Subdomain | `sportige` |
| Domain | `krataf.dev` |
| Service type | **HTTP** |
| URL | `localhost:3001` |

### Rule 4 — Hub / main landing page

| Field | Value |
|-------|-------|
| Subdomain | *(leave empty)* |
| Domain | `krataf.dev` |
| Service type | **HTTP** |
| URL | `localhost:8080` |

> Adjust the port to wherever the hub container is actually listening.

### Rule 5 — Catch-all (always last)

Cloudflare adds this automatically. If it is missing, add it manually:

| Field | Value |
|-------|-------|
| Subdomain | *(empty)* |
| Domain | *(empty)* |
| Service type | **HTTP status** |
| Status code | `404` |

---

## Access Application for SSH — separate, critical step

The ingress rule alone is **not enough** for `cloudflared access ssh` to authenticate.
The Cloudflare Access layer sits in front of the tunnel and must also allow the request.

### What is it?

The tunnel routes packets. Access controls who is allowed to reach the tunnel endpoint.
For SSH (non-browser connections), authentication is done via a **Service Token** —
a machine credential used by GitHub Actions instead of a browser login.

### How the two layers interact

```
GitHub Actions runner
        │
        │  cloudflared access ssh
        │    --hostname ssh.krataf.dev
        │    --service-token-id  CF_ACCESS_CLIENT_ID
        │    --service-token-secret CF_ACCESS_CLIENT_SECRET
        │
        ▼
  Cloudflare edge
        │
        ├── ACCESS layer: checks Access Application for ssh.krataf.dev
        │     └── Policy: is this service token in the Allow list?
        │           NO  → 403 → "websocket: bad handshake"
        │           YES → continue ↓
        │
        ├── TUNNEL layer: ingress rule ssh.krataf.dev → ssh://localhost:22
        │     MISSING → 404 → "websocket: bad handshake"
        │
        ▼
  Synology NAS SSH daemon (port 22)
        └── SSH key auth → user krataf logged in
```

Both must be present. Either one missing produces the same symptom:
`websocket: bad handshake` or `Connection closed by UNKNOWN port 65535`.

### Creating the Service Token (if not done yet)

1. Left sidebar → **Access** → **Service Tokens** → **Create Service Token**
2. Give it a name, e.g. `github-actions-deploy`
3. Copy the **Client ID** → set as GitHub secret `CF_ACCESS_CLIENT_ID`
4. Copy the **Client Secret** → set as GitHub secret `CF_ACCESS_CLIENT_SECRET`

> The secret is shown **once** — copy it immediately.

### Creating the Access Application

1. Left sidebar → **Access** → **Applications** → **Add an application**
2. Choose **Self-hosted**

**Step 1 — App details:**

| Field | Value |
|-------|-------|
| Application name | `SSH Gateway — krataf.dev` |
| Session duration | `24 hours` |
| Application domain | `ssh.krataf.dev` |

**Step 2 — Policies — Add a policy:**

| Field | Value |
|-------|-------|
| Policy name | `service-token-deploy` |
| Action | **Allow** |

Under **Configure rules → Include:**
- Selector: **Service Token**
- Value: select the token you created (`github-actions-deploy`)

**Step 3 — Save the application.**

---

## DNS records

All hostnames must have CNAME records pointing to the tunnel in Cloudflare DNS.
Go to **krataf.dev → DNS**.

| Type | Name | Content | Proxied |
|------|------|---------|---------|
| CNAME | `@` | `<TUNNEL_ID>.cfargotunnel.com` | Yes |
| CNAME | `ssh` | `<TUNNEL_ID>.cfargotunnel.com` | Yes |
| CNAME | `calendar` | `<TUNNEL_ID>.cfargotunnel.com` | Yes |
| CNAME | `sportige` | `<TUNNEL_ID>.cfargotunnel.com` | Yes |

Find your `TUNNEL_ID` in Zero Trust → Networks → Tunnels → click the tunnel name.

> Cloudflare may create some of these DNS records automatically when you save
> the Public Hostname rules. Check DNS after saving to avoid duplicates.

---

## Verifying connectivity

### Test from local machine (requires `cloudflared` installed locally)

```bash
# SSH through the tunnel using service token
ssh \
  -o ProxyCommand="cloudflared access ssh \
    --hostname ssh.krataf.dev \
    --service-token-id YOUR_CLIENT_ID \
    --service-token-secret YOUR_CLIENT_SECRET" \
  krataf@ssh.krataf.dev \
  "echo SSH OK — hostname: \$(hostname)"
```

If this prints `SSH OK — hostname: <NAS hostname>`, the GitHub Actions deploy
workflow will also work — it uses the exact same mechanism.

### Test HTTP apps

```bash
curl -I https://calendar.krataf.dev/health
curl -I https://krataf.dev
```

### Test via GitHub Actions (manual trigger)

In the GitHub repository → **Actions** → **Deploy → Synology** → **Run workflow**.

The **"Test SSH connectivity"** step will print a detailed diagnostic if anything is wrong:

```
══════════════════════════════════════════════════════════
  SSH CONNECTION FAILED — check Cloudflare Zero Trust:

  1. Zero Trust → Networks → Tunnels → your tunnel → Edit
     Ingress rules must include:
       hostname: ssh.krataf.dev
       service:  ssh://localhost:22

  2. Zero Trust → Access → Applications
     App 'ssh.krataf.dev' must exist with policy:
       Action: Allow
       Include: Service Token = CF_ACCESS_CLIENT_ID secret
══════════════════════════════════════════════════════════
```

---

## Troubleshooting

| Symptom | Most likely cause | Fix |
|---------|-------------------|-----|
| `websocket: bad handshake` | Access Application missing or service token not in Allow policy | Create Access Application — see above |
| `websocket: bad handshake` | Ingress rule for `ssh.krataf.dev` deleted | Re-add the SSH ingress rule |
| `ssh: connect to host ... port 22: Connection refused` | Ingress service type set to HTTP instead of SSH | Change service type to **SSH** |
| `404` from `curl https://ssh.krataf.dev` | No ingress rule at all | Add rule |
| `Permission denied (publickey)` | Wrong SSH key | The private key in `SYNOLOGY_SSH_KEY` secret must match a public key in `~/.ssh/authorized_keys` on the NAS user `krataf` |
| Works locally, fails in CI | Service token not in Access policy (local test may use browser session) | Add service token to the Allow policy |
| Tunnel shows as **Inactive** in dashboard | cloudflared container on NAS is stopped | `docker start cloudflared` or check the standalone cloudflared setup |

---

## Why tunnel config gets overwritten (and how to prevent it)

Each cloudflared instance that starts with a **tunnel token** (`--token <TUNNEL_TOKEN>`)
can push new ingress configuration to Cloudflare, overwriting whatever was set before.

If any application's `docker-compose` file includes a `cloudflared` service with the
shared tunnel token, starting that compose stack overwrites the entire ingress config —
removing all other apps' rules, including the SSH rule.

**Prevention rules:**
- The `cloudflared` daemon runs as a **single shared container** on the NAS, managed
  independently of any application
- No application's `docker-compose.prod.yml` should contain a `cloudflared` service
- Ingress rules are managed **only** through the Cloudflare Zero Trust dashboard
- When adding a new app to the NAS, add its ingress rule via the dashboard —
  never by restarting cloudflared with a config file

The `rodinka` compose files enforce this: `docker-compose.yml` and
`docker-compose.prod.yml` contain a comment explicitly warning against adding
a cloudflared service.

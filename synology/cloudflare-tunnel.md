# Cloudflare Tunnel — přidání calendar.krataf.dev

## Předpoklady

- Máš fungující tunnel s hubem na `krataf.dev`
- Tunnel ID znáš z Cloudflare dashboardu nebo z `/etc/cloudflared/config.yml`

---

## 1. Přidej DNS záznam v Cloudflare

V Cloudflare dashboardu pro doménu `krataf.dev`:

| Type  | Name       | Content                  | Proxy |
|-------|------------|--------------------------|-------|
| CNAME | `calendar` | `<TUNNEL_ID>.cfargotunnel.com` | ✅ Proxied |

---

## 2. Uprav tunnel config na Synology

Soubor obvykle na `/etc/cloudflared/config.yml` nebo v Docker volume.

Přidej nový ingress záznam **před** `catch-all` (posledním pravidlem):

```yaml
ingress:
  # ... ostatní aplikace (avatar atd.) ...

  - hostname: calendar.krataf.dev
    service: http://localhost:3001

  # Catch-all musí být poslední!
  - service: http_status:404
```

---

## 3. Restart cloudflared

```bash
# Pokud běží jako Docker kontejner:
docker restart cloudflared

# Pokud jako systemd service:
sudo systemctl restart cloudflared
```

---

## 4. Ověř

```bash
curl -I https://calendar.krataf.dev/health
# Mělo by vrátit HTTP 200 s JSON { "status": "ok" }
```

---

## Poznámka k webhook URL

GitHub Actions volá webhook na:
```
https://calendar.krataf.dev/deploy   ← NE, to je app
```

Webhook receiver běží na portu **3002**. Potřebuješ buď:

**Varianta A — přímý přístup (jednodušší):**
```
http://<NAS_IP>:3002/deploy
```
Nastav v GitHub Secrets jako `DEPLOY_WEBHOOK_URL`.

**Varianta B — přes tunnel (bezpečnější):**
Přidej druhý hostname pro webhook:

```yaml
  - hostname: deploy.krataf.dev
    service: http://localhost:3002
```

A nastav `DEPLOY_WEBHOOK_URL = https://deploy.krataf.dev/deploy`.

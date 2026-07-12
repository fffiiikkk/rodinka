# Rodinka — Nasazení na Synology NAS

## Co je potřeba

- Synology NAS s Dockerem (DSM 7+)
- SSH přístup na NAS
- Cloudflare tunnel (`cloudflared`) běžící na NAS
- Doménová položka `calendar.krataf.dev` v Cloudflare DNS

---

## Krok 1 — Klonování repozitáře na NAS

```bash
ssh admin@<NAS_IP>

# Vytvoř složku pro aplikaci
mkdir -p /volume1/docker/rodinka
cd /volume1/docker/rodinka

# Klonuj repo
git clone https://github.com/fffiiikkk/rodinka.git .
```

---

## Krok 2 — Vytvoř .env.prod

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Vyplň:
- `DB_PASSWORD` — silné náhodné heslo pro PostgreSQL
- `SESSION_SECRET` — 64 náhodných znaků: `openssl rand -hex 32`
- `RESEND_API_KEY` — klíč z resend.com
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — vygeneruj: `npx web-push generate-vapid-keys`
- `DEPLOY_WEBHOOK_SECRET` — libovolný tajný řetězec (stejný jako v GitHub Secrets)

---

## Krok 3 — Aktualizuj GitHub Secrets

Na stránce https://github.com/fffiiikkk/rodinka/settings/secrets/actions nastav:

| Secret | Hodnota |
|--------|---------|
| `DEPLOY_WEBHOOK_SECRET` | Stejný řetězec jako v `.env.prod` |
| `DEPLOY_WEBHOOK_URL` | `http://<NAS_IP>:3002/deploy` (nebo přes tunnel viz níže) |
| `APP_URL` | `https://calendar.krataf.dev` |

---

## Krok 4 — První spuštění

```bash
cd /volume1/docker/rodinka

# Spusť setup (stáhne image, spustí kontejnery, naseeduje DB)
bash synology/setup.sh
```

Tím se spustí:
- `rodinka_db` — PostgreSQL na portu 5433 (interní)
- `rodinka_app` — aplikace na portu **3001**
- `rodinka_webhook` — webhook receiver na portu **3002**

---

## Krok 5 — Cloudflare tunnel

Otevři konfigurační soubor cloudflared tunnelu (obvykle `/etc/cloudflared/config.yml`
nebo ve složce s Docker volume pro cloudflared kontejner).

Přidej **před** catch-all záznam:

```yaml
ingress:
  # ... ostatní služby ...

  - hostname: calendar.krataf.dev
    service: http://localhost:3001

  # Catch-all musí být poslední
  - service: http_status:404
```

Restart cloudflared:
```bash
docker restart cloudflared   # nebo: sudo systemctl restart cloudflared
```

Přidej DNS záznam v Cloudflare Dashboard:
- Type: `CNAME`
- Name: `calendar`
- Content: `<TUNNEL_ID>.cfargotunnel.com`
- Proxy: ✅ enabled

---

## Krok 6 — Ověření

```bash
curl https://calendar.krataf.dev/health
# {"status":"ok","version":"..."}
```

---

## Automatické deploye (GitHub Actions)

Po každém push do `main`:
1. CI projde testy
2. Docker image se buildne a pushne na GHCR (`ghcr.io/fffiiikkk/rodinkal:latest`)
3. GitHub Actions zavolá webhook na tvůj NAS
4. Webhook server stáhne nový image a restartuje `rodinka_app`

---

## Manuální update

```bash
cd /volume1/docker/rodinka
git pull
docker pull ghcr.io/fffiiikkk/rodinkal:latest
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps --force-recreate app
```

---

## Správa

```bash
# Logy aplikace
docker logs -f rodinka_app

# Logy databáze
docker logs -f rodinka_db

# Restart vše
docker compose -f docker-compose.prod.yml --env-file .env.prod restart

# Zastavit vše
docker compose -f docker-compose.prod.yml --env-file .env.prod down
```

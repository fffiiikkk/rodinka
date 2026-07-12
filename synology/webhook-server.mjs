/**
 * Rodinka — Lightweight deploy webhook receiver
 * Runs inside the `webhook` container on the Synology NAS.
 *
 * Receives POST from GitHub Actions after a successful CI build,
 * pulls the new Docker image, and restarts the app container.
 */
import http from 'node:http';
import { execSync } from 'node:child_process';

const PORT    = 3002;
const SECRET  = process.env.WEBHOOK_SECRET ?? '';
const IMAGE   = process.env.GHCR_IMAGE     ?? 'ghcr.io/fffiiikkk/rodinkal';
const COMPOSE = process.env.COMPOSE_FILE   ?? '/app/docker-compose.prod.yml';
const ENV_F   = process.env.ENV_FILE       ?? '/app/.env.prod';

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function run(cmd) {
  log(`$ ${cmd}`);
  return execSync(cmd, { stdio: 'pipe' }).toString().trim();
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/deploy') {
    res.writeHead(404); res.end('Not found');
    return;
  }

  // Auth
  const auth = req.headers['authorization'] ?? '';
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    log('⛔ Unauthorized deploy attempt');
    res.writeHead(401); res.end('Unauthorized');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let payload = {};
    try { payload = JSON.parse(body); } catch {}
    const tag = payload.image_tag ?? 'latest';
    log(`🚀 Deploy triggered — image tag: ${tag}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Deploy started', tag }));

    // Run async so response is sent first
    setImmediate(() => {
      try {
        log('📦 Pulling new image…');
        run(`docker pull ${IMAGE}:latest`);

        log('🔄 Restarting app container…');
        run(`docker compose -f ${COMPOSE} --env-file ${ENV_F} up -d --no-deps --force-recreate app`);

        log('✅ Deploy complete');
      } catch (err) {
        log(`❌ Deploy failed: ${err.message}`);
      }
    });
  });
});

server.listen(PORT, () => {
  log(`🎣 Webhook receiver listening on :${PORT}`);
});

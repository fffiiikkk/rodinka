import 'dotenv/config';
import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { prisma } from './db.js';
import { startScheduler } from './jobs/scheduler.js';

async function main() {
  // Verify DB connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info({ version: config.appVersion }, 'Database connection OK');
  } catch (e) {
    logger.fatal({ e }, 'Database connection failed — exiting');
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, version: config.appVersion, env: config.nodeEnv },
      'Server started',
    );
  });

  // Start background jobs (non-blocking)
  startScheduler();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});

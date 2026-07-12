import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
  ],
});

// Log slow queries in development
prisma.$on('query', (e) => {
  if (e.duration > 500) {
    logger.warn({ duration: e.duration, query: e.query }, 'Slow query');
  }
});

prisma.$on('error', (e) => {
  logger.error({ message: e.message, target: e.target }, 'Prisma error');
});

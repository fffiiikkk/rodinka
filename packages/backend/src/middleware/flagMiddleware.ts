import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { DEFAULT_FLAGS } from '@rodinkal/shared';
import { logger } from '../logger.js';

let flagCache: Record<string, boolean> = { ...DEFAULT_FLAGS };
let flagCacheTime = 0;
const FLAG_CACHE_TTL_MS = 60_000; // 1 minute

export async function loadFlags(): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (now - flagCacheTime < FLAG_CACHE_TTL_MS) return flagCache;

  try {
    const rows = await prisma.featureFlag.findMany();
    const map: Record<string, boolean> = { ...DEFAULT_FLAGS };
    for (const row of rows) {
      map[row.key] = row.enabled;
    }
    flagCache = map;
    flagCacheTime = now;
  } catch (e) {
    logger.warn({ e }, 'Failed to load feature flags, using cache');
  }

  return flagCache;
}

export function invalidateFlagCache(): void {
  flagCacheTime = 0;
}

export function flagMiddleware() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.flags = await loadFlags();
    } catch {
      req.flags = { ...DEFAULT_FLAGS };
    }
    next();
  };
}

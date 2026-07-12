import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../logger.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Zod validation errors (check both instanceof and name for ESM/CJS compatibility)
  if (err instanceof ZodError || (err && typeof err === 'object' && err.constructor?.name === 'ZodError')) {
    const zodErr = err as ZodError;
    res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: zodErr.flatten(),
    });
    return;
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Already exists', code: 'CONFLICT' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
      return;
    }
    if (err.code === 'P2024' || err.code === 'P2028') {
      res.status(503).json({ error: 'Database timeout', code: 'DB_TIMEOUT' });
      return;
    }
  }

  // App-level errors with explicit status
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const appErr = err as { statusCode: number; message: string; code?: string };
    res.status(appErr.statusCode).json({ error: appErr.message, code: appErr.code });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
};

export function createError(statusCode: number, message: string, code?: string): Error & { statusCode: number; code?: string } {
  const err = new Error(message) as Error & { statusCode: number; code?: string };
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

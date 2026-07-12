import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@rodinkal/shared';
import { createError } from './errorHandler.js';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    role: Role;
    impersonatingId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        name: string;
        isImpersonating: boolean;
        realUserId?: string;
      };
      flags: Record<string, boolean>;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    next(createError(401, 'Not authenticated', 'UNAUTHENTICATED'));
    return;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError(401, 'Not authenticated', 'UNAUTHENTICATED'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(createError(403, 'Insufficient permissions', 'FORBIDDEN'));
      return;
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireRole('PARENT')(req, res, next);
}

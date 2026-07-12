import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import type { Role } from '@rodinkal/shared';

export function userMiddleware() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const session = req.session;
    const effectiveId = session?.impersonatingId ?? session?.userId;

    if (!effectiveId) {
      next();
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: effectiveId, isActive: true },
        select: { id: true, role: true, name: true },
      });

      if (user) {
        req.user = {
          id: user.id,
          role: user.role as Role,
          name: user.name,
          isImpersonating: !!session?.impersonatingId,
          realUserId: session?.impersonatingId ? session.userId : undefined,
        };
      }
    } catch {
      // swallow — request proceeds as unauthenticated
    }

    next();
  };
}

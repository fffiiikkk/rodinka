import argon2 from 'argon2';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { logger } from '../logger.js';
import { createError } from '../middleware/errorHandler.js';
import { activityService } from './activityService.js';

export const authService = {
  async login(username: string, password: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      throw createError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw createError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    await activityService.log(user.id, 'LOGIN');
    logger.info({ userId: user.id, username }, 'User logged in');

    return { id: user.id, role: user.role, name: user.name };
  },

  async createPasswordResetToken(email: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return null; // silent — don't reveal existence

    // Invalidate existing tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 3600_000), // 1 hour
      },
    });

    logger.info({ userId: user.id, email }, 'Password reset token created');
    return rawToken;
  },

  async consumePasswordResetToken(rawToken: string, newPassword: string): Promise<string> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const tokenRow = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!tokenRow) throw createError(400, 'Invalid or expired token', 'INVALID_TOKEN');
    if (tokenRow.usedAt) throw createError(400, 'Token already used', 'TOKEN_USED');
    if (tokenRow.expiresAt < new Date()) throw createError(400, 'Token expired', 'TOKEN_EXPIRED');

    const passwordHash = await argon2.hash(newPassword);

    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: tokenRow.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: tokenRow.userId },
        data: { passwordHash },
      }),
    ]);

    await activityService.log(tokenRow.userId, 'PASSWORD_RESET');
    logger.info({ userId: tokenRow.userId }, 'Password reset completed');
    return tokenRow.userId;
  },

  async adminResetPassword(adminId: string, targetUserId: string, newPassword: string): Promise<void> {
    const passwordHash = await argon2.hash(newPassword);
    await prisma.user.update({ where: { id: targetUserId }, data: { passwordHash } });
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        targetId: targetUserId,
        action: 'ADMIN_PASSWORD_RESET',
        entityType: 'User',
        entityId: targetUserId,
      },
    });
    logger.info({ adminId, targetUserId }, 'Admin reset user password');
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw createError(400, 'Current password incorrect', 'INVALID_PASSWORD');

    const passwordHash = await argon2.hash(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    logger.info({ userId }, 'User changed password');
  },
};

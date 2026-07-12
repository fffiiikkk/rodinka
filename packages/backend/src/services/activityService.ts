import { prisma } from '../db.js';
import type { ActivityEventType } from '@rodinkal/shared';

export const activityService = {
  async log(userId: string, type: ActivityEventType, meta?: Record<string, unknown>): Promise<void> {
    await prisma.activityEvent.create({
      data: {
        userId,
        type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        meta: meta ? (meta as any) : undefined,
      },
    });
  },

  async countByType(userId: string, type: string): Promise<number> {
    return prisma.activityEvent.count({ where: { userId, type } });
  },

  async getStreak(userId: string, type: string): Promise<number> {
    // Count consecutive days with at least one event of this type, ending today
    const events = await prisma.activityEvent.findMany({
      where: { userId, type },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (events.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let current = new Date(today);

    for (let i = 0; i < 365; i++) {
      const dayStr = current.toISOString().slice(0, 10);
      const hasEvent = events.some((e) => e.createdAt.toISOString().slice(0, 10) === dayStr);
      if (!hasEvent) break;
      streak++;
      current.setDate(current.getDate() - 1);
    }

    return streak;
  },

  async getUserActivity(userId: string, from: Date, to: Date) {
    return prisma.activityEvent.findMany({
      where: { userId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getRecentActivity(userId: string, limit = 20) {
    return prisma.activityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};

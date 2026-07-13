import { prisma } from '../db.js';
import { logger } from '../logger.js';

// In-process guard: prevent concurrent evaluation for the same user
const running = new Set<string>();

export const badgeService = {
  async getUserBadges(userId: string) {
    const rows = await prisma.userBadge.findMany({
      where: { userId },
      include: { badgeDefinition: true },
      orderBy: { awardedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      badgeDefinitionId: r.badgeDefinitionId,
      badge: r.badgeDefinition,
      awardedAt: r.awardedAt.toISOString(),
      seenAt: r.seenAt?.toISOString() ?? null,
    }));
  },

  async getUnseenBadges(userId: string) {
    const rows = await prisma.userBadge.findMany({
      where: { userId, seenAt: null },
      include: { badgeDefinition: true },
      orderBy: { awardedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      badgeDefinitionId: r.badgeDefinitionId,
      badge: r.badgeDefinition,
      awardedAt: r.awardedAt.toISOString(),
      seenAt: r.seenAt?.toISOString() ?? null,
    }));
  },

  async markSeen(userId: string) {
    await prisma.userBadge.updateMany({
      where: { userId, seenAt: null },
      data: { seenAt: new Date() },
    });
  },

  async getProgress(userId: string) {
    const allBadges = await prisma.badgeDefinition.findMany({ where: { isActive: true } });
    const earned = await prisma.userBadge.findMany({
      where: { userId },
      select: { badgeDefinitionId: true },
    });
    const earnedIds = new Set(earned.map((b) => b.badgeDefinitionId));

    const progress = [];
    for (const badge of allBadges) {
      if (earnedIds.has(badge.id)) continue;
      const current = await badgeService._getCurrentMetric(userId, badge.metric, badge.ruleType);
      if (badge.threshold > 1 && current > 0) {
        progress.push({
          badge,
          current,
          threshold: badge.threshold,
          percentComplete: Math.round((current / badge.threshold) * 100),
        });
      }
    }

    return progress.sort((a, b) => b.percentComplete - a.percentComplete).slice(0, 10);
  },

  async evaluateForUser(userId: string): Promise<void> {
    if (running.has(userId)) return;
    running.add(userId);

    try {
      const badges = await prisma.badgeDefinition.findMany({ where: { isActive: true } });
      const existing = await prisma.userBadge.findMany({
        where: { userId },
        select: { badgeDefinitionId: true },
      });
      const earnedIds = new Set(existing.map((b) => b.badgeDefinitionId));

      for (const badge of badges) {
        if (earnedIds.has(badge.id)) continue;

        const current = await badgeService._getCurrentMetric(userId, badge.metric, badge.ruleType);
        if (current >= badge.threshold) {
          const idempotencyKey = `${userId}:${badge.id}:${badge.tier}`;
          try {
            await prisma.userBadge.create({
              data: { userId, badgeDefinitionId: badge.id, idempotencyKey },
            });
            logger.info({ userId, badgeKey: badge.key }, 'Badge awarded');
          } catch {
            // Unique constraint = already awarded, safe to ignore
          }
        }
      }
    } catch (e) {
      logger.error({ e, userId }, 'Badge evaluation failed');
    } finally {
      running.delete(userId);
    }
  },

  async _getCurrentMetric(userId: string, metric: string, ruleType: string): Promise<number> {
    // Direct activity count metrics
    const activityMetrics = [
      'LOGIN', 'EVENT_CREATED', 'EVENT_EDITED', 'ATTACHMENT_UPLOADED',
      'AVAILABILITY_SET', 'PROPOSAL_SUBMITTED', 'PROPOSAL_APPROVED', 'THEME_CHANGED',
    ];
    if (activityMetrics.includes(metric)) {
      return prisma.activityEvent.count({ where: { userId, type: metric } });
    }

    // Event-type-specific counts (metric = EVENT_CREATED_<slug>) — creator-based
    if (metric.startsWith('EVENT_CREATED_')) {
      const slug = metric.replace('EVENT_CREATED_', '');
      const eventType = await prisma.eventType.findUnique({ where: { slug } });
      if (!eventType) return 0;
      return prisma.event.count({
        where: { createdById: userId, eventTypeId: eventType.id, status: { not: 'CANCELLED' } },
      });
    }

    // Participation-based counts (metric = EVENT_PARTICIPATED_<slug>)
    // Counts events where the user is an explicit participant (not just creator)
    if (metric.startsWith('EVENT_PARTICIPATED_')) {
      const slug = metric.replace('EVENT_PARTICIPATED_', '');
      const eventType = await prisma.eventType.findUnique({ where: { slug } });
      if (!eventType) return 0;
      return prisma.eventParticipant.count({
        where: {
          userId,
          event: { eventTypeId: eventType.id, status: { not: 'CANCELLED' } },
        },
      });
    }

    // Transport-based counts — how many times did the user drive someone
    if (metric === 'TRANSPORT_COUNT') {
      return prisma.event.count({
        where: { transportUserId: userId, status: { not: 'CANCELLED' } },
      });
    }

    // Transport for specific event type (metric = EVENT_TRANSPORTED_<slug>)
    if (metric.startsWith('EVENT_TRANSPORTED_')) {
      const slug = metric.replace('EVENT_TRANSPORTED_', '');
      const eventType = await prisma.eventType.findUnique({ where: { slug } });
      if (!eventType) return 0;
      return prisma.event.count({
        where: { transportUserId: userId, eventTypeId: eventType.id, status: { not: 'CANCELLED' } },
      });
    }

    // Streak metrics
    if (ruleType === 'STREAK') {
      return _computeStreak(userId, metric);
    }

    // Special metrics
    return _computeSpecialMetric(userId, metric);
  },
};

async function _computeStreak(userId: string, metric: string): Promise<number> {
  const baseType = metric.replace('_STREAK', '');
  const events = await prisma.activityEvent.findMany({
    where: { userId, type: baseType },
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
    const has = events.some((e) => e.createdAt.toISOString().slice(0, 10) === dayStr);
    if (!has) break;
    streak++;
    current.setDate(current.getDate() - 1);
  }
  return streak;
}

async function _computeSpecialMetric(userId: string, metric: string): Promise<number> {
  switch (metric) {
    case 'LOGIN_AFTER_22': {
      const count = await prisma.activityEvent.count({
        where: {
          userId, type: 'LOGIN',
          createdAt: { gte: new Date(0) },
        },
      });
      // Approximate: count logins with hour >= 22
      const logins = await prisma.activityEvent.findMany({
        where: { userId, type: 'LOGIN' },
        select: { createdAt: true },
      });
      return logins.filter((l) => l.createdAt.getHours() >= 22).length;
    }
    case 'LOGIN_BEFORE_6': {
      const logins = await prisma.activityEvent.findMany({
        where: { userId, type: 'LOGIN' },
        select: { createdAt: true },
      });
      return logins.filter((l) => l.createdAt.getHours() < 6).length;
    }
    case 'LOGIN_WEEKEND': {
      const logins = await prisma.activityEvent.findMany({
        where: { userId, type: 'LOGIN' },
        select: { createdAt: true },
      });
      return logins.filter((l) => {
        const day = l.createdAt.getDay();
        return day === 0 || day === 6;
      }).length;
    }
    case 'PROFILE_PHOTO_UPLOADED': {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { photoPath: true } });
      return user?.photoPath ? 1 : 0;
    }
    case 'PROFILE_COMPLETE': {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { photoPath: true, mobile: true, dateOfBirth: true },
      });
      if (!user) return 0;
      return user.photoPath && user.mobile && user.dateOfBirth ? 1 : 0;
    }
    case 'DARK_MODE_ENABLED': {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { colorMode: true } });
      return user?.colorMode === 'DARK' ? 1 : 0;
    }
    case 'LANGUAGE_SWITCHED': {
      return prisma.activityEvent.count({ where: { userId, type: 'THEME_CHANGED' } });
    }
    case 'APP_INSTALLED': {
      return prisma.activityEvent.count({ where: { userId, type: 'APP_INSTALLED' } });
    }
    default:
      return 0;
  }
}

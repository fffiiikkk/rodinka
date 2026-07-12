import { prisma } from '../db.js';
import { format, eachDayOfInterval, addDays, differenceInMinutes } from 'date-fns';

export const reportService = {
  async userActivity(userId: string, from: Date, to: Date) {
    const [activityRows, user, lastLogin] = await Promise.all([
      prisma.activityEvent.groupBy({
        by: ['type'],
        where: { userId, createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, role: true } }),
      prisma.activityEvent.findFirst({
        where: { userId, type: 'LOGIN' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const counts = Object.fromEntries(activityRows.map((r) => [r.type, r._count._all]));
    return {
      user: { id: userId, ...user },
      period: { from: from.toISOString(), to: to.toISOString() },
      lastLogin: lastLogin?.createdAt.toISOString() ?? null,
      logins: counts['LOGIN'] ?? 0,
      eventsCreated: counts['EVENT_CREATED'] ?? 0,
      eventsEdited: counts['EVENT_EDITED'] ?? 0,
      proposalsSubmitted: counts['PROPOSAL_SUBMITTED'] ?? 0,
      proposalsApproved: counts['PROPOSAL_APPROVED'] ?? 0,
      attachmentsUploaded: counts['ATTACHMENT_UPLOADED'] ?? 0,
      raw: counts,
    };
  },

  async allUsersActivity(from: Date, to: Date) {
    const users = await prisma.user.findMany({
      where: { isActive: true, username: { not: 'system' } },
      select: { id: true, name: true, email: true, role: true },
    });
    return Promise.all(users.map((u) => reportService.userActivity(u.id, from, to)));
  },

  /**
   * Compute unoccupied time blocks for a user (kid) within awake hours.
   * Returns daily gaps: { date, gaps: [{ start, end, durationMinutes }] }
   */
  async freeTime(userId: string, from: Date, to: Date, awakeHourStart = 7, awakeHourEnd = 21) {
    const days = eachDayOfInterval({ start: from, end: to });

    const events = await prisma.event.findMany({
      where: {
        status: 'APPROVED',
        start: { gte: from, lte: addDays(to, 1) },
        OR: [
          { createdById: userId },
          { participants: { some: { userId } } },
        ],
      },
      orderBy: { start: 'asc' },
    });

    return days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const awakeStart = new Date(`${dayStr}T${String(awakeHourStart).padStart(2, '0')}:00:00.000Z`);
      const awakeEnd = new Date(`${dayStr}T${String(awakeHourEnd).padStart(2, '0')}:00:00.000Z`);

      const dayEvents = events
        .filter((e) => {
          const s = e.start;
          const eEnd = e.end;
          return s < awakeEnd && eEnd > awakeStart;
        })
        .map((e) => ({
          start: e.start < awakeStart ? awakeStart : e.start,
          end: e.end > awakeEnd ? awakeEnd : e.end,
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      const gaps: Array<{ start: string; end: string; durationMinutes: number }> = [];
      let cursor = awakeStart;

      for (const evt of dayEvents) {
        if (evt.start > cursor) {
          gaps.push({
            start: cursor.toISOString(),
            end: evt.start.toISOString(),
            durationMinutes: differenceInMinutes(evt.start, cursor),
          });
        }
        if (evt.end > cursor) cursor = evt.end;
      }

      if (cursor < awakeEnd) {
        gaps.push({
          start: cursor.toISOString(),
          end: awakeEnd.toISOString(),
          durationMinutes: differenceInMinutes(awakeEnd, cursor),
        });
      }

      const totalFreeMinutes = gaps.reduce((sum, g) => sum + g.durationMinutes, 0);
      return { date: dayStr, gaps, totalFreeMinutes };
    });
  },

  async occupancySummary(userId: string, from: Date, to: Date) {
    const events = await prisma.event.findMany({
      where: {
        status: 'APPROVED',
        start: { gte: from, lte: to },
        OR: [
          { createdById: userId },
          { participants: { some: { userId } } },
        ],
      },
      include: { eventType: { select: { slug: true, nameCs: true, nameEn: true, color: true } } },
    });

    const byType: Record<string, { nameCs: string; nameEn: string; color: string; totalMinutes: number; count: number }> = {};

    for (const e of events) {
      const key = e.eventType?.slug ?? 'ostatni';
      const nameCs = e.eventType?.nameCs ?? 'Ostatní';
      const nameEn = e.eventType?.nameEn ?? 'Other';
      const color = e.eventType?.color ?? '#a3a3a3';
      const minutes = differenceInMinutes(e.end, e.start);

      if (!byType[key]) byType[key] = { nameCs, nameEn, color, totalMinutes: 0, count: 0 };
      byType[key]!.totalMinutes += minutes;
      byType[key]!.count += 1;
    }

    return Object.entries(byType)
      .map(([slug, data]) => ({ slug, ...data }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  },
};

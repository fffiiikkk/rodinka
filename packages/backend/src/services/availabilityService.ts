import { prisma } from '../db.js';
import { createError } from '../middleware/errorHandler.js';
import type { CreateAvailabilityInput } from '@rodinkal/shared';
import { activityService } from './activityService.js';
import { addDays, eachDayOfInterval, format } from 'date-fns';
import { fileUrl } from '../lib/s3.js';

/** Deterministic pastel color derived from userId/name — used for avatar rings */
function userColor(id: string): string {
  const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#84cc16'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

function serialize(a: any) {
  return {
    id: a.id,
    userId: a.userId,
    userName: a.isExternal ? (a.externalName ?? 'Externí') : (a.user?.name ?? ''),
    userPhotoUrl: a.user?.photoPath ? fileUrl(a.user.photoPath) : null,
    userColor: userColor(a.userId),
    dateFrom: a.dateFrom.toISOString(),
    dateTo: a.dateTo.toISOString(),
    status: a.status,
    location: a.location,
    note: a.note,
    isExternal: a.isExternal ?? false,
    externalName: a.externalName ?? null,
    externalRole: a.externalRole ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

const INCLUDE = { user: { select: { name: true, photoPath: true } } };

export const availabilityService = {
  async query(from: Date, to: Date, userId?: string) {
    const avails = await prisma.availability.findMany({
      where: {
        ...(userId ? { userId } : {}),
        OR: [
          { dateFrom: { gte: from, lte: to } },
          { dateTo: { gte: from, lte: to } },
          { AND: [{ dateFrom: { lte: from } }, { dateTo: { gte: to } }] },
        ],
      },
      include: INCLUDE,
      orderBy: { dateFrom: 'asc' },
    });
    return avails.map(serialize);
  },

  async create(userId: string, data: CreateAvailabilityInput) {
    const avail = await prisma.availability.create({
      data: {
        userId,
        dateFrom: new Date(data.dateFrom),
        dateTo: new Date(data.dateTo),
        status: data.status,
        location: data.location ?? null,
        note: data.note ?? null,
        isExternal: data.isExternal ?? false,
        externalName: data.externalName ?? null,
        externalRole: data.externalRole ?? null,
      },
      include: INCLUDE,
    });
    await activityService.log(userId, 'AVAILABILITY_SET', { status: data.status });
    return serialize(avail);
  },

  async update(id: string, userId: string, data: Partial<CreateAvailabilityInput>, isAdmin = false) {
    const existing = await prisma.availability.findUnique({ where: { id } });
    if (!existing) throw createError(404, 'Availability not found', 'NOT_FOUND');
    if (!isAdmin && existing.userId !== userId) throw createError(403, 'Not your availability', 'FORBIDDEN');

    const avail = await prisma.availability.update({
      where: { id },
      data: {
        dateFrom: data.dateFrom ? new Date(data.dateFrom) : undefined,
        dateTo: data.dateTo ? new Date(data.dateTo) : undefined,
        status: data.status,
        location: data.location,
        note: data.note,
      },
      include: INCLUDE,
    });
    return serialize(avail);
  },

  async delete(id: string, userId: string, isAdmin: boolean) {
    const existing = await prisma.availability.findUnique({ where: { id } });
    if (!existing) throw createError(404, 'Availability not found', 'NOT_FOUND');
    if (!isAdmin && existing.userId !== userId) throw createError(403, 'Not your availability', 'FORBIDDEN');
    await prisma.availability.delete({ where: { id } });
  },

  /**
   * Detect days in [from,to] where at least one kid participant has an event
   * but no guardian has AVAILABLE/ON_CALL availability.
   */
  async getCoverageGaps(from: Date, to: Date) {
    const days = eachDayOfInterval({ start: from, end: to });

    // All events with kid participants in range
    const events = await prisma.event.findMany({
      where: {
        status: 'APPROVED',
        isHoliday: false,
        start: { gte: from, lte: addDays(to, 1) },
        participants: { some: { user: { role: 'KID' } } },
      },
      include: {
        participants: { include: { user: { select: { name: true, role: true } } } },
      },
    });

    // All guardian availability in range
    const avails = await prisma.availability.findMany({
      where: {
        user: { role: { in: ['PARENT', 'GRANDPARENT', 'RELATIVE'] } },
        status: { in: ['AVAILABLE', 'ON_CALL'] },
        dateFrom: { lte: addDays(to, 1) },
        dateTo: { gte: from },
      },
      include: { user: { select: { name: true } } },
    });

    const gaps = [];
    for (const day of days) {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEvents = events.filter(
        (e) => format(e.start, 'yyyy-MM-dd') === dayStr,
      );
      if (dayEvents.length === 0) continue;

      // Only flag events where supervision is explicitly NOT covered:
      //   transportCoversSupervision === false means transport person said they WON'T cover
      //   transportCoversSupervision === null  means "not necessary" or auto-covered by transport
      //   transportCoversSupervision === true  means transport person WILL cover
      // An event needs a guardian only when transportCoversSupervision is explicitly false.
      const uncoveredEvents = dayEvents.filter((e) => e.transportCoversSupervision === false);

      if (uncoveredEvents.length === 0) continue;

      const guardians = avails
        .filter((a) => a.dateFrom <= day && a.dateTo >= day)
        .map((a) => a.user.name);

      if (guardians.length === 0) {
        gaps.push({
          date: dayStr,
          events: uncoveredEvents.map((e) => ({
            id: e.id,
            title: e.title,
            participantNames: e.participants.filter((p) => p.user.role === 'KID').map((p) => p.user.name),
          })),
          availableGuardians: [],
        });
      }
    }

    return gaps;
  },
};

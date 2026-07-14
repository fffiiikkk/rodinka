import { prisma } from '../db.js';
import { createError } from '../middleware/errorHandler.js';
import type { CreateEventInput, UpdateEventInput } from '@rodinkal/shared';
import { activityService } from './activityService.js';
import { recurrenceService } from './recurrenceService.js';
import { config } from '../config.js';
import { fileUrl } from '../lib/s3.js';

function attachmentUrl(id: string): string {
  return `${config.appUrl}/api/attachments/${id}/file`;
}
function thumbnailUrl(id: string): string {
  return `${config.appUrl}/api/attachments/${id}/thumbnail`;
}

function serializeTransport(event: any) {
  const hasTransport = event.transportUserId || event.transportExternalName || event.transportNote;
  if (!hasTransport) return null;
  return {
    userId: event.transportUserId ?? null,
    userName: event.transportUser?.name ?? null,
    userRole: event.transportUser?.role ?? null,
    externalName: event.transportExternalName ?? null,
    note: event.transportNote ?? null,
    direction: (event.transportDirection as 'BOTH' | 'THERE' | 'BACK' | null) ?? null,
    coversSupervision: event.transportCoversSupervision ?? null,
  };
}

function serializeEvent(event: any): any {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    eventTypeId: event.eventTypeId,
    eventType: event.eventType ?? null,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    allDay: event.allDay,
    location: event.location,
    colorOverride: event.colorOverride,
    createdById: event.createdById,
    recurrenceRule: event.recurrenceRule,
    parentEventId: event.parentEventId,
    status: event.status,
    isHoliday: event.isHoliday,
    transport: serializeTransport(event),
    participants: (event.participants ?? []).map((p: any) => ({
      userId: p.userId,
      name: p.user?.name ?? '',
      photoUrl: p.user?.photoPath ? fileUrl(p.user.photoPath) : null,
      role: p.user?.role ?? '',
    })),
    attachments: (event.attachments ?? []).map((a: any) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      thumbnailUrl: a.thumbnailPath ? thumbnailUrl(a.id) : null,
      downloadUrl: attachmentUrl(a.id),
      createdAt: a.createdAt.toISOString(),
    })),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

const EVENT_INCLUDE = {
  eventType: true,
  transportUser: { select: { name: true, role: true } },
  participants: { include: { user: { select: { name: true, photoPath: true, role: true } } } },
  attachments: true,
};

export const eventService = {
  async query(params: {
    from: Date; to: Date; userId?: string; eventTypeId?: string;
    status?: string; includeHolidays?: boolean; expandRecurring?: boolean;
  }) {
    const where: any = {
      OR: [
        // Any event that overlaps with [from, to]: start ≤ to AND end ≥ from
        // This covers: starts within range, ends within range, spans full range, starts before ends within
        { AND: [{ start: { lte: params.to } }, { end: { gte: params.from } }] },
        // Recurring series that started before the range — occurrences may fall within
        { AND: [{ recurrenceRule: { not: null } }, { start: { lte: params.to } }] },
      ],
      parentEventId: null, // fetch parents only; exceptions fetched separately
    };

    if (!params.includeHolidays) where.isHoliday = false;
    // Always exclude cancelled events from calendar views; callers can override by passing status explicitly
    if (params.status) where.status = params.status;
    else where.status = { not: 'CANCELLED' };
    if (params.eventTypeId) where.eventTypeId = params.eventTypeId;
    if (params.userId) {
      where.OR = [
        { createdById: params.userId },
        { participants: { some: { userId: params.userId } } },
      ];
    }

    const events = await prisma.event.findMany({ where, include: EVENT_INCLUDE, orderBy: { start: 'asc' } });

    if (!params.expandRecurring) return events.map(serializeEvent);

    // Fetch exceptions (child events) for all recurring parents in the result
    const recurringParentIds = events.filter((e) => e.recurrenceRule).map((e) => e.id);
    const exceptions = recurringParentIds.length
      ? await prisma.event.findMany({
          where: { parentEventId: { in: recurringParentIds }, start: { gte: params.from, lte: params.to } },
          include: EVENT_INCLUDE,
        })
      : [];

    // Build a set of (parentId, date) pairs for exception dates so we can skip them during expansion
    const exceptionKey = (parentId: string, dateStr: string) => `${parentId}::${dateStr}`;
    const exceptionDates = new Set<string>();
    for (const ex of exceptions) {
      exceptionDates.add(exceptionKey(ex.parentEventId!, ex.start.toISOString().slice(0, 10)));
    }

    // Expand recurring events — serialize FIRST so occurrences inherit
    // properly shaped participants/transport (flat objects, ISO date strings).
    const expanded: any[] = [];
    for (const e of events) {
      if (e.recurrenceRule) {
        const serialized = serializeEvent(e);
        const occurrences = recurrenceService.expand(serialized, params.from, params.to);
        // Skip dates that have exceptions (the exception replaces the occurrence)
        for (const occ of occurrences) {
          if (!exceptionDates.has(exceptionKey(e.id, occ.start.slice(0, 10)))) {
            expanded.push(occ);
          }
        }
      } else {
        expanded.push(serializeEvent(e));
      }
    }

    // Add non-cancelled exceptions to the result
    for (const ex of exceptions) {
      if (ex.status !== 'CANCELLED') expanded.push(serializeEvent(ex));
    }

    return expanded.sort((a, b) => a.start.localeCompare(b.start));
  },

  async findById(id: string) {
    const event = await prisma.event.findUnique({ where: { id }, include: EVENT_INCLUDE });
    if (!event) throw createError(404, 'Event not found', 'NOT_FOUND');
    return serializeEvent(event);
  },

  async create(data: CreateEventInput, userId: string, userRole: string) {
    const status = userRole === 'KID' ? 'PROPOSED' : 'APPROVED';

    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        eventTypeId: data.eventTypeId,
        start: new Date(data.start),
        end: new Date(data.end),
        allDay: data.allDay ?? false,
        location: data.location,
        colorOverride: data.colorOverride,
        recurrenceRule: data.recurrenceRule,
        parentEventId: data.parentEventId,
        createdById: userId,
        status,
        transportUserId: data.transportUserId ?? null,
        transportExternalName: data.transportExternalName ?? null,
        transportNote: data.transportNote ?? null,
        // New fields — added via migration 20260713_add_transport_direction
        ...(data.transportDirection !== undefined && { transportDirection: data.transportDirection ?? null } as any),
        ...(data.transportCoversSupervision !== undefined && { transportCoversSupervision: data.transportCoversSupervision ?? null } as any),
        participants: data.participantIds?.length
          ? { create: data.participantIds.map((uid) => ({ userId: uid })) }
          : undefined,
      },
      include: EVENT_INCLUDE,
    });

    const actType = userRole === 'KID' ? 'PROPOSAL_SUBMITTED' : 'EVENT_CREATED';
    await activityService.log(userId, actType, { eventId: event.id, eventTypeId: data.eventTypeId });

    // Log participation activity for each participant so badge evaluation works
    if (data.participantIds?.length) {
      for (const participantId of data.participantIds) {
        if (participantId !== userId) {
          await activityService.log(participantId, 'EVENT_CREATED', { eventId: event.id, eventTypeId: data.eventTypeId, asParticipant: true });
        }
      }
    }

    // Log transport activity for the transport person
    if (data.transportUserId && data.transportUserId !== userId) {
      await activityService.log(data.transportUserId, 'EVENT_CREATED', { eventId: event.id, eventTypeId: data.eventTypeId, asTransport: true });
    }

    return serializeEvent(event);
  },

  /**
   * Create an exception for a single occurrence of a recurring event.
   * The exception is saved as a real child event (parentEventId = parentId)
   * and will replace the generated occurrence on that date.
   */
  async createException(parentId: string, data: CreateEventInput, userId: string) {
    const parent = await prisma.event.findUnique({ where: { id: parentId }, include: EVENT_INCLUDE });
    if (!parent) throw createError(404, 'Parent event not found', 'NOT_FOUND');
    if (!parent.recurrenceRule) throw createError(400, 'Event is not a recurring series', 'BAD_REQUEST');

    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        eventTypeId: data.eventTypeId,
        start: new Date(data.start),
        end: new Date(data.end),
        allDay: data.allDay ?? false,
        location: data.location,
        colorOverride: data.colorOverride,
        recurrenceRule: null, // exceptions are not themselves recurring
        parentEventId: parentId,
        createdById: userId,
        status: parent.status, // inherit parent approval status
        transportUserId: data.transportUserId ?? null,
        transportExternalName: data.transportExternalName ?? null,
        transportNote: data.transportNote ?? null,
        ...(data.transportDirection !== undefined && { transportDirection: data.transportDirection ?? null } as any),
        ...(data.transportCoversSupervision !== undefined && { transportCoversSupervision: data.transportCoversSupervision ?? null } as any),
        participants: data.participantIds?.length
          ? { create: data.participantIds.map((uid) => ({ userId: uid })) }
          : undefined,
      },
      include: EVENT_INCLUDE,
    });

    await activityService.log(userId, 'EVENT_EDITED', { eventId: parentId, note: 'occurrence_exception' });
    return serializeEvent(event);
  },

  /**
   * Cancel a single occurrence of a recurring event by creating a CANCELLED exception.
   * The expansion logic will skip this date when generating occurrences.
   */
  async cancelOccurrence(parentId: string, occurrenceDate: string, userId: string) {
    const parent = await prisma.event.findUnique({ where: { id: parentId } });
    if (!parent) throw createError(404, 'Parent event not found', 'NOT_FOUND');
    if (!parent.recurrenceRule) throw createError(400, 'Event is not a recurring series', 'BAD_REQUEST');

    const durationMs = parent.end.getTime() - parent.start.getTime();
    const occStart = new Date(`${occurrenceDate}T${parent.start.toISOString().slice(11)}`);
    const occEnd = new Date(occStart.getTime() + durationMs);

    // Upsert so double-cancels are idempotent
    const existing = await prisma.event.findFirst({
      where: { parentEventId: parentId, start: occStart },
    });
    if (existing) {
      await prisma.event.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
    } else {
      await prisma.event.create({
        data: {
          title: parent.title,
          description: parent.description,
          eventTypeId: parent.eventTypeId,
          start: occStart,
          end: occEnd,
          allDay: parent.allDay,
          parentEventId: parentId,
          recurrenceRule: null,
          createdById: userId,
          status: 'CANCELLED',
        },
      });
    }

    await activityService.log(userId, 'EVENT_EDITED', { eventId: parentId, note: 'occurrence_cancelled' });
    return { ok: true };
  },

  async update(id: string, data: UpdateEventInput, userId: string) {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) throw createError(404, 'Event not found', 'NOT_FOUND');
    if (existing.status === 'CANCELLED') throw createError(400, 'Cannot edit a cancelled event', 'INVALID_STATE');

    const event = await prisma.event.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        eventTypeId: data.eventTypeId,
        start: data.start ? new Date(data.start) : undefined,
        end: data.end ? new Date(data.end) : undefined,
        allDay: data.allDay,
        location: data.location,
        colorOverride: data.colorOverride,
        recurrenceRule: data.recurrenceRule,
        ...(data.transportUserId !== undefined && { transportUserId: data.transportUserId ?? null }),
        ...(data.transportExternalName !== undefined && { transportExternalName: data.transportExternalName ?? null }),
        ...(data.transportNote !== undefined && { transportNote: data.transportNote ?? null }),
        ...(data.transportDirection !== undefined && { transportDirection: data.transportDirection ?? null } as any),
        ...(data.transportCoversSupervision !== undefined && { transportCoversSupervision: data.transportCoversSupervision ?? null } as any),
        ...(data.participantIds !== undefined && {
          participants: {
            deleteMany: {},
            create: data.participantIds.map((uid) => ({ userId: uid })),
          },
        }),
      },
      include: EVENT_INCLUDE,
    });

    await activityService.log(userId, 'EVENT_EDITED', { eventId: id });
    return serializeEvent(event);
  },

  async approve(id: string, adminId: string) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw createError(404, 'Event not found', 'NOT_FOUND');
    if (event.status !== 'PROPOSED') throw createError(400, 'Event is not in PROPOSED state', 'INVALID_STATE');

    const updated = await prisma.event.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: EVENT_INCLUDE,
    });

    await activityService.log(event.createdById, 'PROPOSAL_APPROVED', { eventId: id, approvedBy: adminId });
    await activityService.log(adminId, 'PROPOSAL_APPROVED', { eventId: id });
    return serializeEvent(updated);
  },

  async reject(id: string, adminId: string) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw createError(404, 'Event not found', 'NOT_FOUND');
    if (event.status !== 'PROPOSED') throw createError(400, 'Event is not in PROPOSED state', 'INVALID_STATE');

    const updated = await prisma.event.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: EVENT_INCLUDE,
    });

    await activityService.log(event.createdById, 'PROPOSAL_REJECTED', { eventId: id });
    return serializeEvent(updated);
  },

  async cancel(id: string, userId: string) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw createError(404, 'Event not found', 'NOT_FOUND');
    if (event.status === 'CANCELLED') return serializeEvent(event);

    const updated = await prisma.event.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: EVENT_INCLUDE,
    });

    await activityService.log(userId, 'EVENT_DELETED', { eventId: id });
    return serializeEvent(updated);
  },

  async getProposals() {
    const events = await prisma.event.findMany({
      where: { status: 'PROPOSED' },
      include: EVENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return events.map(serializeEvent);
  },
};

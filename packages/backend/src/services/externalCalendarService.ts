/**
 * externalCalendarService — import ICS calendars (file upload or subscribe-URL).
 *
 * Events are upserted keyed by externalUid so re-syncing is idempotent.
 */
import ical from 'node-ical';
import { prisma } from '../db.js';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../logger.js';

type IcalEvent = ical.VEvent;

function isVEvent(obj: unknown): obj is IcalEvent {
  return !!obj && typeof obj === 'object' && (obj as Record<string, unknown>)['type'] === 'VEVENT';
}

async function parseAndUpsert(
  subscriptionId: string,
  userId: string,
  events: ical.CalendarResponse,
) {
  let upserted = 0;
  const seenUids = new Set<string>();

  for (const [, raw] of Object.entries(events)) {
    if (!isVEvent(raw)) continue;
    const ev = raw as IcalEvent;
    const uid = ev.uid;
    if (!uid) continue;
    seenUids.add(uid);

    const start = ev.start instanceof Date ? ev.start : new Date(ev.start as unknown as string);
    const end = ev.end instanceof Date ? ev.end : new Date(ev.end as unknown as string);
    if (isNaN(start.getTime())) continue;

    const title = typeof ev.summary === 'string'
      ? ev.summary
      : (ev.summary as { val?: string } | undefined)?.val ?? '(Bez názvu)';
    const description = typeof ev.description === 'string' ? ev.description : undefined;
    const location = typeof ev.location === 'string' ? ev.location : undefined;

    const existing = await prisma.event.findFirst({
      where: { externalUid: uid, externalSourceId: subscriptionId },
    });

    if (existing) {
      await prisma.event.update({
        where: { id: existing.id },
        data: { title, description, location, start, end },
      });
    } else {
      await prisma.event.create({
        data: {
          title,
          description,
          location,
          start,
          end,
          allDay: !!(ev as unknown as Record<string, unknown>)['datetype']?.toString().includes('date'),
          status: 'APPROVED',
          isExternalImport: true,
          externalUid: uid,
          externalSourceId: subscriptionId,
          createdById: userId,
          participants: { create: [{ userId }] },
        },
      });
    }
    upserted++;
  }

  // Remove events whose UID is no longer in the feed
  await prisma.event.deleteMany({
    where: {
      externalSourceId: subscriptionId,
      externalUid: { notIn: [...seenUids] },
    },
  });

  return upserted;
}

export const externalCalendarService = {
  async importFromText(userId: string, name: string, icsText: string) {
    const sub = await prisma.externalCalendarSubscription.create({
      data: { userId, name, icsUrl: null, isActive: true },
    });
    const events = ical.parseICS(icsText);
    const count = await parseAndUpsert(sub.id, userId, events);
    await prisma.externalCalendarSubscription.update({
      where: { id: sub.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: 'OK' },
    });
    return { subscriptionId: sub.id, imported: count };
  },

  async createSubscription(userId: string, name: string, icsUrl: string) {
    const sub = await prisma.externalCalendarSubscription.create({
      data: { userId, name, icsUrl, isActive: true },
    });
    // Run first sync right away
    await this.sync(sub.id);
    return sub;
  },

  async sync(subscriptionId: string) {
    const sub = await prisma.externalCalendarSubscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw createError(404, 'Subscription not found', 'NOT_FOUND');
    if (!sub.icsUrl) {
      // File-only import; no re-sync URL
      return { subscriptionId, imported: 0 };
    }

    try {
      const res = await fetch(sub.icsUrl, {
        headers: { 'User-Agent': 'Rodinka/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const events = ical.parseICS(text);
      const imported = await parseAndUpsert(sub.id, sub.userId, events);
      await prisma.externalCalendarSubscription.update({
        where: { id: sub.id },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'OK', lastSyncError: null },
      });
      return { subscriptionId, imported };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ subscriptionId, err: msg }, 'External calendar sync failed');
      await prisma.externalCalendarSubscription.update({
        where: { id: sub.id },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'ERROR', lastSyncError: msg },
      });
      throw createError(502, `Synchronizace selhala: ${msg}`, 'SYNC_ERROR');
    }
  },

  async list(userId: string) {
    return prisma.externalCalendarSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { events: true } } },
    });
  },

  async remove(subscriptionId: string) {
    // Delete events imported from this subscription
    await prisma.event.deleteMany({ where: { externalSourceId: subscriptionId } });
    await prisma.externalCalendarSubscription.delete({ where: { id: subscriptionId } });
  },

  /** Called by daily cron job to sync all URL subscriptions */
  async syncAll() {
    const subs = await prisma.externalCalendarSubscription.findMany({
      where: { isActive: true, icsUrl: { not: null } },
    });
    for (const sub of subs) {
      try {
        await this.sync(sub.id);
      } catch {
        // Errors already logged in sync(); keep going
      }
    }
  },
};

import { prisma } from '../db.js';
import { notificationService } from '../services/notificationService.js';
import { logger } from '../logger.js';
import { loadFlags } from '../middleware/flagMiddleware.js';
import { addMinutes, formatISO } from 'date-fns';

let running = false;

export const reminderJob = {
  async run(): Promise<void> {
    if (running) {
      logger.debug('Reminder job already running, skipping');
      return;
    }
    running = true;
    const start = Date.now();
    let processed = 0;

    try {
      const flags = await loadFlags();
      if (!flags['email_notifications'] && !flags['push_notifications']) return;

      // Find events starting in the next 60 minutes that haven't been reminded
      const now = new Date();
      const windowEnd = addMinutes(now, 65);

      const events = await prisma.event.findMany({
        where: {
          status: 'APPROVED',
          start: { gte: now, lte: windowEnd },
        },
        include: {
          participants: { include: { user: { select: { id: true, name: true, email: true, preferredLanguage: true, notifPrefs: true } } } },
          eventType: { select: { nameCs: true, nameEn: true } },
        },
      });

      for (const event of events) {
        for (const participant of event.participants) {
          const user = participant.user;
          const prefs = user.notifPrefs as any;
          const reminderOffset = prefs?.reminderMinutesBefore ?? 60;
          const reminderTime = new Date(event.start.getTime() - reminderOffset * 60_000);

          if (reminderTime > now) continue; // not yet time for this user's preference

          const dateStr = formatISO(event.start, { representation: 'date' });
          const idempotencyKey = `reminder:${user.id}:${event.id}:${dateStr}`;
          const title = event.eventType?.nameCs ?? event.title;
          const startStr = event.start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' });
          const body = `${title} začíná v ${startStr}${event.location ? ` — ${event.location}` : ''}`;

          if (flags['email_notifications'] && prefs?.emailReminders !== false) {
            await notificationService.sendEmail({
              to: user.email,
              subject: `Připomínka: ${title}`,
              html: `<p>Připomínka: <strong>${title}</strong> začíná dnes v <strong>${startStr}</strong>${event.location ? ` (${event.location})` : ''}.</p>`,
              idempotencyKey: `email:${idempotencyKey}`,
              userId: user.id,
              eventId: event.id,
              type: 'EVENT_REMINDER',
            });
          }

          if (flags['push_notifications'] && prefs?.pushReminders !== false) {
            await notificationService.sendPush({
              userId: user.id,
              title: `Připomínka: ${title}`,
              body,
              url: `/event/${event.id}`,
              idempotencyKey: `push:${idempotencyKey}`,
              eventId: event.id,
              type: 'EVENT_REMINDER',
            });
          }

          processed++;
        }
      }

      logger.info({ processed, durationMs: Date.now() - start }, 'Reminder job complete');
    } finally {
      running = false;
    }
  },
};

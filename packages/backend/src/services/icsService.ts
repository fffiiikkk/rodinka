import ical from 'ical-generator';
import { prisma } from '../db.js';
import { createError } from '../middleware/errorHandler.js';
import { config } from '../config.js';
import { recurrenceService } from './recurrenceService.js';
import { addDays } from 'date-fns';

export const icsService = {
  async generateForUser(icsToken: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { icsToken } });
    if (!user || !user.isActive) throw createError(404, 'Feed not found', 'NOT_FOUND');

    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    const to = addDays(new Date(), 365);

    const events = await prisma.event.findMany({
      where: {
        status: 'APPROVED',
        start: { gte: from, lte: to },
        OR: [
          { createdById: user.id },
          { participants: { some: { userId: user.id } } },
          { isHoliday: true },
        ],
      },
    });

    const cal = ical({ name: `Rodinný kalendář — ${user.name}`, timezone: 'Europe/Prague' });

    for (const e of events) {
      if (e.recurrenceRule) {
        const occurrences = recurrenceService.expand(e, from, to) as Array<{ start: string; end: string; title: string; location: unknown; description: unknown }>;
        for (const occ of occurrences) {
          cal.createEvent({
            start: new Date(occ.start),
            end: new Date(occ.end),
            summary: occ.title,
            location: typeof occ.location === 'string' ? occ.location : undefined,
            description: typeof occ.description === 'string' ? occ.description : undefined,
            url: `${config.appUrl}/event/${e.id}`,
          });
        }
      } else {
        cal.createEvent({
          start: e.start,
          end: e.end,
          allDay: e.allDay,
          summary: e.title,
          location: e.location ?? undefined,
          description: e.description ?? undefined,
          url: `${config.appUrl}/event/${e.id}`,
        });
      }
    }

    return cal.toString();
  },
};

import { prisma } from '../db.js';
import { notificationService } from '../services/notificationService.js';
import { logger } from '../logger.js';
import { loadFlags } from '../middleware/flagMiddleware.js';
import { addDays, startOfWeek, endOfWeek, format } from 'date-fns';
import { cs } from 'date-fns/locale';

let running = false;

export const weeklyDigestJob = {
  async run(): Promise<void> {
    if (running) return;
    running = true;
    let sent = 0;

    try {
      const flags = await loadFlags();
      if (!flags['email_notifications'] || !flags['weekly_digest']) return;

      const nextWeekStart = startOfWeek(addDays(new Date(), 1), { weekStartsOn: 1 });
      const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });

      const users = await prisma.user.findMany({
        where: { isActive: true, role: { not: 'GUEST' }, username: { not: 'system' } },
        select: { id: true, name: true, email: true, notifPrefs: true },
      });

      for (const user of users) {
        const prefs = user.notifPrefs as any;
        if (!prefs?.emailWeeklyDigest) continue;

        const events = await prisma.event.findMany({
          where: {
            status: 'APPROVED',
            start: { gte: nextWeekStart, lte: nextWeekEnd },
            OR: [
              { createdById: user.id },
              { participants: { some: { userId: user.id } } },
            ],
          },
          orderBy: { start: 'asc' },
          include: { eventType: { select: { nameCs: true } } },
        });

        if (events.length === 0) continue;

        const weekLabel = `${format(nextWeekStart, 'd. M.', { locale: cs })} – ${format(nextWeekEnd, 'd. M. yyyy', { locale: cs })}`;
        const rows = events
          .map((e) => {
            const day = format(e.start, 'EEEE d.M.', { locale: cs });
            const time = e.allDay ? 'celý den' : format(e.start, 'HH:mm', { locale: cs });
            const type = e.eventType?.nameCs ?? '';
            return `<tr><td>${day}</td><td>${time}</td><td>${e.title}${type ? ` (${type})` : ''}</td><td>${e.location ?? ''}</td></tr>`;
          })
          .join('');

        const html = `
          <h2>Týdenní přehled: ${weekLabel}</h2>
          <p>Dobrý den, ${user.name},</p>
          <p>Tady je váš přehled na příští týden:</p>
          <table border="1" cellpadding="6" style="border-collapse:collapse">
            <thead><tr><th>Den</th><th>Čas</th><th>Událost</th><th>Místo</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p><a href="${process.env['APP_URL'] ?? 'http://localhost:3000'}">Otevřít kalendář</a></p>`;

        await notificationService.sendEmail({
          to: user.email,
          subject: `Váš týdenní přehled: ${weekLabel}`,
          html,
          idempotencyKey: `weekly:${user.id}:${format(nextWeekStart, 'yyyy-ww')}`,
          userId: user.id,
          type: 'WEEKLY_DIGEST',
        });

        sent++;
      }

      logger.info({ sent }, 'Weekly digest job complete');
    } finally {
      running = false;
    }
  },
};

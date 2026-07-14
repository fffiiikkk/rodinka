import cron from 'node-cron';
import { logger } from '../logger.js';
import { reminderJob } from './reminderJob.js';
import { weeklyDigestJob } from './weeklyDigestJob.js';
import { externalCalendarService } from '../services/externalCalendarService.js';

export function startScheduler(): void {
  // Event reminders — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try { await reminderJob.run(); }
    catch (e) { logger.error({ e }, 'Reminder job error'); }
  });

  // Weekly digest — Sunday 18:00
  cron.schedule('0 18 * * 0', async () => {
    try { await weeklyDigestJob.run(); }
    catch (e) { logger.error({ e }, 'Weekly digest job error'); }
  });

  // External calendar sync — daily at 03:00
  cron.schedule('0 3 * * *', async () => {
    try { await externalCalendarService.syncAll(); }
    catch (e) { logger.error({ e }, 'External calendar sync error'); }
  });

  logger.info('Scheduler started');
}

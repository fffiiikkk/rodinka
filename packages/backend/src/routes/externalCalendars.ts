import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { externalCalendarService } from '../services/externalCalendarService.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

/** GET /api/external-calendars  — list for the current user */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    // Admins can view/manage any user's subscriptions via ?userId=
    const userId = (req.query.userId as string | undefined) && req.session.role === 'PARENT'
      ? (req.query.userId as string)
      : req.session.userId!;
    const subs = await externalCalendarService.list(userId);
    res.json({ subscriptions: subs });
  } catch (e) { next(e); }
});

/** POST /api/external-calendars  — create from URL or icsText */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, icsUrl, icsText } = req.body as {
      name?: string;
      icsUrl?: string;
      icsText?: string;
    };
    if (!name) { res.status(400).json({ error: 'name required' }); return; }

    const userId = req.session.userId!;
    if (icsUrl) {
      const sub = await externalCalendarService.createSubscription(userId, name, icsUrl);
      res.json({ subscription: sub });
    } else if (icsText) {
      const result = await externalCalendarService.importFromText(userId, name, icsText);
      res.json(result);
    } else {
      throw createError(400, 'icsUrl or icsText required', 'VALIDATION_ERROR');
    }
  } catch (e) { next(e); }
});

/** POST /api/external-calendars/:id/sync */
router.post('/:id/sync', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params['id']);
    const result = await externalCalendarService.sync(id);
    res.json(result);
  } catch (e) { next(e); }
});

/** DELETE /api/external-calendars/:id */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params['id']);
    await externalCalendarService.remove(id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;

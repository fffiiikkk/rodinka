import { Router } from 'express';
import { EventQuerySchema, CreateEventSchema, UpdateEventSchema } from '@rodinkal/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { eventService } from '../services/eventService.js';
import { badgeService } from '../services/badgeService.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const params = EventQuerySchema.parse(req.query);
    const events = await eventService.query({
      from: new Date(params.from),
      to: new Date(params.to),
      userId: params.userId,
      eventTypeId: params.eventTypeId,
      status: params.status,
      includeHolidays: params.includeHolidays,
      expandRecurring: params.expandRecurring,
    });
    res.json({ events });
  } catch (e) { next(e); }
});

router.get('/proposals', requireRole('PARENT'), async (req, res, next) => {
  try {
    const proposals = await eventService.getProposals();
    res.json({ proposals });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const event = await eventService.findById(req.params['id']!);
    res.json({ event });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const user = req.user!;
    // Kids can only propose if flag is on
    if (user.role === 'KID' && !req.flags['kid_proposals']) {
      res.status(403).json({ error: 'Kid proposals are disabled', code: 'FEATURE_DISABLED' });
      return;
    }

    const data = CreateEventSchema.parse(req.body);
    const event = await eventService.create(data, user.id, user.role);

    // Fire-and-forget badge evaluation
    void badgeService.evaluateForUser(user.id);

    res.status(201).json({ event });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = UpdateEventSchema.parse(req.body);
    const event = await eventService.update(req.params['id']!, data, req.user!.id);
    void badgeService.evaluateForUser(req.user!.id);
    res.json({ event });
  } catch (e) { next(e); }
});

router.post('/:id/approve', requireRole('PARENT'), async (req, res, next) => {
  try {
    const event = await eventService.approve(req.params['id'] as string, req.user!.id);
    void badgeService.evaluateForUser(event.createdById);
    res.json({ event });
  } catch (e) { next(e); }
});

router.post('/:id/reject', requireRole('PARENT'), async (req, res, next) => {
  try {
    const event = await eventService.reject(req.params['id'] as string, req.user!.id);
    res.json({ event });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const event = await eventService.cancel(req.params['id']!, req.user!.id);
    res.json({ event });
  } catch (e) { next(e); }
});

export default router;

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

    // Evaluate badges for everyone involved: creator, participants, transport person
    const involvedUserIds = new Set<string>([user.id]);
    if (data.participantIds) data.participantIds.forEach((id) => involvedUserIds.add(id));
    if (data.transportUserId) involvedUserIds.add(data.transportUserId);
    for (const uid of involvedUserIds) void badgeService.evaluateForUser(uid);

    res.status(201).json({ event });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = UpdateEventSchema.parse(req.body);
    const event = await eventService.update(req.params['id']!, data, req.user!.id);
    // Evaluate for everyone involved
    const involvedUserIds = new Set<string>([req.user!.id]);
    event.participants.forEach((p) => involvedUserIds.add(p.userId));
    if (event.transport?.userId) involvedUserIds.add(event.transport.userId);
    for (const uid of involvedUserIds) void badgeService.evaluateForUser(uid);
    res.json({ event });
  } catch (e) { next(e); }
});

// Create an exception for one occurrence of a recurring series
router.post('/:id/exception', async (req, res, next) => {
  try {
    const data = CreateEventSchema.parse(req.body);
    const event = await eventService.createException(req.params['id']!, data, req.user!.id);
    res.status(201).json({ event });
  } catch (e) { next(e); }
});

// Cancel one occurrence of a recurring series (date = yyyy-MM-dd)
router.delete('/:id/occurrence/:date', async (req, res, next) => {
  try {
    const result = await eventService.cancelOccurrence(
      req.params['id']!,
      req.params['date']!,
      req.user!.id,
    );
    res.json(result);
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

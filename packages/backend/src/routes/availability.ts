import { Router } from 'express';
import { AvailabilityQuerySchema, CreateAvailabilitySchema, UpdateAvailabilitySchema } from '@rodinkal/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { availabilityService } from '../services/availabilityService.js';
import { badgeService } from '../services/badgeService.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { from, to, userId } = AvailabilityQuerySchema.parse(req.query);
    const items = await availabilityService.query(new Date(from), new Date(to), userId);
    res.json({ items });
  } catch (e) { next(e); }
});

router.get('/coverage-gaps', requireRole('PARENT'), async (req, res, next) => {
  try {
    const { from, to } = AvailabilityQuerySchema.parse(req.query);
    const gaps = await availabilityService.getCoverageGaps(new Date(from), new Date(to));
    res.json({ gaps });
  } catch (e) { next(e); }
});

router.post('/', requireRole('PARENT', 'GRANDPARENT', 'RELATIVE'), async (req, res, next) => {
  try {
    const data = CreateAvailabilitySchema.parse(req.body);
    // Admins can create on behalf of any user (for external coverage use req.user!.id as owner)
    const targetUserId = (req.user!.role === 'PARENT' && req.body.userId)
      ? String(req.body.userId)
      : req.user!.id;
    const item = await availabilityService.create(targetUserId, data);
    void badgeService.evaluateForUser(req.user!.id);
    res.status(201).json({ item });
  } catch (e) { next(e); }
});

router.patch('/:id', requireRole('PARENT', 'GRANDPARENT', 'RELATIVE'), async (req, res, next) => {
  try {
    const data = UpdateAvailabilitySchema.parse(req.body);
    const item = await availabilityService.update(req.params['id'] as string, req.user!.id, data);
    res.json({ item });
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('PARENT', 'GRANDPARENT', 'RELATIVE'), async (req, res, next) => {
  try {
    await availabilityService.delete(req.params['id'] as string, req.user!.id, req.user!.role === 'PARENT');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;

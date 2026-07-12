import { Router } from 'express';
import { CreateEventTypeSchema } from '@rodinkal/shared';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    const types = await prisma.eventType.findMany({
      where: { isActive: true },
      orderBy: [{ groupCs: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json({ types });
  } catch (e) { next(e); }
});

router.get('/all', requireAdmin, async (_req, res, next) => {
  try {
    const types = await prisma.eventType.findMany({ orderBy: [{ groupCs: 'asc' }, { sortOrder: 'asc' }] });
    res.json({ types });
  } catch (e) { next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const data = CreateEventTypeSchema.parse(req.body);
    const type = await prisma.eventType.create({ data });
    res.status(201).json({ type });
  } catch (e) { next(e); }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = CreateEventTypeSchema.partial().parse(req.body);
    const type = await prisma.eventType.update({ where: { id: req.params['id'] as string }, data });
    res.json({ type });
  } catch (e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    // Soft delete: set isActive = false
    await prisma.eventType.update({ where: { id: req.params['id'] as string }, data: { isActive: false } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;

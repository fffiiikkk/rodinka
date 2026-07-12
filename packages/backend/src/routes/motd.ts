import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { prisma } from '../db.js';
import type { Role } from '@rodinkal/shared';

const router = Router();
router.use(requireAuth);

const MotdSchema = z.object({
  textCs: z.string().min(1).max(100_000),
  textEn: z.string().min(1).max(100_000),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  audience: z.enum(['ALL', 'KIDS', 'ADULTS']).default('ALL'),
  isActive: z.boolean().default(true),
});

router.get('/active', async (req, res, next) => {
  try {
    if (!req.flags['motd']) { res.json({ motd: null }); return; }

    const now = new Date();
    const role = req.user?.role as Role | undefined;
    const audienceFilter = role === 'KID'
      ? { audience: { in: ['ALL', 'KIDS'] as any } }
      : { audience: { in: ['ALL', 'ADULTS'] as any } };

    const motd = await prisma.messageOfTheDay.findFirst({
      where: { isActive: true, validFrom: { lte: now }, validTo: { gte: now }, ...audienceFilter },
      orderBy: { validFrom: 'desc' },
    });

    res.json({ motd });
  } catch (e) { next(e); }
});

router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const items = await prisma.messageOfTheDay.findMany({ orderBy: { validFrom: 'desc' } });
    res.json({ items });
  } catch (e) { next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const data = MotdSchema.parse(req.body);
    const motd = await prisma.messageOfTheDay.create({
      data: {
        ...data,
        validFrom: new Date(data.validFrom),
        validTo: new Date(data.validTo),
        author: { connect: { id: req.user!.id } },
      } as any,
    });
    res.status(201).json({ motd });
  } catch (e) { next(e); }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = MotdSchema.partial().parse(req.body);
    const motd = await prisma.messageOfTheDay.update({
      where: { id: req.params['id'] as string },
      data: {
        ...data,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validTo: data.validTo ? new Date(data.validTo) : undefined,
      },
    });
    res.json({ motd });
  } catch (e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await prisma.messageOfTheDay.update({ where: { id: req.params['id'] as string }, data: { isActive: false } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;

import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { invalidateFlagCache } from '../middleware/flagMiddleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    res.json({ flags });
  } catch (e) { next(e); }
});

router.patch('/:key', requireAdmin, async (req, res, next) => {
  try {
    const { enabled } = req.body as { enabled: boolean };
    const flag = await prisma.featureFlag.upsert({
      where: { key: req.params['key'] as string },
      update: { enabled },
      create: { key: req.params['key'] as string, enabled },
    });
    invalidateFlagCache();
    res.json({ flag });
  } catch (e) { next(e); }
});

export default router;

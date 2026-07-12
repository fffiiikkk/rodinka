import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { badgeService } from '../services/badgeService.js';
import { prisma } from '../db.js';

const router = Router();
router.use(requireAuth);

router.get('/definitions', async (_req, res, next) => {
  try {
    const definitions = await prisma.badgeDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json({ definitions });
  } catch (e) { next(e); }
});

router.get('/me', async (req, res, next) => {
  try {
    const badges = await badgeService.getUserBadges(req.user!.id);
    res.json({ badges });
  } catch (e) { next(e); }
});

router.get('/me/unseen', async (req, res, next) => {
  try {
    const badges = await badgeService.getUnseenBadges(req.user!.id);
    res.json({ badges });
  } catch (e) { next(e); }
});

router.post('/me/mark-seen', async (req, res, next) => {
  try {
    await badgeService.markSeen(req.user!.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/me/progress', async (req, res, next) => {
  try {
    const progress = await badgeService.getProgress(req.user!.id);
    res.json({ progress });
  } catch (e) { next(e); }
});

router.get('/user/:userId', async (req, res, next) => {
  try {
    const badges = await badgeService.getUserBadges(req.params['userId']!);
    res.json({ badges });
  } catch (e) { next(e); }
});

export default router;

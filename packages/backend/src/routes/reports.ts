import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { reportService } from '../services/reportService.js';
import { availabilityService } from '../services/availabilityService.js';

const router = Router();
router.use(requireAuth, requireAdmin);

function parseDateRange(req: any) {
  const from = new Date(req.query['from'] as string);
  const to = new Date(req.query['to'] as string);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new Error('Invalid date range');
  return { from, to };
}

router.get('/activity', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const userId = req.query['userId'] as string | undefined;
    const data = userId
      ? await reportService.userActivity(userId, from, to)
      : await reportService.allUsersActivity(from, to);
    res.json({ data });
  } catch (e) { next(e); }
});

router.get('/free-time', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const userId = req.query['userId'] as string;
    const awakeStart = parseInt(String(req.query['awakeStart'] ?? '7'), 10);
    const awakeEnd = parseInt(String(req.query['awakeEnd'] ?? '21'), 10);
    const data = await reportService.freeTime(userId, from, to, awakeStart, awakeEnd);
    res.json({ data });
  } catch (e) { next(e); }
});

router.get('/coverage-gaps', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const gaps = await availabilityService.getCoverageGaps(from, to);
    res.json({ gaps, total: gaps.length });
  } catch (e) { next(e); }
});

router.get('/occupancy', async (req, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const userId = req.query['userId'] as string;
    const data = await reportService.occupancySummary(userId, from, to);
    res.json({ data });
  } catch (e) { next(e); }
});

export default router;

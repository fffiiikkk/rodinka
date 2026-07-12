import { Router } from 'express';
import { icsService } from '../services/icsService.js';

const router = Router();

// Public endpoint — auth via secret ICS token embedded in URL
router.get('/:token.ics', async (req, res, next) => {
  try {
    const cal = await icsService.generateForUser(req.params['token']!);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rodinny-kalendar.ics"');
    res.send(cal);
  } catch (e) { next(e); }
});

export default router;

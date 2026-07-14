import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { geocodeService } from '../services/geocodeService.js';

const router = Router();

/** POST /api/geocode  { address: string } -> { lat, lng, displayName } | null */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { address } = req.body as { address?: string };
    if (!address?.trim()) { res.status(400).json({ error: 'address required' }); return; }
    const result = await geocodeService.geocode(address);
    res.json(result ?? null);
  } catch (e) { next(e); }
});

export default router;

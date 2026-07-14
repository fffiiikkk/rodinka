import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { geocodeService } from '../services/geocodeService.js';

const router = Router();

/** POST /api/geocode  { address: string }
 *  200  → { lat, lng, displayName }
 *  404  → { error: 'not_found' }   — Nominatim returned no results
 *  502  → { error: 'geocode_error', message } — network / timeout
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { address } = req.body as { address?: string };
    if (!address?.trim()) { res.status(400).json({ error: 'address required' }); return; }

    const outcome = await geocodeService.geocodeWithReason(address);

    if (outcome.ok) {
      res.json(outcome.result);
      return;
    }

    if (outcome.reason === 'not_found') {
      res.status(404).json({ error: 'not_found', message: outcome.message });
    } else {
      res.status(502).json({ error: 'geocode_error', message: outcome.message });
    }
  } catch (e) { next(e); }
});

export default router;

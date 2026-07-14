/**
 * Giphy proxy — keeps GIPHY_API_KEY off the client.
 * GET /api/giphy/search?q=<query>&limit=<n>
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'GIPHY_API_KEY not configured', results: [] });
      return;
    }
    const q = (req.query.q as string | undefined) ?? '';
    const limit = Math.min(parseInt((req.query.limit as string | undefined) ?? '20', 10), 50);
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Giphy HTTP ${response.status}`);
    const data = await response.json() as { data: unknown[] };
    // Forward only the data array (no API key leakage)
    res.json({ results: data.data ?? [] });
  } catch (e) { next(e); }
});

export default router;

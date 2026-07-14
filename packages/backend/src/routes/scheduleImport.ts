import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { parseCsv, scheduleImportService, CSV_TEMPLATE } from '../services/scheduleImportService.js';

const router = Router();

/** Download a ready-to-use CSV template */
router.get('/template.csv', requireAdmin, (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="rozvrh-sablona.csv"');
  res.send('\uFEFF' + CSV_TEMPLATE); // BOM so Excel opens with correct encoding
});

/** Preview rows without writing to DB */
router.post('/preview', requireAdmin, (req, res) => {
  const { csvText } = req.body as { csvText?: string };
  if (!csvText) { res.status(400).json({ error: 'csvText required' }); return; }
  const rows = parseCsv(csvText);
  res.json({ rows });
});

/** Commit a parsed set of rows as recurring events */
router.post('/commit', requireAdmin, async (req, res, next) => {
  try {
    const { name, targetUserId, validFrom, validTo, rows } = req.body as {
      name: string;
      targetUserId: string;
      validFrom: string;
      validTo?: string;
      rows: ReturnType<typeof parseCsv>;
    };
    if (!name || !targetUserId || !validFrom || !rows?.length) {
      res.status(400).json({ error: 'name, targetUserId, validFrom, rows required' });
      return;
    }
    const result = await scheduleImportService.commit({
      name, targetUserId, validFrom, validTo, rows, adminId: req.session.userId!,
    });
    res.json(result);
  } catch (e) { next(e); }
});

/** List all existing schedule imports */
router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const imports = await scheduleImportService.list();
    res.json({ imports });
  } catch (e) { next(e); }
});

/** Replace (re-import) an existing schedule */
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, targetUserId, validFrom, validTo, rows } = req.body as {
      name: string;
      targetUserId: string;
      validFrom: string;
      validTo?: string;
      rows: ReturnType<typeof parseCsv>;
    };
    if (!name || !targetUserId || !validFrom || !rows?.length) {
      res.status(400).json({ error: 'name, targetUserId, validFrom, rows required' });
      return;
    }
    const id = String(req.params['id']);
    const result = await scheduleImportService.replace(id, {
      name, targetUserId, validFrom, validTo, rows, adminId: req.session.userId!,
    });
    res.json(result);
  } catch (e) { next(e); }
});

/** Delete an import and its events */
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await scheduleImportService.remove(String(req.params['id']));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;

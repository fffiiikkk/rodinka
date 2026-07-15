import { Router } from 'express';
import multer from 'multer';
import { UpdateUserSchema, AdminUpdateUserSchema, CreateUserSchema } from '@rodinkal/shared';
import { requireAuth, requireAdmin, requireRole } from '../middleware/auth.js';
import { userService } from '../services/userService.js';
import { createError } from '../middleware/errorHandler.js';
import { saveFile, generateKey, fileUrl } from '../lib/s3.js';
import { config } from '../config.js';
import { CZECH_NAME_DAYS } from '../lib/nameDays.js';

const router = Router();
router.use(requireAuth);

// Use memory storage — files go to S3 (or local fallback), not to disk
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Upload own photo — stored in S3 (or local fallback in dev)
router.post('/me/photo', photoUpload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) throw createError(400, 'No file uploaded', 'NO_FILE');
    const key = generateKey('photos', req.file.originalname || 'photo.jpg');
    await saveFile(key, req.file.buffer, req.file.mimetype);
    const url = fileUrl(key);
    await userService.updatePhoto(req.user!.id, key);   // store key, not path
    res.json({ ok: true, photoUrl: url });
  } catch (e) { next(e); }
});

router.get('/me', async (req, res, next) => {
  try {
    const user = await userService.findById(req.user!.id);
    res.json({ user });
  } catch (e) { next(e); }
});

router.patch('/me', async (req, res, next) => {
  try {
    const data = UpdateUserSchema.parse(req.body);
    const user = await userService.update(req.user!.id, data);
    res.json({ user });
  } catch (e) { next(e); }
});

router.patch('/me/theme', async (req, res, next) => {
  try {
    const { theme, colorMode, fontScale } = req.body as { theme: string; colorMode: string; fontScale?: string };
    await userService.updateTheme(req.user!.id, theme, colorMode, fontScale);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/me/ics-token', async (req, res, next) => {
  try {
    const token = await userService.getIcsToken(req.user!.id);
    res.json({ icsUrl: `${config.appUrl}/api/ics/${token}.ics` });
  } catch (e) { next(e); }
});

router.post('/me/ics-token/regenerate', async (req, res, next) => {
  try {
    const token = await userService.regenerateIcsToken(req.user!.id);
    res.json({ icsUrl: `${config.appUrl}/api/ics/${token}.ics` });
  } catch (e) { next(e); }
});

// All active users — for the timeline column picker (all authenticated roles can call this)
router.get('/active', async (req, res, next) => {
  try {
    const users = await userService.listActive();
    res.json({ users });
  } catch (e) { next(e); }
});

// Family members list — returns kids visible to the requesting user.
// PARENT sees all kids; other roles see only their assigned watchedKids
// (falls back to all kids if no assignments have been configured yet).
router.get('/family', async (req, res, next) => {
  try {
    const kids = await userService.listKidsForGuardian(req.user!.id);
    res.json({ members: kids });
  } catch (e) { next(e); }
});

// Admin: list users
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const page = parseInt(String(req.query['page'] ?? '1'), 10);
    const pageSize = parseInt(String(req.query['pageSize'] ?? '50'), 10);
    const result = await userService.listAll(page, pageSize);
    res.json(result);
  } catch (e) { next(e); }
});

// Admin: create user
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const data = CreateUserSchema.parse(req.body);
    const user = await userService.create(data, req.user!.id);
    res.status(201).json({ user });
  } catch (e) { next(e); }
});

// Admin: get specific user
router.get('/:id', requireRole('PARENT', 'GRANDPARENT', 'RELATIVE'), async (req, res, next) => {
  try {
    const user = await userService.findById(req.params['id'] as string);
    res.json({ user });
  } catch (e) { next(e); }
});

// Admin: update user
router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = AdminUpdateUserSchema.parse(req.body);
    const user = await userService.adminUpdate(req.params['id'] as string, data, req.user!.id);
    res.json({ user });
  } catch (e) { next(e); }
});

// Admin: set which kids a guardian watches in the kids timeline.
// Pass { kidIds: string[] } — empty array removes all restrictions (shows all kids).
router.put('/:id/watched-kids', requireAdmin, async (req, res, next) => {
  try {
    const guardianId = req.params['id'] as string;
    const { kidIds } = req.body as { kidIds: string[] };
    if (!Array.isArray(kidIds)) {
      res.status(400).json({ error: 'kidIds must be an array', code: 'VALIDATION_ERROR' });
      return;
    }
    await userService.setWatchedKids(guardianId, kidIds);
    const updated = await userService.getWatchedKidIds(guardianId);
    res.json({ ok: true, watchedKidIds: updated });
  } catch (e) { next(e); }
});

// Admin: get current watched kid IDs for a user
router.get('/:id/watched-kids', requireAdmin, async (req, res, next) => {
  try {
    const kidIds = await userService.getWatchedKidIds(req.params['id'] as string);
    res.json({ watchedKidIds: kidIds });
  } catch (e) { next(e); }
});

// Admin: delete (anonymise) user
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await userService.delete(req.params['id'] as string, req.user!.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Admin: impersonation
router.post('/:id/impersonate', requireAdmin, async (req, res, next) => {
  try {
    req.session.impersonatingId = req.params['id'] as string;
    res.json({ ok: true, impersonating: req.params['id'] as string });
  } catch (e) { next(e); }
});

router.post('/impersonate/stop', requireAuth, (req, res) => {
  delete req.session.impersonatingId;
  res.json({ ok: true });
});

// Admin: password reset
router.post('/:id/admin-reset-password', requireAdmin, async (req, res, next) => {
  try {
    const { newPassword } = req.body as { newPassword: string };
    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'Password too short', code: 'VALIDATION_ERROR' });
      return;
    }
    const { authService } = await import('../services/authService.js');
    await authService.adminResetPassword(req.user!.id, req.params['id'] as string, newPassword);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Return the full Czech nameday calendar so the frontend can do instant name lookups
router.get('/nameday-calendar', requireAdmin, (_req, res) => {
  res.json({ calendar: CZECH_NAME_DAYS });
});

// Admin: list all users with their nameday status (auto-detected + override)
router.get('/namedays', requireAdmin, async (req, res, next) => {
  try {
    const { prisma } = await import('../db.js');
    const users = await prisma.user.findMany({
      where: { isActive: true, username: { not: 'system' } },
      select: { id: true, name: true, nameDayOverride: true },
      orderBy: { name: 'asc' },
    });

    const result = users.map((u) => {
      const firstName = u.name.trim().split(/\s+/)[0] ?? u.name.trim();
      // Auto-detect from static calendar
      const autoMMDD = findFirstNameDayLocal(firstName);
      const effectiveMMDD = u.nameDayOverride ?? autoMMDD;
      const nameDayLabel = effectiveMMDD ? (CZECH_NAME_DAYS[effectiveMMDD] ?? null) : null;
      return {
        id: u.id,
        name: u.name,
        firstName,
        autoMMDD,       // null if not found in calendar
        overrideMMDD: u.nameDayOverride,
        effectiveMMDD,  // what is actually used
        nameDayLabel,
        matched: autoMMDD !== null,
        overridden: u.nameDayOverride !== null,
      };
    });

    res.json({ namedays: result });
  } catch (e) { next(e); }
});

function findFirstNameDayLocal(name: string): string | null {
  const search = name.toLowerCase().normalize('NFC');
  for (const [key, entry] of Object.entries(CZECH_NAME_DAYS)) {
    const parts = entry.split(/\s+a\s+|\s*[,(]/);
    for (const part of parts) {
      const clean = part.trim().replace(/[.)]/g, '').toLowerCase().normalize('NFC');
      if (clean === search) return key;
    }
  }
  return null;
}

export default router;

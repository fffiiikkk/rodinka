import { Router } from 'express';
import multer from 'multer';
import { UpdateUserSchema, AdminUpdateUserSchema, CreateUserSchema } from '@rodinkal/shared';
import { requireAuth, requireAdmin, requireRole } from '../middleware/auth.js';
import { userService } from '../services/userService.js';
import { createError } from '../middleware/errorHandler.js';
import { saveFile, generateKey, fileUrl } from '../lib/s3.js';
import { config } from '../config.js';

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
    const { theme, colorMode } = req.body as { theme: string; colorMode: string };
    await userService.updateTheme(req.user!.id, theme, colorMode);
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

export default router;

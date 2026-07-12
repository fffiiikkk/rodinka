import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LoginSchema, PasswordResetRequestSchema, PasswordResetConfirmSchema, ChangePasswordSchema } from '@rodinkal/shared';
import { authService } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { notificationService } from '../services/notificationService.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, message: { error: 'Too many attempts', code: 'RATE_LIMIT' } });

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = LoginSchema.parse(req.body);
    const user = await authService.login(username, password);
    req.session.userId = user.id;
    req.session.role = user.role as any;
    res.json({ user: { id: user.id, role: user.role, name: user.name }, flags: req.flags });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { userService } = await import('../services/userService.js');
    const user = await userService.findById(req.user!.id);
    res.json({ user: { ...user, isImpersonating: req.user!.isImpersonating }, flags: req.flags });
  } catch (e) { next(e); }
});

router.post('/password-reset/request', rateLimit({ windowMs: 60_000, max: 5 }), async (req, res, next) => {
  try {
    const { email } = PasswordResetRequestSchema.parse(req.body);
    const rawToken = await authService.createPasswordResetToken(email);

    if (rawToken) {
      const user = (await import('../db.js')).prisma.user.findUnique({ where: { email } });
      const u = await user;
      if (u) {
        await notificationService.sendEmail({
          to: email,
          subject: 'Resetování hesla — Rodinný kalendář',
          html: `<p>Klikněte pro resetování hesla (platí 1 hodinu):</p>
                 <a href="${process.env['APP_URL']}/reset-password?token=${rawToken}">Resetovat heslo</a>`,
          idempotencyKey: `pwd-reset:${u.id}:${rawToken.slice(0, 8)}`,
          userId: u.id,
          type: 'PASSWORD_RESET',
        });
      }
    }

    // Always return success (don't reveal existence)
    res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (e) { next(e); }
});

router.post('/password-reset/confirm', async (req, res, next) => {
  try {
    const { token, password } = PasswordResetConfirmSchema.parse(req.body);
    await authService.consumePasswordResetToken(token, password);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: notificationService.getVapidPublicKey() });
});

export default router;

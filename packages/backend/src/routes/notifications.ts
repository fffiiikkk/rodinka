import { Router } from 'express';
import { PushSubscriptionSchema } from '@rodinkal/shared';
import { requireAuth } from '../middleware/auth.js';
import { notificationService } from '../services/notificationService.js';
import { activityService } from '../services/activityService.js';

const router = Router();
router.use(requireAuth);

router.post('/push/subscribe', async (req, res, next) => {
  try {
    if (!req.flags['push_notifications']) {
      res.status(403).json({ error: 'Push notifications disabled', code: 'FEATURE_DISABLED' });
      return;
    }
    const sub = PushSubscriptionSchema.parse(req.body);
    await notificationService.registerPushSubscription(req.user!.id, sub);
    await activityService.log(req.user!.id, 'APP_INSTALLED');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/push/unsubscribe', async (req, res, next) => {
  try {
    const { endpoint } = req.body as { endpoint: string };
    await notificationService.unregisterPushSubscription(req.user!.id, endpoint);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;

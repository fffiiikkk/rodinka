import webpush from 'web-push';
import { Resend } from 'resend';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

if (config.vapidPublicKey && config.vapidPrivateKey) {
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
}

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export const notificationService = {
  async sendEmail(opts: {
    to: string; subject: string; html: string;
    idempotencyKey: string; userId: string; eventId?: string; type: string;
  }): Promise<void> {
    const existing = await prisma.notificationLog.findUnique({ where: { idempotencyKey: opts.idempotencyKey } });
    if (existing) {
      logger.debug({ idempotencyKey: opts.idempotencyKey }, 'Email already sent, skipping');
      return;
    }

    try {
      if (!resend) throw new Error('Resend not configured');
      await resend.emails.send({ from: config.emailFrom, to: opts.to, subject: opts.subject, html: opts.html });

      await prisma.notificationLog.create({
        data: {
          userId: opts.userId,
          eventId: opts.eventId,
          channel: 'EMAIL',
          notificationType: opts.type,
          idempotencyKey: opts.idempotencyKey,
          status: 'SENT',
        },
      });

      logger.info({ userId: opts.userId, type: opts.type }, 'Email sent');
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await prisma.notificationLog.upsert({
        where: { idempotencyKey: opts.idempotencyKey },
        update: {},
        create: {
          userId: opts.userId,
          eventId: opts.eventId,
          channel: 'EMAIL',
          notificationType: opts.type,
          idempotencyKey: opts.idempotencyKey,
          status: 'FAILED',
          error,
        },
      });
      logger.error({ userId: opts.userId, error }, 'Email send failed');
    }
  },

  async sendPush(opts: {
    userId: string; title: string; body: string; url?: string;
    idempotencyKey: string; eventId?: string; type: string;
  }): Promise<void> {
    const existing = await prisma.notificationLog.findUnique({ where: { idempotencyKey: opts.idempotencyKey } });
    if (existing) return;

    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: opts.userId } });
    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({ title: opts.title, body: opts.body, url: opts.url ?? '/' });

    let anyFailed = false;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      } catch (e: any) {
        anyFailed = true;
        if (e.statusCode === 410) {
          // Subscription expired
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }

    await prisma.notificationLog.upsert({
      where: { idempotencyKey: opts.idempotencyKey },
      update: {},
      create: {
        userId: opts.userId,
        eventId: opts.eventId,
        channel: 'PUSH',
        notificationType: opts.type,
        idempotencyKey: opts.idempotencyKey,
        status: anyFailed ? 'FAILED' : 'SENT',
      },
    });
  },

  async registerPushSubscription(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      create: { userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    });
  },

  async unregisterPushSubscription(userId: string, endpoint: string) {
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  },

  getVapidPublicKey(): string {
    return config.vapidPublicKey;
  },
};

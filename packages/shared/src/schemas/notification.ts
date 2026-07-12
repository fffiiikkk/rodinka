import { z } from 'zod';

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export const NotificationPrefsSchema = z.object({
  emailReminders: z.boolean(),
  emailWeeklyDigest: z.boolean(),
  pushReminders: z.boolean(),
  pushProposalUpdates: z.boolean(),
  reminderMinutesBefore: z.number().int().min(0).max(10080).default(60),
});

export type PushSubscriptionInput = z.infer<typeof PushSubscriptionSchema>;
export type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>;

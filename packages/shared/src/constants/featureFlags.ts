import type { FeatureFlagsMap } from '../types/index.js';

export const FEATURE_FLAG_KEYS = [
  'badges',
  'push_notifications',
  'email_notifications',
  'sms_notifications',
  'guest_access',
  'kid_proposals',
  'attachments',
  'reports',
  'motd',
  'ics_feed',
  'weekly_digest',
  'birthdays_layer',
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export const DEFAULT_FLAGS: FeatureFlagsMap = {
  badges: true,
  push_notifications: true,
  email_notifications: true,
  sms_notifications: false,
  guest_access: true,
  kid_proposals: true,
  attachments: true,
  reports: true,
  motd: true,
  ics_feed: true,
  weekly_digest: true,
  birthdays_layer: true,
};

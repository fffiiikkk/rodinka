export type Role = 'PARENT' | 'GRANDPARENT' | 'RELATIVE' | 'KID' | 'GUEST';
export type Language = 'CS' | 'EN';
export type ColorMode = 'LIGHT' | 'DARK' | 'SYSTEM';
export type EventStatus = 'PROPOSED' | 'APPROVED' | 'CANCELLED';
export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'ON_CALL';
export type MotdAudience = 'ALL' | 'KIDS' | 'ADULTS';
export type BadgeRuleType = 'COUNT' | 'STREAK' | 'FIRST' | 'SPECIAL';
export type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD';
export type NotificationChannel = 'EMAIL' | 'PUSH' | 'SMS';
export type NotificationStatus = 'SENT' | 'FAILED';

export type ActivityEventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'EVENT_CREATED'
  | 'EVENT_EDITED'
  | 'EVENT_DELETED'
  | 'PROPOSAL_SUBMITTED'
  | 'PROPOSAL_APPROVED'
  | 'PROPOSAL_REJECTED'
  | 'AVAILABILITY_SET'
  | 'ATTACHMENT_UPLOADED'
  | 'PROFILE_UPDATED'
  | 'PASSWORD_RESET'
  | 'BADGE_EARNED'
  | 'THEME_CHANGED'
  | 'APP_INSTALLED';

export type ThemeKey = 'klasika' | 'ocean' | 'led' | 'leto' | 'les';

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FeatureFlagsMap {
  badges: boolean;
  push_notifications: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  guest_access: boolean;
  kid_proposals: boolean;
  attachments: boolean;
  reports: boolean;
  motd: boolean;
  ics_feed: boolean;
  weekly_digest: boolean;
  birthdays_layer: boolean;
}

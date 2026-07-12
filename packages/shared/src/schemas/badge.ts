import { z } from 'zod';

export const BadgeTierSchema = z.enum(['BRONZE', 'SILVER', 'GOLD']);
export const BadgeRuleTypeSchema = z.enum(['COUNT', 'STREAK', 'FIRST', 'SPECIAL']);

export const BadgeDefinitionSchema = z.object({
  id: z.string(),
  key: z.string(),
  nameCs: z.string(),
  nameEn: z.string(),
  descriptionCs: z.string(),
  descriptionEn: z.string(),
  icon: z.string(),
  category: z.string(),
  ruleType: BadgeRuleTypeSchema,
  metric: z.string(),
  threshold: z.number(),
  tier: BadgeTierSchema,
  isActive: z.boolean(),
});

export const UserBadgeSchema = z.object({
  id: z.string(),
  badgeDefinitionId: z.string(),
  badge: BadgeDefinitionSchema,
  awardedAt: z.string(),
  seenAt: z.string().nullable(),
});

export const BadgeProgressSchema = z.object({
  badge: BadgeDefinitionSchema,
  current: z.number(),
  threshold: z.number(),
  percentComplete: z.number(),
});

export type BadgeDefinition = z.infer<typeof BadgeDefinitionSchema>;
export type UserBadge = z.infer<typeof UserBadgeSchema>;
export type BadgeProgress = z.infer<typeof BadgeProgressSchema>;

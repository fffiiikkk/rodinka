import { describe, it, expect } from 'vitest';
import { BADGES_SEED } from '../../../prisma/seed/badges.js';

describe('Badge catalog integrity', () => {
  it('has at least 100 active badge definitions', () => {
    expect(BADGES_SEED.length).toBeGreaterThanOrEqual(100);
  });

  it('all badges have unique keys', () => {
    const keys = BADGES_SEED.map((b) => b.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('all badges have required fields', () => {
    for (const badge of BADGES_SEED) {
      expect(badge.key, `${badge.key} missing key`).toBeTruthy();
      expect(badge.nameCs, `${badge.key} missing nameCs`).toBeTruthy();
      expect(badge.nameEn, `${badge.key} missing nameEn`).toBeTruthy();
      expect(badge.descriptionCs, `${badge.key} missing descriptionCs`).toBeTruthy();
      expect(badge.descriptionEn, `${badge.key} missing descriptionEn`).toBeTruthy();
      expect(badge.icon, `${badge.key} missing icon`).toBeTruthy();
      expect(badge.category, `${badge.key} missing category`).toBeTruthy();
      expect(badge.metric, `${badge.key} missing metric`).toBeTruthy();
      expect(badge.threshold, `${badge.key} missing threshold`).toBeGreaterThan(0);
      expect(['COUNT', 'STREAK', 'FIRST', 'SPECIAL']).toContain(badge.ruleType);
      expect(['BRONZE', 'SILVER', 'GOLD']).toContain(badge.tier);
    }
  });

  it('all categories are non-empty strings', () => {
    for (const badge of BADGES_SEED) {
      expect(badge.category.length).toBeGreaterThan(0);
    }
  });

  it('has badges across multiple categories', () => {
    const categories = new Set(BADGES_SEED.map((b) => b.category));
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });

  it('has badges for each tier', () => {
    const tiers = new Set(BADGES_SEED.map((b) => b.tier));
    expect(tiers.has('BRONZE')).toBe(true);
    expect(tiers.has('SILVER')).toBe(true);
    expect(tiers.has('GOLD')).toBe(true);
  });
});

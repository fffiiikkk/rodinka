import { describe, it, expect } from 'vitest';
import cs from '../../../../frontend/src/i18n/locales/cs.json';
import en from '../../../../frontend/src/i18n/locales/en.json';

function flattenKeys(obj: Record<string, any>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

describe('i18n key completeness', () => {
  const csKeys = new Set(flattenKeys(cs));
  const enKeys = new Set(flattenKeys(en));

  it('every CS key exists in EN', () => {
    const missing: string[] = [];
    for (const key of csKeys) {
      if (!enKeys.has(key)) missing.push(key);
    }
    if (missing.length) {
      console.error('Keys in CS but not EN:', missing);
    }
    expect(missing).toEqual([]);
  });

  it('every EN key exists in CS', () => {
    const missing: string[] = [];
    for (const key of enKeys) {
      if (!csKeys.has(key)) missing.push(key);
    }
    if (missing.length) {
      console.error('Keys in EN but not CS:', missing);
    }
    expect(missing).toEqual([]);
  });

  it('has reasonable number of translation keys', () => {
    expect(csKeys.size).toBeGreaterThan(50);
  });
});

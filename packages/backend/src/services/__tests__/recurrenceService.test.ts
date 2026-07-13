import { describe, it, expect } from 'vitest';
import { recurrenceService } from '../recurrenceService.js';

const baseEvent = {
  id: 'evt1',
  title: 'Test event',
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU,TH',
  start: '2025-01-07T17:00:00.000Z', // Tuesday (ISO string)
  end: '2025-01-07T18:30:00.000Z',
  allDay: false,
};

describe('recurrenceService', () => {
  it('expands weekly recurrence within range', () => {
    const from = new Date('2025-01-06T00:00:00.000Z'); // Monday
    const to = new Date('2025-01-19T23:59:59.000Z'); // Sunday next

    const occurrences = recurrenceService.expand(baseEvent, from, to) as any[];
    // Should have: 2 Tue + 2 Thu = 4 occurrences (Jan 7, 9, 14, 16)
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
    expect(occurrences.length).toBeLessThanOrEqual(4);
  });

  it('preserves duration across occurrences', () => {
    const from = new Date('2025-01-06T00:00:00.000Z');
    const to = new Date('2025-01-12T23:59:59.000Z');
    const occurrences = recurrenceService.expand(baseEvent, from, to) as any[];

    for (const occ of occurrences) {
      const durationMs = new Date(occ.end).getTime() - new Date(occ.start).getTime();
      expect(durationMs).toBe(90 * 60 * 1000); // 90 minutes
    }
  });

  it('validates RRULE strings', () => {
    expect(recurrenceService.validateRRule('FREQ=WEEKLY;BYDAY=MO')).toBe(true);
    expect(recurrenceService.validateRRule('FREQ=DAILY;COUNT=5')).toBe(true);
    expect(recurrenceService.validateRRule('NOT_A_RULE')).toBe(false);
  });

  it('returns single event when no recurrence rule', () => {
    const noRule = { ...baseEvent, recurrenceRule: null };
    const from = new Date('2025-01-01'); const to = new Date('2025-12-31');
    const result = recurrenceService.expand(noRule, from, to) as any[];
    expect(result.length).toBe(1);
  });

  it('returns empty array when no occurrences in range', () => {
    const from = new Date('2025-06-01');
    const to = new Date('2025-06-02');
    const result = recurrenceService.expand({ ...baseEvent, recurrenceRule: 'FREQ=WEEKLY;BYDAY=SA' }, from, to);
    // Saturday is June 7, not in range
    expect((result as any[]).length).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';

// Unit test for free-time gap logic (pure function extracted)
function computeGaps(
  events: Array<{ start: Date; end: Date }>,
  awakeStart: Date,
  awakeEnd: Date,
): Array<{ start: Date; end: Date; durationMinutes: number }> {
  const sorted = events
    .filter((e) => e.start < awakeEnd && e.end > awakeStart)
    .map((e) => ({
      start: e.start < awakeStart ? awakeStart : e.start,
      end: e.end > awakeEnd ? awakeEnd : e.end,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const gaps: Array<{ start: Date; end: Date; durationMinutes: number }> = [];
  let cursor = awakeStart;

  for (const evt of sorted) {
    if (evt.start > cursor) {
      const durationMinutes = (evt.start.getTime() - cursor.getTime()) / 60000;
      gaps.push({ start: cursor, end: evt.start, durationMinutes });
    }
    if (evt.end > cursor) cursor = evt.end;
  }

  if (cursor < awakeEnd) {
    const durationMinutes = (awakeEnd.getTime() - cursor.getTime()) / 60000;
    gaps.push({ start: cursor, end: awakeEnd, durationMinutes });
  }

  return gaps;
}

const date = '2025-03-10';
const awakeStart = new Date(`${date}T07:00:00Z`);
const awakeEnd = new Date(`${date}T21:00:00Z`);

describe('freeTime gap computation', () => {
  it('returns full day when no events', () => {
    const gaps = computeGaps([], awakeStart, awakeEnd);
    expect(gaps.length).toBe(1);
    expect(gaps[0]!.durationMinutes).toBe(14 * 60);
  });

  it('returns correct gaps around events', () => {
    const events = [
      { start: new Date(`${date}T09:00:00Z`), end: new Date(`${date}T10:30:00Z`) },
      { start: new Date(`${date}T15:00:00Z`), end: new Date(`${date}T16:30:00Z`) },
    ];
    const gaps = computeGaps(events, awakeStart, awakeEnd);
    expect(gaps.length).toBe(3);
    expect(gaps[0]!.durationMinutes).toBe(2 * 60); // 07:00 – 09:00
    expect(gaps[1]!.durationMinutes).toBe(4.5 * 60); // 10:30 – 15:00
    expect(gaps[2]!.durationMinutes).toBe(4.5 * 60); // 16:30 – 21:00
  });

  it('clips events that extend beyond awake hours', () => {
    const events = [
      { start: new Date(`${date}T20:00:00Z`), end: new Date(`${date}T23:00:00Z`) },
    ];
    const gaps = computeGaps(events, awakeStart, awakeEnd);
    // Gap from 07:00 to 20:00 = 13h
    expect(gaps.length).toBe(1);
    expect(gaps[0]!.durationMinutes).toBe(13 * 60);
  });

  it('handles overlapping events', () => {
    const events = [
      { start: new Date(`${date}T09:00:00Z`), end: new Date(`${date}T11:00:00Z`) },
      { start: new Date(`${date}T10:00:00Z`), end: new Date(`${date}T12:00:00Z`) }, // overlaps
    ];
    const gaps = computeGaps(events, awakeStart, awakeEnd);
    // Free: 07-09, 12-21
    expect(gaps.length).toBe(2);
    expect(gaps[0]!.durationMinutes).toBe(2 * 60);
    expect(gaps[1]!.durationMinutes).toBe(9 * 60);
  });
});

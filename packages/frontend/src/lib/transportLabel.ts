import type { Event } from '@rodinkal/shared';

/** Unified transport label for agenda chips, detail page, etc. */
export function formatTransportLabel(t: Event['transport']): string | null {
  if (!t) return null;
  if (t.externalName) return `🤝 ${t.externalName}`;
  if (t.userName) {
    if (t.userRole === 'KID') {
      return t.note ? `🚶 ${t.note}` : `🚶 ${t.userName} samo`;
    }
    const dir =
      t.direction && t.direction !== 'BOTH'
        ? t.direction === 'THERE'
          ? ' →'
          : ' ←'
        : '';
    return `🚗 ${t.userName}${dir}`;
  }
  if (t.note) return `🚶 ${t.note}`;
  return null;
}

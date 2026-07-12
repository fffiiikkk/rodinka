/**
 * AvailabilityStrip
 *
 * Compact row displayed above a day's events in the agenda view.
 * Shows avatar pills for:
 *  - Unavailable guardians (red / striped)
 *  - External helpers (green)
 */
import React from 'react';
import type { Availability } from '@rodinkal/shared';

interface Props {
  items: Availability[];  // pre-filtered to this day
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

export function AvailabilityStrip({ items }: Props) {
  if (items.length === 0) return null;

  const unavailable = items.filter((a) => a.status === 'UNAVAILABLE' && !a.isExternal);
  const available   = items.filter((a) => a.status === 'AVAILABLE'   && !a.isExternal);
  const external    = items.filter((a) => a.isExternal);

  return (
    <div className="flex flex-wrap gap-1.5 ml-9 mb-1.5">
      {unavailable.map((a) => (
        <span key={a.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
          style={{ background: a.userColor ?? '#ef4444' }}
          title={`${a.userName} — nedostupný/á${a.note ? `: ${a.note}` : ''}`}
        >
          <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-[9px] font-bold shrink-0">
            {initials(a.userName)}
          </span>
          ✗ {a.userName}
          {a.note && <span className="opacity-75">· {a.note}</span>}
        </span>
      ))}
      {available.map((a) => (
        <span key={a.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border-2"
          style={{ color: a.userColor ?? '#22c55e', borderColor: (a.userColor ?? '#22c55e') + '80', background: (a.userColor ?? '#22c55e') + '15' }}
          title={`${a.userName} — dostupný/á${a.note ? `: ${a.note}` : ''}`}
        >
          <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            style={{ background: a.userColor ?? '#22c55e' }}>
            {initials(a.userName)}
          </span>
          ✓ {a.userName}
          {a.note && <span className="opacity-60">· {a.note}</span>}
        </span>
      ))}
      {external.map((a) => (
        <span key={a.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
          title={`${a.externalName} (${a.externalRole ?? 'výpomoc'})${a.note ? ` — ${a.note}` : ''}`}
        >
          <span className="text-[11px]">🤝</span>
          {a.externalName}
          {a.externalRole && <span className="opacity-75">· {a.externalRole}</span>}
        </span>
      ))}
    </div>
  );
}

/** Small dots for month-grid cells */
export function AvailabilityDots({ items }: Props) {
  if (items.length === 0) return null;

  const unavailable = items.filter((a) => a.status === 'UNAVAILABLE' && !a.isExternal);
  const available   = items.filter((a) => a.status === 'AVAILABLE'   && !a.isExternal);
  const external    = items.filter((a) => a.isExternal);

  return (
    <div className="flex flex-wrap gap-0.5 mt-0.5">
      {unavailable.slice(0, 4).map((a) => (
        <span key={a.id}
          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
          style={{ background: a.userColor ?? '#ef4444' }}
          title={`${a.userName} nedostupný/á`}
        >
          {initials(a.userName)}
        </span>
      ))}
      {available.slice(0, 4).map((a) => (
        <span key={a.id}
          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0 ring-1 ring-white"
          style={{ background: a.userColor ?? '#22c55e' }}
          title={`${a.userName} dostupný/á`}
        >
          {initials(a.userName)}
        </span>
      ))}
      {external.map((a) => (
        <span key={a.id}
          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] bg-blue-500 text-white shrink-0"
          title={`${a.externalName} — výpomoc`}
        >
          +
        </span>
      ))}
    </div>
  );
}

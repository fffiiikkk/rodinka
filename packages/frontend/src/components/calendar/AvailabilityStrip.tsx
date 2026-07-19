/**
 * AvailabilityStrip — availability display components
 *
 * AvailabilityBars  – spanning coloured bars for week/month grid headers
 * AvailabilityStrip – compact pills for agenda view (start-day only)
 * AvailabilityDots  – tiny dots for month day cells (fallback)
 */
import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import type { Availability } from '@rodinkal/shared';

interface Props {
  items: Availability[];
  currentUserId?: string;
  isAdmin?: boolean;
  onEdit?: (item: Availability) => void;
  onDelete?: (item: Availability) => void;
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

function formatShort(isoDate: string) {
  return format(new Date(isoDate + 'T00:00:00'), 'd. MMM', { locale: cs });
}

// ─── Spanning bar layout (week/month) ──────────────────────────────────────────

export interface AvailBarLayout {
  item: Availability;
  colStart: number; // 0–6 within the 7-day week
  colEnd: number;
  startsHere: boolean;
  endsHere: boolean;
  lane: number;
}

/** Build per-week spanning layouts for availability items — mirrors layoutSpanningForWeek for events. */
export function layoutAvailForWeek(items: Availability[], weekDays: string[]): AvailBarLayout[] {
  const weekStart = weekDays[0]!;
  const weekEnd   = weekDays[6]!;

  const active = items.filter((a) => {
    const af = a.dateFrom.slice(0, 10);
    const at = a.dateTo.slice(0, 10);
    return af <= weekEnd && at >= weekStart;
  });

  // Sort: unavailable first, then available, then external
  const sorted = [...active].sort((a, b) => {
    const order = (x: Availability) =>
      x.isExternal ? 2 : x.status === 'UNAVAILABLE' ? 0 : 1;
    return order(a) - order(b);
  });

  const layouts: AvailBarLayout[] = [];
  // Each lane tracks its rightmost used column so far
  const laneEnd: number[] = [];

  for (const item of sorted) {
    const af = item.dateFrom.slice(0, 10);
    const at = item.dateTo.slice(0, 10);

    const rawColStart = weekDays.indexOf(af);
    const rawColEnd   = weekDays.indexOf(at);
    const colStart = rawColStart < 0 ? 0 : rawColStart;
    const colEnd   = rawColEnd   < 0 ? 6 : rawColEnd;
    const startsHere = af >= weekStart;
    const endsHere   = at <= weekEnd;

    // Find first lane where this item fits
    let lane = laneEnd.findIndex((end) => end < colStart);
    if (lane === -1) { lane = laneEnd.length; laneEnd.push(colEnd); }
    else laneEnd[lane] = colEnd;

    layouts.push({ item, colStart, colEnd, startsHere, endsHere, lane });
  }

  return layouts;
}

// ─── AvailabilityBars (week & month spanning bars) ─────────────────────────────

const BAR_H = 22; // px per lane

interface BarsProps extends Props {
  weekDays: string[];        // 7 "yyyy-MM-dd" strings
  /** px width of the left gutter (time gutter in week, date col in month) */
  gutterPx?: number;
}

export function AvailabilityBars({
  items, weekDays, gutterPx = 0,
  currentUserId, isAdmin, onEdit, onDelete,
}: BarsProps) {
  const layouts = layoutAvailForWeek(items, weekDays);
  if (layouts.length === 0) return null;

  const maxLane = Math.max(...layouts.map((l) => l.lane));
  const totalH  = (maxLane + 1) * BAR_H + 4;

  return (
    <div className="relative" style={{ height: totalH }}>
      {layouts.map(({ item, colStart, colEnd, startsHere, endsHere, lane }, i) => {
        const isUnavail  = item.status === 'UNAVAILABLE' && !item.isExternal;
        const isAvail    = item.status === 'AVAILABLE'   && !item.isExternal;
        const isExternal = item.isExternal;

        const baseColor = isUnavail
          ? (item.userColor ?? '#ef4444')
          : isAvail
            ? (item.userColor ?? '#22c55e')
            : '#3b82f6';

        const bg = isUnavail
          ? baseColor + '30'
          : isAvail
            ? baseColor + '20'
            : '#3b82f680';

        const border = startsHere ? `2px solid ${baseColor}` : `1px dashed ${baseColor}80`;

        const rTL = startsHere ? 6 : 0;
        const rTR = endsHere   ? 6 : 0;

        const leftPct  = gutterPx > 0
          ? `calc(${gutterPx}px + ${(colStart / 7) * 100}%)`
          : `${(colStart / 7) * 100}%`;
        const rightPct = `${((6 - colEnd) / 7) * 100}%`;

        const displayName = item.isExternal
          ? (item.externalName ?? '?')
          : item.userName;

        const canManage = !!(isAdmin || (currentUserId && item.userId === currentUserId));

        const label = isUnavail ? '✗' : isAvail ? '✓' : '🤝';

        return (
          <div
            key={`${item.id}-${i}`}
            className="absolute flex items-center overflow-hidden text-[11px] font-semibold select-none group"
            style={{
              left: leftPct,
              right: rightPct,
              top: `${lane * BAR_H + 2}px`,
              height: `${BAR_H - 3}px`,
              background: bg,
              border,
              borderLeft: startsHere ? `3px solid ${baseColor}` : `1px dashed ${baseColor}80`,
              borderRadius: `${rTL}px ${rTR}px ${rTR}px ${rTL}px`,
              paddingLeft: '5px',
              paddingRight: '4px',
              color: baseColor,
            }}
            title={`${displayName}${item.note ? ` — ${item.note}` : ''}${item.externalRole ? ` (${item.externalRole})` : ''}`}
          >
            {/* Avatar */}
            {startsHere && (
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 mr-1"
                style={{ background: baseColor }}
              >
                {isExternal ? '🤝' : initials(item.userName)}
              </span>
            )}

            {/* Name (only on start, with truncation) */}
            {startsHere && (
              <span className="truncate flex-1 leading-tight">
                {label} {displayName}
                {item.note && <span className="ml-1 opacity-60 font-normal">· {item.note}</span>}
              </span>
            )}
            {!startsHere && (
              <span className="opacity-50">↳</span>
            )}

            {/* End arrow indicator */}
            {!endsHere && (
              <span className="ml-auto shrink-0 opacity-60 pr-0.5">›</span>
            )}

            {/* Edit / delete — visible on hover for own records */}
            {canManage && startsHere && (
              <span className="flex items-center gap-0.5 ml-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit?.(item); }}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                  title="Upravit"
                >
                  <Pencil size={10} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(item); }}
                  className="opacity-70 hover:opacity-100 text-red-500 transition-opacity"
                  title="Smazat"
                >
                  <Trash2 size={10} />
                </button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── AvailabilityStrip (agenda view — start-day pills) ─────────────────────────

function AvailPill({
  item, baseColor, label, canManage, onEdit, onDelete, showUntil,
}: {
  item: Availability;
  baseColor: string;
  label: string;
  canManage: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  showUntil?: boolean;
}) {
  const isUnavail  = item.status === 'UNAVAILABLE' && !item.isExternal;
  const displayName = item.isExternal ? (item.externalName ?? '?') : item.userName;
  const untilStr    = formatShort(item.dateTo.slice(0, 10));

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={
        isUnavail
          ? { background: baseColor + '25', color: baseColor, border: `1.5px solid ${baseColor}60` }
          : { background: baseColor + '15', color: baseColor, border: `1.5px solid ${baseColor}50` }
      }
      title={`${displayName}${item.note ? ` — ${item.note}` : ''}`}
    >
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
        style={{ background: baseColor }}
      >
        {item.isExternal ? '🤝' : initials(item.userName)}
      </span>
      <span>{label} {displayName}</span>
      {item.note && <span className="opacity-60">· {item.note}</span>}
      {item.externalRole && <span className="opacity-75">· {item.externalRole}</span>}
      {showUntil && (
        <span className="opacity-60 font-normal ml-0.5">do {untilStr}</span>
      )}
      {canManage && (
        <>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit?.(); }}
            className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
            title="Upravit"
          >
            <Pencil size={10} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(); }}
            className="opacity-60 hover:opacity-100 transition-opacity text-red-500"
            title="Smazat"
          >
            <Trash2 size={10} />
          </button>
        </>
      )}
    </span>
  );
}

export function AvailabilityStrip({ items, currentUserId, isAdmin, onEdit, onDelete }: Props) {
  if (items.length === 0) return null;

  const unavailable = items.filter((a) => a.status === 'UNAVAILABLE' && !a.isExternal);
  const available   = items.filter((a) => a.status === 'AVAILABLE'   && !a.isExternal);
  const external    = items.filter((a) => a.isExternal);

  const canManage = (a: Availability) =>
    !!(isAdmin || (currentUserId && a.userId === currentUserId));

  return (
    <div className="flex flex-wrap gap-1.5 ml-9 mb-1.5">
      {unavailable.map((a) => (
        <AvailPill
          key={a.id} item={a}
          baseColor={a.userColor ?? '#ef4444'}
          label="✗"
          showUntil
          canManage={canManage(a)}
          onEdit={() => onEdit?.(a)}
          onDelete={() => onDelete?.(a)}
        />
      ))}
      {available.map((a) => (
        <AvailPill
          key={a.id} item={a}
          baseColor={a.userColor ?? '#22c55e'}
          label="✓"
          showUntil
          canManage={canManage(a)}
          onEdit={() => onEdit?.(a)}
          onDelete={() => onDelete?.(a)}
        />
      ))}
      {external.map((a) => (
        <AvailPill
          key={a.id} item={a}
          baseColor="#3b82f6"
          label="🤝"
          showUntil
          canManage={canManage(a)}
          onEdit={() => onEdit?.(a)}
          onDelete={() => onDelete?.(a)}
        />
      ))}
    </div>
  );
}

// ─── AvailabilityDots (month day-cell fallback) ────────────────────────────────

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

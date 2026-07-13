/**
 * AvailabilityStrip
 *
 * Compact row displayed above a day's events in the agenda view.
 * Shows avatar pills for:
 *  - Unavailable guardians (red)
 *  - Available guardians (green)
 *  - External helpers (blue)
 *
 * If currentUserId / isAdmin is provided, shows edit + delete icons on own records.
 */
import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
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

function AvailPill({
  item,
  color,
  labelPrefix,
  bgClass,
  borderStyle,
  textStyle,
  canManage,
  onEdit,
  onDelete,
}: {
  item: Availability;
  color: string;
  labelPrefix: string;
  bgClass?: string;
  borderStyle?: React.CSSProperties;
  textStyle?: React.CSSProperties;
  canManage: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${bgClass ?? ''}`}
      style={{ ...borderStyle, ...textStyle }}
      title={`${item.isExternal ? item.externalName : item.userName}${item.note ? ` — ${item.note}` : ''}`}
    >
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
        style={{ background: color }}
      >
        {item.isExternal ? '🤝' : initials(item.userName)}
      </span>
      {labelPrefix}{item.isExternal ? (item.externalName ?? '') : item.userName}
      {item.note && <span className="opacity-60">· {item.note}</span>}
      {item.externalRole && <span className="opacity-75">· {item.externalRole}</span>}
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
          color={a.userColor ?? '#ef4444'}
          labelPrefix="✗ "
          bgClass="text-white"
          borderStyle={{ background: a.userColor ?? '#ef4444' }}
          canManage={canManage(a)}
          onEdit={() => onEdit?.(a)}
          onDelete={() => onDelete?.(a)}
        />
      ))}
      {available.map((a) => (
        <AvailPill
          key={a.id} item={a}
          color={a.userColor ?? '#22c55e'}
          labelPrefix="✓ "
          borderStyle={{ borderColor: (a.userColor ?? '#22c55e') + '80', border: '2px solid' }}
          textStyle={{ color: a.userColor ?? '#22c55e', background: (a.userColor ?? '#22c55e') + '15' }}
          canManage={canManage(a)}
          onEdit={() => onEdit?.(a)}
          onDelete={() => onDelete?.(a)}
        />
      ))}
      {external.map((a) => (
        <AvailPill
          key={a.id} item={a}
          color="#3b82f6"
          labelPrefix=""
          bgClass="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
          canManage={canManage(a)}
          onEdit={() => onEdit?.(a)}
          onDelete={() => onDelete?.(a)}
        />
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

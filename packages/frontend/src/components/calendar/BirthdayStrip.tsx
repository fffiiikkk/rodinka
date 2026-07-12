/**
 * BirthdayStrip / BirthdayDots
 *
 * Shows birthday (🎂) and nameday (🌸) indicators in the calendar.
 * Used in both agenda (strip) and month grid (dots) views.
 */
import React from 'react';
import type { CalendarLayerEvent } from '../../hooks/useCalendarLayer.js';

interface Props {
  items: CalendarLayerEvent[];
}

function Avatar({ item }: { item: CalendarLayerEvent }) {
  const initials = item.userName.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
  return item.userPhotoUrl ? (
    <img
      src={item.userPhotoUrl}
      alt={item.userName}
      className="w-5 h-5 rounded-full object-cover border border-white/40 shrink-0"
    />
  ) : (
    <span
      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
      style={{ background: item.userColor }}
    >
      {initials}
    </span>
  );
}

export function BirthdayStrip({ items }: Props) {
  if (items.length === 0) return null;

  const birthdays = items.filter((i) => i.type === 'birthday');
  const namedays  = items.filter((i) => i.type === 'nameday');

  return (
    <div className="flex flex-wrap gap-1.5 ml-9 mb-1.5">
      {birthdays.map((item) => (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white shadow-sm"
          style={{ background: item.userColor }}
          title={item.label}
        >
          <Avatar item={item} />
          🎂 {item.userName}
          {item.age !== undefined && (
            <span className="bg-white/20 rounded-full px-1.5 py-px text-[10px] font-bold">
              {item.age}
            </span>
          )}
        </span>
      ))}
      {namedays.map((item) => (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
          style={{
            color: item.userColor,
            borderColor: item.userColor + '50',
            background: item.userColor + '15',
          }}
          title={item.label}
        >
          <Avatar item={item} />
          🌸 {item.userName}
        </span>
      ))}
    </div>
  );
}

/** Compact dots for month grid */
export function BirthdayDots({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-0.5 mt-0.5">
      {items.map((item) => (
        <span
          key={item.id}
          className="text-[11px] leading-none"
          title={item.label}
        >
          {item.type === 'birthday' ? '🎂' : '🌸'}
        </span>
      ))}
    </div>
  );
}

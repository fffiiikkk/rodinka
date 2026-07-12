/**
 * KidsTimelinePage — shows all children's schedules side-by-side for a week
 * with conflict detection (overlapping timed events across kids).
 */
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, startOfDay, addWeeks, subWeeks, isToday } from 'date-fns';
import { cs } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api.js';
import { useEvents } from '../hooks/useEvents.js';
import type { Event, UserPublic } from '@rodinkal/shared';

// ─── Data fetching ─────────────────────────────────────────────────────────────

function useFamilyKids() {
  return useQuery<UserPublic[]>({
    queryKey: ['family-kids'],
    queryFn: () => api.get<{ members: UserPublic[] }>('/users/family').then((r) => r.members),
    staleTime: 5 * 60_000,
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function eventsForKidOnDay(events: Event[], kidId: string, dayStr: string): Event[] {
  return events.filter((e) => {
    if (e.status === 'CANCELLED') return false;
    const startDay = e.start.slice(0, 10);
    const endDay = e.end.slice(0, 10);
    // Event belongs to kid if kid is creator or participant
    const isKid =
      e.createdById === kidId ||
      e.participants.some((p) => p.userId === kidId);
    if (!isKid) return false;
    // Appears on this day if starts here or is multi-day spanning here
    if (startDay === dayStr) return true;
    if (e.allDay && startDay < dayStr && endDay >= dayStr) return true;
    return false;
  });
}

function overlaps(a: Event, b: Event): boolean {
  const aStart = new Date(a.start).getTime();
  const aEnd = new Date(a.end).getTime();
  const bStart = new Date(b.start).getTime();
  const bEnd = new Date(b.end).getTime();
  // Both must be timed (non-allDay) to count as a conflict
  if (a.allDay || b.allDay) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** Returns pairs of kid indices whose events conflict on a given day */
function findConflicts(kidEvents: Event[][]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < kidEvents.length; i++) {
    for (let j = i + 1; j < kidEvents.length; j++) {
      const conflict = kidEvents[i]!.some((ea) =>
        kidEvents[j]!.some((eb) => overlaps(ea, eb)),
      );
      if (conflict) pairs.push([i, j]);
    }
  }
  return pairs;
}

function timeLabel(e: Event): string {
  if (e.allDay) return 'Celý den';
  const s = format(new Date(e.start), 'HH:mm');
  const en = format(new Date(e.end), 'HH:mm');
  return `${s}–${en}`;
}

// ─── Kid column cell ────────────────────────────────────────────────────────────

function KidDayCell({ events, hasConflict }: { events: Event[]; hasConflict: boolean }) {
  if (events.length === 0) {
    return (
      <div className="min-h-[72px] flex items-center justify-center text-ink-faint text-xs">
        —
      </div>
    );
  }
  return (
    <div className={`min-h-[72px] p-1.5 space-y-1 ${hasConflict ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
      {events.map((e) => {
        const color = e.eventType?.color ?? '#a3a3a3';
        return (
          <Link
            key={e.id}
            to={`/event/${(e as any).originalId ?? e.id}`}
            className="block rounded-lg px-2 py-1.5 hover:brightness-95 transition-all"
            style={{ background: color + '22', borderLeft: `3px solid ${color}` }}
          >
            <p className="text-xs font-semibold text-ink leading-tight truncate">
              {e.eventType?.icon ?? '📌'} {e.title}
            </p>
            <p className="text-[10px] text-ink-muted leading-tight mt-0.5">{timeLabel(e)}</p>
            {e.location && (
              <p className="text-[10px] text-ink-faint truncate">📍 {e.location}</p>
            )}
          </Link>
        );
      })}
      {hasConflict && (
        <div className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-bold px-1">
          <AlertTriangle size={10} /> Kolize!
        </div>
      )}
    </div>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────────

function KidAvatar({ kid }: { kid: UserPublic }) {
  const initials = kid.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      {kid.photoUrl ? (
        <img src={kid.photoUrl} alt={kid.name} className="w-9 h-9 rounded-full object-cover border-2 border-primary/30" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
          {initials}
        </div>
      )}
      <span className="text-[11px] font-bold text-ink leading-tight text-center max-w-[56px] truncate">
        {kid.nickname ?? kid.name.split(' ')[0]}
      </span>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function KidsTimelinePage() {
  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const { data: kids = [], isLoading: kidsLoading } = useFamilyKids();
  const { data: events = [], isLoading: eventsLoading } = useEvents(weekStart, weekEnd);

  const isLoading = kidsLoading || eventsLoading;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="sticky top-14 z-20 bg-surface/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setWeekStart((d) => subWeeks(d, 1))}
            className="p-2 text-ink-muted hover:text-ink transition-colors"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => setWeekStart(startOfDay(new Date()))}
            className="font-bold text-ink hover:text-primary transition-colors text-sm"
          >
            {format(weekStart, 'd. MMM', { locale: cs })} – {format(weekEnd, 'd. MMM yyyy', { locale: cs })}
          </button>
          <button
            onClick={() => setWeekStart((d) => addWeeks(d, 1))}
            className="p-2 text-ink-muted hover:text-ink transition-colors"
          >
            <ChevronRight size={22} />
          </button>
        </div>
        <p className="text-center text-xs text-ink-muted mt-0.5">Přehled dětí — kolize v červené</p>
      </div>

      {isLoading ? (
        <div className="px-4 pt-6 space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : kids.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-ink-muted gap-2">
          <span className="text-4xl">👶</span>
          <p className="text-sm font-semibold">Žádné děti nejsou v systému</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Table — sticky first column (day), kids as columns */}
          <table className="w-full border-collapse" style={{ minWidth: `${kids.length * 80 + 72}px` }}>
            <thead>
              <tr className="bg-surface-raised border-b border-border">
                {/* Day column header */}
                <th className="w-16 text-left px-2 py-1 text-xs font-bold text-ink-muted sticky left-0 bg-surface-raised z-10">
                  Den
                </th>
                {kids.map((kid) => (
                  <th key={kid.id} className="text-center border-l border-border">
                    <KidAvatar kid={kid} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const kidEvents = kids.map((kid) => eventsForKidOnDay(events, kid.id, dayStr));
                const conflicts = findConflicts(kidEvents);
                const conflictingKids = new Set(conflicts.flatMap(([a, b]) => [a, b]));

                return (
                  <tr
                    key={dayStr}
                    className={`border-b border-border ${isToday(day) ? 'bg-primary/5' : ''}`}
                  >
                    {/* Day label cell */}
                    <td className="sticky left-0 z-10 bg-surface px-2 py-1 align-top border-r border-border">
                      <div className={`text-xs font-extrabold ${isToday(day) ? 'text-primary' : 'text-ink'}`}>
                        {format(day, 'EEE', { locale: cs }).toUpperCase()}
                      </div>
                      <div className={`text-lg font-black leading-none ${isToday(day) ? 'text-primary' : 'text-ink'}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="text-[10px] text-ink-faint leading-tight">
                        {format(day, 'MMM', { locale: cs })}
                      </div>
                      {conflicts.length > 0 && (
                        <AlertTriangle size={12} className="text-red-500 mt-1" />
                      )}
                    </td>
                    {kids.map((kid, kidIdx) => (
                      <td key={kid.id} className="border-l border-border align-top">
                        <KidDayCell
                          events={kidEvents[kidIdx] ?? []}
                          hasConflict={conflictingKids.has(kidIdx)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {!isLoading && kids.length > 0 && (
        <div className="px-4 pt-4 flex items-center gap-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1">
            <AlertTriangle size={12} className="text-red-500" />
            Kolize = akce ve stejný čas
          </span>
          <span>• Kliknutím na akci zobrazíš detail</span>
        </div>
      )}
    </div>
  );
}

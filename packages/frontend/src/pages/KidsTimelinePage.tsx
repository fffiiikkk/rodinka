/**
 * KidsTimelinePage — all children's schedules side-by-side in a continuous
 * scrollable 12-week table. Today's row is highlighted and auto-scrolled into
 * view on mount. Additional adult columns can be toggled dynamically and the
 * selection is persisted in localStorage.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  format, addDays, subDays, startOfDay, isToday, getDay,
} from 'date-fns';
import { cs } from 'date-fns/locale';
import { AlertTriangle, CalendarDays, Plus, X, Users, Baby, Info } from 'lucide-react';
import { api } from '../lib/api.js';
import { useEvents } from '../hooks/useEvents.js';
import Sheet from '../components/ui/Sheet.js';
import Avatar from '../components/ui/Avatar.js';
import type { Event, UserPublic } from '@rodinkal/shared';

// ─── Data fetching ─────────────────────────────────────────────────────────────

function useFamilyKids() {
  return useQuery<UserPublic[]>({
    queryKey: ['family-kids'],
    queryFn: () => api.get<{ members: UserPublic[] }>('/users/family').then((r) => r.members),
    staleTime: 5 * 60_000,
  });
}

function useAllActiveUsers() {
  return useQuery<UserPublic[]>({
    queryKey: ['users-active'],
    queryFn: () => api.get<{ users: UserPublic[] }>('/users/active').then((r) => r.users),
    staleTime: 5 * 60_000,
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function eventsForUserOnDay(events: Event[], userId: string, dayStr: string): Event[] {
  return events.filter((e) => {
    if (e.status === 'CANCELLED') return false;
    const startDay = e.start.slice(0, 10);
    const endDay = e.end.slice(0, 10);
    const isUser =
      e.createdById === userId ||
      e.participants.some((p) => p.userId === userId) ||
      (e.transport?.userId === userId);
    if (!isUser) return false;
    if (startDay === dayStr) return true;
    if (startDay < dayStr && endDay >= dayStr) return true;
    return false;
  });
}

function overlaps(a: Event, b: Event): boolean {
  if (a.allDay || b.allDay) return false;
  const aS = new Date(a.start).getTime();
  const aE = new Date(a.end).getTime();
  const bS = new Date(b.start).getTime();
  const bE = new Date(b.end).getTime();
  return aS < bE && bS < aE;
}

interface ConflictPair {
  kidIdxA: number;
  kidIdxB: number;
  eventA: Event;
  eventB: Event;
}

function findConflictPairs(kidEvents: Event[][]): ConflictPair[] {
  const pairs: ConflictPair[] = [];
  for (let i = 0; i < kidEvents.length; i++) {
    for (let j = i + 1; j < kidEvents.length; j++) {
      for (const ea of kidEvents[i]!) {
        for (const eb of kidEvents[j]!) {
          if (overlaps(ea, eb)) {
            pairs.push({ kidIdxA: i, kidIdxB: j, eventA: ea, eventB: eb });
          }
        }
      }
    }
  }
  return pairs;
}

function timeLabel(e: Event): string {
  if (e.allDay) return 'Celý den';
  const sd = e.start.slice(0, 10);
  const ed = e.end.slice(0, 10);
  if (ed > sd) return `${format(new Date(e.start), 'd.M.')}–${format(new Date(e.end), 'd.M.')}`;
  return `${format(new Date(e.start), 'HH:mm')}–${format(new Date(e.end), 'HH:mm')}`;
}

// Role-based column accent colour
const ROLE_COLORS: Record<string, string> = {
  PARENT:      '#f59e0b', // amber
  GRANDPARENT: '#8b5cf6', // violet
  RELATIVE:    '#06b6d4', // cyan
  KID:         '#10b981', // emerald (handled separately)
  GUEST:       '#94a3b8', // slate
};

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    PARENT: 'Rodič', GRANDPARENT: 'Prarodič', RELATIVE: 'Příbuzný',
    KID: 'Dítě', GUEST: 'Host',
  };
  return map[role] ?? role;
}

// ─── Collision tooltip ──────────────────────────────────────────────────────────

interface ConflictReason {
  otherKidName: string;
  myEvent: Event;
  otherEvent: Event;
}

function CollisionTooltip({ reasons }: { reasons: ConflictReason[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-1 text-[10px] text-red-600 font-bold px-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
      >
        <AlertTriangle size={10} />
        Kolize!
        <Info size={9} className="opacity-70" />
      </button>

      {open && (
        <div className="mt-1 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/60 p-2 text-[10px] space-y-1.5 shadow-lg z-50">
          {reasons.map((r, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="font-bold text-red-700 dark:text-red-300">
                Kolize s {r.otherKidName}:
              </span>
              <span className="text-red-600 dark:text-red-400">
                {r.myEvent.eventType?.icon ?? '📌'} {r.myEvent.title} ({timeLabel(r.myEvent)})
              </span>
              <span className="text-red-500">
                ↔ {r.otherEvent.eventType?.icon ?? '📌'} {r.otherEvent.title} ({timeLabel(r.otherEvent)})
              </span>
            </div>
          ))}
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="w-full text-center text-red-400 hover:text-red-600 mt-1"
          >
            zavřít ×
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({
  events, conflictReasons, accentColor,
}: { events: Event[]; conflictReasons: ConflictReason[]; accentColor: string }) {
  const hasConflict = conflictReasons.length > 0;

  if (events.length === 0 && !hasConflict) {
    return (
      <div className="min-h-[60px] flex items-center justify-center text-ink-faint text-xs">—</div>
    );
  }
  return (
    <div className={`min-h-[60px] p-1.5 space-y-1 ${hasConflict ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
      {events.map((e) => {
        const color = e.eventType?.color ?? accentColor;
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
      {hasConflict && <CollisionTooltip reasons={conflictReasons} />}
    </div>
  );
}

// ─── Column header cell ────────────────────────────────────────────────────────

function ColHeader({
  user, isKid, onRemove,
}: { user: UserPublic; isKid: boolean; onRemove?: () => void }) {
  const accent = isKid ? ROLE_COLORS['KID']! : (ROLE_COLORS[user.role] ?? '#94a3b8');
  return (
    <div className="flex flex-col items-center gap-1 py-2 relative group">
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-surface-raised border border-border
                     text-ink-faint hover:text-red-500 hover:border-red-300 transition-all
                     opacity-0 group-hover:opacity-100 flex items-center justify-center"
          title="Odebrat sloupec"
        >
          <X size={9} />
        </button>
      )}
      <Avatar name={user.name} photoUrl={user.photoUrl} size="sm" />
      <span className="text-[11px] font-bold text-ink leading-tight text-center max-w-[60px] truncate">
        {user.nickname ?? user.name.split(' ')[0]}
      </span>
      {!isKid && (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: accent + '30', color: accent }}
        >
          {roleLabel(user.role)}
        </span>
      )}
    </div>
  );
}

// ─── Column picker sheet ───────────────────────────────────────────────────────

function ColumnPickerSheet({
  open,
  onClose,
  allUsers,
  kids,
  extraUserIds,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  allUsers: UserPublic[];
  kids: UserPublic[];
  extraUserIds: string[];
  onToggle: (id: string) => void;
}) {
  const kidIds = new Set(kids.map((k) => k.id));
  const adults = allUsers.filter((u) => !kidIds.has(u.id) && u.isActive);

  // Group by role for display
  const groups: Record<string, UserPublic[]> = {};
  for (const u of adults) {
    if (!groups[u.role]) groups[u.role] = [];
    groups[u.role]!.push(u);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Sloupce přehledu">
      <div className="p-4 space-y-5">
        {/* Kids section — informational, always shown */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Baby size={14} className="text-emerald-500" />
            <span className="text-xs font-bold text-ink-muted uppercase tracking-wide">Děti (vždy zobrazeny)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {kids.map((k) => (
              <div
                key={k.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200"
              >
                <Avatar name={k.name} size="xs" photoUrl={k.photoUrl} />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {k.nickname ?? k.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Adults grouped by role */}
        {Object.entries(groups).map(([role, users]) => {
          const accent = ROLE_COLORS[role] ?? '#94a3b8';
          return (
            <div key={role}>
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} style={{ color: accent }} />
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wide">
                  {roleLabel(role)}
                </span>
              </div>
              <div className="space-y-1.5">
                {users.map((u) => {
                  const active = extraUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 cursor-pointer py-1.5 px-2 rounded-xl hover:bg-surface-raised transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => onToggle(u.id)}
                        className="w-4 h-4 rounded shrink-0"
                        style={{ accentColor: accent }}
                      />
                      <Avatar name={u.name} photoUrl={u.photoUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">
                          {u.nickname ? `${u.nickname}` : u.name.split(' ')[0]}
                          {u.nickname && <span className="text-xs text-ink-faint ml-1">({u.name})</span>}
                        </p>
                        {u.relationship && (
                          <p className="text-[11px] text-ink-muted">{u.relationship}</p>
                        )}
                      </div>
                      {active && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: accent + '25', color: accent }}
                        >
                          zobrazeno
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        {adults.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-4">Žádní dospělí uživatelé</p>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm"
        >
          Hotovo
        </button>
      </div>
    </Sheet>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

const LS_KEY = 'kids-timeline-extra-cols';

// Heights: TopBar = 56px (h-14), sub-header ≈ 44px → thead sticks at 100px
const THEAD_TOP = '100px';

export default function KidsTimelinePage() {
  // Fixed 12-week range: 1 week before today → 11 weeks after
  const rangeStart = useMemo(() => startOfDay(subDays(new Date(), 7)), []);
  const rangeEnd   = useMemo(() => addDays(rangeStart, 84), [rangeStart]);
  const days       = useMemo(
    () => Array.from({ length: 85 }, (_, i) => addDays(rangeStart, i)),
    [rangeStart],
  );

  const { data: kids = [], isLoading: kidsLoading } = useFamilyKids();
  const { data: allUsers = [], isLoading: usersLoading } = useAllActiveUsers();
  const { data: events = [], isLoading: eventsLoading } = useEvents(rangeStart, rangeEnd);

  const isLoading = kidsLoading || eventsLoading || usersLoading;

  // Extra adult columns — persisted in localStorage
  const [extraUserIds, setExtraUserIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(extraUserIds));
  }, [extraUserIds]);

  const toggleExtraUser = useCallback((id: string) => {
    setExtraUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  // Resolve extra user objects in stable order
  const kidIds = useMemo(() => new Set(kids.map((k) => k.id)), [kids]);
  const extraUsers = useMemo(
    () => extraUserIds
      .map((id) => allUsers.find((u) => u.id === id))
      .filter((u): u is UserPublic => !!u && !kidIds.has(u.id)),
    [extraUserIds, allUsers, kidIds],
  );

  // Column picker sheet
  const [pickerOpen, setPickerOpen] = useState(false);

  // Auto-scroll to today's row
  const todayRef = useRef<HTMLTableRowElement>(null);
  const scrollOnce = useRef(false);
  useEffect(() => {
    if (!isLoading && todayRef.current && !scrollOnce.current) {
      scrollOnce.current = true;
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isLoading]);

  const scrollToToday = useCallback(() => {
    todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // All columns = kids + extra adults
  const allColumns: Array<{ user: UserPublic; isKid: boolean }> = [
    ...kids.map((u) => ({ user: u, isKid: true })),
    ...extraUsers.map((u) => ({ user: u, isKid: false })),
  ];

  function monthLabel(day: Date, idx: number): string | null {
    return (idx === 0 || day.getDate() === 1) ? format(day, 'LLLL yyyy', { locale: cs }) : null;
  }
  function isWeekStart(day: Date): boolean { return getDay(day) === 1; }

  return (
    <div className="pb-20">
      {/* Sticky sub-header */}
      <div className="sticky top-14 z-30 bg-surface/95 backdrop-blur-sm border-b border-border px-4 py-2 flex items-center gap-2">
        <p className="text-xs text-ink-muted font-medium flex-1">
          Přehled dětí — kolize v červené
        </p>
        {extraUsers.length > 0 && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            +{extraUsers.length}
          </span>
        )}
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 text-xs font-bold text-ink-muted hover:text-ink border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface-raised transition-all"
          title="Přidat / odebrat sloupce"
        >
          <Plus size={13} />
          Sloupce
        </button>
        <button
          onClick={scrollToToday}
          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
        >
          <CalendarDays size={14} />
          Dnes
        </button>
      </div>

      {isLoading ? (
        <div className="px-4 pt-6 space-y-2">
          {[...Array(7)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : allColumns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-ink-muted gap-2">
          <span className="text-4xl">👶</span>
          <p className="text-sm font-semibold">Žádné děti nejsou v systému</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse"
            style={{ minWidth: `${allColumns.length * 90 + 72}px` }}
          >
            {/* Sticky kid/adult header — sits below both TopBar and sub-header */}
            <thead className="sticky z-20" style={{ top: THEAD_TOP }}>
              <tr className="bg-surface-raised border-b-2 border-border shadow-sm">
                <th className="w-16 text-left px-2 py-1 text-xs font-bold text-ink-muted sticky left-0 bg-surface-raised z-30 border-r border-border">
                  Den
                </th>
                {allColumns.map(({ user, isKid }) => (
                  <th key={user.id} className="text-center border-l border-border relative">
                    <ColHeader
                      user={user}
                      isKid={isKid}
                      onRemove={!isKid ? () => toggleExtraUser(user.id) : undefined}
                    />
                    {/* Colour bar at bottom of header cell */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{
                        background: isKid
                          ? ROLE_COLORS['KID']
                          : (ROLE_COLORS[user.role] ?? '#94a3b8'),
                      }}
                    />
                  </th>
                ))}
                {/* Add column button in header */}
                <th className="text-center border-l border-border w-10 bg-surface-raised">
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="w-8 h-8 mx-auto my-3 flex items-center justify-center rounded-full border-2 border-dashed border-border text-ink-faint hover:border-primary hover:text-primary transition-all"
                    title="Přidat sloupec"
                  >
                    <Plus size={14} />
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {days.map((day, idx) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const today = isToday(day);
                const mLabel = monthLabel(day, idx);
                const weekBoundary = idx > 0 && isWeekStart(day);

                // Events per column
                const colEvents = allColumns.map(({ user }) =>
                  eventsForUserOnDay(events, user.id, dayStr),
                );

                // Conflicts only across KID columns
                const kidColEvents = colEvents.slice(0, kids.length);
                const conflictPairs = findConflictPairs(kidColEvents);
                const dayHasConflict = conflictPairs.length > 0;

                // Per-column conflict reasons for the tooltip
                const colConflictReasons = allColumns.map((col, colIdx) => {
                  if (!col.isKid) return [] as ConflictReason[];
                  return conflictPairs
                    .filter((p) => p.kidIdxA === colIdx || p.kidIdxB === colIdx)
                    .map((p): ConflictReason => {
                      const isA = p.kidIdxA === colIdx;
                      const otherIdx = isA ? p.kidIdxB : p.kidIdxA;
                      const otherKid = kids[otherIdx];
                      return {
                        otherKidName: otherKid ? (otherKid.nickname ?? otherKid.name.split(' ')[0]) : '?',
                        myEvent: isA ? p.eventA : p.eventB,
                        otherEvent: isA ? p.eventB : p.eventA,
                      };
                    });
                });

                return (
                  <React.Fragment key={dayStr}>
                    {mLabel && (
                      <tr className="bg-primary/10 border-y border-primary/20">
                        <td
                          colSpan={allColumns.length + 2}
                          className="px-3 py-1 text-xs font-extrabold text-primary uppercase tracking-wider sticky left-0"
                        >
                          {mLabel}
                        </td>
                      </tr>
                    )}
                    {weekBoundary && !mLabel && (
                      <tr>
                        <td colSpan={allColumns.length + 2} className="h-px bg-border/60 p-0" />
                      </tr>
                    )}

                    <tr
                      ref={today ? todayRef : undefined}
                      className={`border-b border-border transition-colors ${
                        today ? 'bg-primary/5' : idx % 2 === 0 ? 'bg-surface' : 'bg-surface-raised/40'
                      }`}
                    >
                      {/* Day label — sticky left */}
                      <td className={`sticky left-0 z-10 px-2 py-1 align-top border-r border-border ${
                        today ? 'bg-primary/10' : idx % 2 === 0 ? 'bg-surface' : 'bg-surface-raised/40'
                      }`}>
                        <div className={`text-[10px] font-bold uppercase tracking-wide ${today ? 'text-primary' : 'text-ink-muted'}`}>
                          {format(day, 'EEE', { locale: cs })}
                        </div>
                        <div className={`text-xl font-black leading-none ${today ? 'text-primary' : 'text-ink'}`}>
                          {format(day, 'd')}
                        </div>
                        {dayHasConflict && (
                          <AlertTriangle size={11} className="text-red-500 mt-0.5" />
                        )}
                      </td>

                      {/* One cell per column */}
                      {allColumns.map(({ user, isKid }, colIdx) => {
                        const colEvts = colEvents[colIdx] ?? [];
                        const reasons = colConflictReasons[colIdx] ?? [];
                        const accent = isKid
                          ? ROLE_COLORS['KID']!
                          : (ROLE_COLORS[user.role] ?? '#94a3b8');
                        return (
                          <td key={user.id} className="border-l border-border align-top">
                            <DayCell
                              events={colEvts}
                              conflictReasons={reasons}
                              accentColor={accent}
                            />
                          </td>
                        );
                      })}

                      {/* Empty cell under the "+" column header */}
                      <td className="border-l border-border/40 w-10" />
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {!isLoading && allColumns.length > 0 && (
        <div className="px-4 pt-4 pb-2 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1">
            <AlertTriangle size={12} className="text-red-500" />
            Kolize = akce dětí ve stejný čas (klikni pro detail)
          </span>
          <span>• Kliknutím na akci zobrazíš detail</span>
          <span>• Hover na jméno → × pro odebrání sloupce</span>
        </div>
      )}

      {/* Column picker sheet */}
      <ColumnPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        allUsers={allUsers}
        kids={kids}
        extraUserIds={extraUserIds}
        onToggle={toggleExtraUser}
      />
    </div>
  );
}

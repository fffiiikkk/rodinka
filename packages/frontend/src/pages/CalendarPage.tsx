import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, UserX, UserCheck, CalendarCheck, SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { useEvents } from '../hooks/useEvents.js';
import { useAvailability, useDeleteAvailability } from '../hooks/useAvailability.js';
import { useAdultUsers } from '../hooks/useUsers.js';
import { useAuth } from '../hooks/useAuth.js';
import { monthRange, weekRange, addMonths, addWeeks, parseISO } from '../lib/dates.js';
import { eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays, isToday } from 'date-fns';
import { cs } from 'date-fns/locale';
import Sheet from '../components/ui/Sheet.js';
import EventForm from '../components/events/EventForm.js';
import UnavailabilitySheet from '../components/calendar/UnavailabilitySheet.js';
import { AvailabilityStrip, AvailabilityDots } from '../components/calendar/AvailabilityStrip.js';
import { BirthdayStrip, BirthdayDots } from '../components/calendar/BirthdayStrip.js';
import { useCalendarLayer, type CalendarLayerEvent } from '../hooks/useCalendarLayer.js';
import type { Event, Availability } from '@rodinkal/shared';

// ─── Shared layout constants ──────────────────────────────────────────────────

const LANE_H = 28; // px per multi-day event lane (used in MonthGrid & WeekTimeGrid)

// ─── Week Time-Grid ────────────────────────────────────────────────────────────

const HOUR_START = 7;
const HOUR_END = 22;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const CELL_H = 56; // px per hour

const DAY_SHORT_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

function tgTop(start: Date) {
  const h = start.getHours() + start.getMinutes() / 60;
  return Math.max(0, (h - HOUR_START) * CELL_H);
}
function tgHeight(start: Date, end: Date) {
  const dur = (end.getTime() - start.getTime()) / 3600000;
  return Math.max(CELL_H * 0.35, dur * CELL_H);
}

function TgTimeGutter() {
  return (
    <div className="relative shrink-0 w-12" style={{ height: `${TOTAL_HOURS * CELL_H}px` }}>
      {Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i).map((h) => (
        <div key={h} className="absolute right-2 text-[10px] text-ink-faint font-medium tabular-nums"
          style={{ top: `${(h - HOUR_START) * CELL_H - 7}px` }}>
          {h}:00
        </div>
      ))}
    </div>
  );
}

function TgHourLines() {
  return (
    <>
      {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i).map((i) => (
        <div key={i} className={`absolute left-0 right-0 ${i % 2 === 0 ? 'border-t border-border/50' : 'border-t border-border/20'}`}
          style={{ top: `${i * CELL_H}px` }} />
      ))}
    </>
  );
}

function TgNowLine({ weekStart }: { weekStart: Date }) {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < HOUR_START || h > HOUR_END) return null;
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  if (now < weekStart || now > weekEnd) return null;
  const top = (h - HOUR_START) * CELL_H;
  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
      style={{ top: `${top}px` }}>
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0 shadow-sm" />
      <div className="flex-1 h-[1.5px] bg-red-500" />
    </div>
  );
}

function TgEventBlock({ event }: { event: Event & { originalId?: string; isOccurrence?: boolean } }) {
  const color = event.eventType?.color ?? event.colorOverride ?? '#a3a3a3';
  const start = new Date(event.start);
  const end = new Date(event.end);
  const top = tgTop(start);
  const height = tgHeight(start, end);
  const navId = (event as any).originalId ?? event.id;
  return (
    <a href={`/event/${navId}`}
      className="absolute left-0.5 right-0.5 rounded-lg px-2 py-1 overflow-hidden hover:brightness-95 active:scale-[0.98] transition-all z-10 shadow-sm"
      style={{ top: `${top}px`, height: `${height}px`, background: color + '30', borderLeft: `3px solid ${color}`, minHeight: 24 }}>
      <p className="text-[11px] font-bold leading-tight truncate" style={{ color }}>
        {safeIcon(event.eventType?.icon)} {event.title}
      </p>
      {height > 34 && (
        <p className="text-[10px] text-ink-muted leading-tight mt-0.5">
          {start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
          –{end.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      {height > 50 && event.participants.length > 0 && (
        <div className="flex gap-0.5 mt-0.5">
          {event.participants.slice(0, 3).map((p) => (
            <span key={p.userId} title={p.name}
              className="w-3.5 h-3.5 rounded-full text-white text-[7px] font-bold flex items-center justify-center"
              style={{ background: p.role === 'KID' ? '#8b5cf6' : '#0ea5e9' }}>
              {p.name.slice(0, 1)}
            </span>
          ))}
          {event.participants.length > 3 && (
            <span className="text-[8px] text-ink-faint">+{event.participants.length - 3}</span>
          )}
        </div>
      )}
    </a>
  );
}

// All-day row at the top of the week grid (allDay events + availability)
function TgAllDaySection({
  events, availability, weekDays,
}: {
  events: Event[];
  availability: Availability[];
  weekDays: Date[];
}) {
  const multiDay = events.filter(isMultiDayEvent);
  const singleAllDay = events.filter((e) => e.allDay && !isMultiDayEvent(e));

  // Compute spanning layouts for this week
  const spanLayouts = layoutSpanningForWeek(multiDay, weekDays);
  const maxLane = spanLayouts.length > 0 ? Math.max(...spanLayouts.map((l) => l.lane)) : -1;
  const spanH = maxLane >= 0 ? (maxLane + 1) * LANE_H + 6 : 0;

  const hasContent = spanH > 0 || singleAllDay.length > 0 || availability.some((a) => {
    const ws = format(weekDays[0]!, 'yyyy-MM-dd');
    const we = format(weekDays[6]!, 'yyyy-MM-dd');
    return a.dateFrom.slice(0, 10) <= we && a.dateTo.slice(0, 10) >= ws;
  });

  if (!hasContent) return null;

  return (
    <div className="border-b border-border/60 bg-surface-overlay/30">
      {/* Availability dots row */}
      <div className="flex">
        <div className="w-12 shrink-0 py-0.5 flex items-center justify-end pr-1">
          <span className="text-[9px] text-ink-faint font-medium">Avail</span>
        </div>
        {weekDays.map((day, idx) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayAvail = availability.filter(
            (a) => a.dateFrom.slice(0, 10) <= dayStr && a.dateTo.slice(0, 10) >= dayStr,
          );
          return (
            <div key={idx} className="flex-1 border-l border-border/40 py-0.5 px-0.5">
              <AvailabilityDots items={dayAvail} />
            </div>
          );
        })}
      </div>

      {/* Spanning multi-day events */}
      {spanH > 0 && (
        <div className="relative" style={{ height: `${spanH}px` }}>
          <div className="w-12 shrink-0 absolute left-0 top-0 bottom-0" />
          {spanLayouts.map(({ event, colStart, colEnd, startsHere, endsHere, lane }) => {
            const color = event.eventType?.color ?? event.colorOverride ?? '#a3a3a3';
            const navId = (event as any).originalId ?? event.id;
            const gutterW = 48; // 12 * 4 = w-12
            return (
              <a
                key={`tg-span-${event.id}`}
                href={`/event/${navId}`}
                className="absolute flex items-center overflow-hidden text-xs font-bold hover:brightness-95 transition-all"
                style={{
                  left: `calc(${gutterW}px + ${(colStart / 7) * 100}%)`,
                  right: `${((6 - colEnd) / 7) * 100}%`,
                  top: `${lane * LANE_H + 2}px`,
                  height: `${LANE_H - 2}px`,
                  background: color + '45',
                  color,
                  borderLeft: startsHere ? `3px solid ${color}` : 'none',
                  borderRadius: `${startsHere ? 6 : 0}px ${endsHere ? 6 : 0}px ${endsHere ? 6 : 0}px ${startsHere ? 6 : 0}px`,
                  paddingLeft: '6px',
                  paddingRight: '4px',
                }}
              >
                <span className="truncate">
                  {startsHere ? `${safeIcon(event.eventType?.icon)} ${event.title}` : `↳ ${event.title}`}
                </span>
              </a>
            );
          })}
        </div>
      )}

      {/* Single-day allDay events per column */}
      {singleAllDay.length > 0 && (
        <div className="flex">
          <div className="w-12 shrink-0" />
          {weekDays.map((day, idx) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const chips = singleAllDay.filter((e) => e.start.slice(0, 10) === dayStr);
            return (
              <div key={idx} className="flex-1 border-l border-border/40 px-0.5 pb-1 space-y-0.5">
                {chips.map((e) => {
                  const color = e.eventType?.color ?? e.colorOverride ?? '#a3a3a3';
                  return (
                    <a key={e.id} href={`/event/${(e as any).originalId ?? e.id}`}
                      className="block text-[9px] font-bold px-1 py-0.5 rounded truncate"
                      style={{ background: color + '35', color }}>
                      {safeIcon(e.eventType?.icon)} {e.title}
                    </a>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeekTimeGrid({ events, weekStart, availability }: { events: Event[]; weekStart: Date; availability: Availability[] }) {
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to current time (or 8:00 for other weeks) on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const isCurrentWeek = now >= weekStart && now <= endOfWeek(weekStart, { weekStartsOn: 1 });
    const targetH = isCurrentWeek ? Math.max(HOUR_START, now.getHours() - 1) : 8;
    const scrollTop = (targetH - HOUR_START) * CELL_H;
    scrollRef.current.scrollTop = scrollTop;
  }, [weekStart]);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 230px)', minHeight: '400px' }}>
      {/* Column headers */}
      <div className="flex border-b border-border/60 shrink-0">
        <div className="w-12 shrink-0" />
        {days.map((day, idx) => {
          const tod = isToday(day);
          return (
            <div key={idx} className={`flex-1 py-1.5 text-center border-l border-border/40 ${tod ? 'bg-primary/5' : ''}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wide ${tod ? 'text-primary' : 'text-ink-muted'}`}>
                {DAY_SHORT_CS[idx]}
              </p>
              <p className={`text-sm font-extrabold leading-tight ${tod ? 'text-primary' : 'text-ink'}`}>{format(day, 'd')}</p>
            </div>
          );
        })}
      </div>

      {/* All-day / availability section */}
      <TgAllDaySection events={events} availability={availability} weekDays={days} />

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="flex">
          <TgTimeGutter />
          {days.map((day, idx) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            // Exclude allDay and multi-day events (those go to the all-day section above)
            const dayEvents = (events as any[]).filter((e) => !isMultiDayEvent(e) && String(e.start).slice(0, 10) === dayStr);
            const tod = isToday(day);
            return (
              <div key={idx} className={`flex-1 relative border-l border-border/40 ${tod ? 'bg-primary/[0.03]' : ''}`}
                style={{ height: `${TOTAL_HOURS * CELL_H}px` }}>
                <TgHourLines />
                {tod && <TgNowLine weekStart={weekStart} />}
                {dayEvents.map((e: any) => <TgEventBlock key={e.id} event={e} />)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type CalendarView = 'month' | 'week' | 'agenda';

// ─── Calendar filter ──────────────────────────────────────────────────────────

const FILTER_LS_KEY = 'calendar-filter';

interface CalendarFilter {
  userIds: string[];       // empty = all users
  eventTypeIds: string[];  // empty = all types
}

const EMPTY_FILTER: CalendarFilter = { userIds: [], eventTypeIds: [] };

function loadFilter(): CalendarFilter {
  try { return JSON.parse(localStorage.getItem(FILTER_LS_KEY) ?? 'null') ?? EMPTY_FILTER; }
  catch { return EMPTY_FILTER; }
}

interface FilterUser { id: string; name: string; role: string; photoUrl: string | null }
interface FilterEventType { id: string; nameCs: string; icon: string; color: string }

function FilterSheet({
  open, onClose, filter, setFilter, users, eventTypes,
}: {
  open: boolean;
  onClose: () => void;
  filter: CalendarFilter;
  setFilter: (f: CalendarFilter) => void;
  users: FilterUser[];
  eventTypes: FilterEventType[];
}) {
  const toggleUser = (id: string) =>
    setFilter({
      ...filter,
      userIds: filter.userIds.includes(id)
        ? filter.userIds.filter((x) => x !== id)
        : [...filter.userIds, id],
    });

  const toggleType = (id: string) =>
    setFilter({
      ...filter,
      eventTypeIds: filter.eventTypeIds.includes(id)
        ? filter.eventTypeIds.filter((x) => x !== id)
        : [...filter.eventTypeIds, id],
    });

  const isActive = filter.userIds.length > 0 || filter.eventTypeIds.length > 0;

  return (
    <Sheet open={open} onClose={onClose} title="Filtr kalendáře">
      <div className="p-4 space-y-5">
        {/* Reset */}
        {isActive && (
          <button
            onClick={() => setFilter(EMPTY_FILTER)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors"
          >
            <RotateCcw size={14} />
            Zrušit všechny filtry
          </button>
        )}

        {/* Users */}
        {users.length > 0 && (
          <div>
            <p className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2">
              👤 Osoby
              {filter.userIds.length > 0 && (
                <span className="ml-2 text-primary normal-case font-bold">
                  ({filter.userIds.length} z {users.length} vybráno)
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {users.map((u) => {
                const on = filter.userIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                      on
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'border-border bg-surface-raised text-ink-muted hover:text-ink hover:border-ink-muted'
                    }`}
                  >
                    {on && <X size={10} />}
                    {u.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
            {filter.userIds.length > 0 && (
              <p className="text-[11px] text-ink-faint mt-1.5">
                Zobrazuji jen akce, kde jsou vybrané osoby jako účastník nebo tvůrce.
              </p>
            )}
          </div>
        )}

        {/* Event types */}
        {eventTypes.length > 0 && (
          <div>
            <p className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2">
              📌 Typy akcí
              {filter.eventTypeIds.length > 0 && (
                <span className="ml-2 text-primary normal-case font-bold">
                  ({filter.eventTypeIds.length} z {eventTypes.length} vybráno)
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {eventTypes.map((et) => {
                const on = filter.eventTypeIds.includes(et.id);
                return (
                  <button
                    key={et.id}
                    onClick={() => toggleType(et.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                      on ? 'text-white border-transparent shadow-sm' : 'border-border bg-surface-raised text-ink-muted hover:text-ink'
                    }`}
                    style={on ? { background: et.color, borderColor: et.color } : {}}
                  >
                    {on && <X size={10} />}
                    {et.icon} {et.nameCs}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {users.length === 0 && eventTypes.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-6">
            V aktuálním období nejsou žádné akce k filtrování.
          </p>
        )}

        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm">
          Zavřít
        </button>
      </div>
    </Sheet>
  );
}

// ─── View tabs ─────────────────────────────────────────────────────────────────

function ViewTabs({ view, setView }: { view: CalendarView; setView: (v: CalendarView) => void }) {
  const { t } = useTranslation();
  const tabs: { id: CalendarView; label: string }[] = [
    { id: 'agenda', label: t('calendar.agenda') },
    { id: 'week', label: t('calendar.week') },
    { id: 'month', label: t('calendar.month') },
  ];
  return (
    <div className="flex bg-surface-overlay rounded-lg p-0.5 gap-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setView(tab.id)}
          className={`flex-1 text-sm font-semibold py-1.5 px-2 rounded transition-colors ${
            view === tab.id ? 'bg-surface text-primary shadow-card' : 'text-ink-muted'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// Returns true if this event spans more than one calendar day
// (works for both allDay and timed multi-day events like a roadtrip or business trip)
function isMultiDayEvent(e: Event): boolean {
  return e.end.slice(0, 10) > e.start.slice(0, 10);
}

function AgendaView({
  events, availability, layer, from, to,
  onEditAvail, onDeleteAvail,
}: {
  events: Event[];
  availability: Availability[];
  layer: CalendarLayerEvent[];
  from: Date;
  to: Date;
  onEditAvail?: (item: Availability) => void;
  onDeleteAvail?: (item: Availability) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const days = eachDayOfInterval({ start: from, end: to });

  function dayAvail(dayStr: string) {
    return availability.filter((a) => {
      const af = a.dateFrom.slice(0, 10);
      const at = a.dateTo.slice(0, 10);
      return af <= dayStr && at >= dayStr;
    });
  }

  return (
    <div className="space-y-1 px-4">
      {days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');

        // Events starting on this day
        const startingEvents = events.filter((e) => {
          const eDate = typeof e.start === 'string' ? e.start.slice(0, 10) : format(new Date(e.start), 'yyyy-MM-dd');
          return eDate === dayStr;
        });

        // Multi-day events that started before today but are still ongoing (show as "continues" strip)
        const continuingEvents = events.filter((e) => {
          if (!isMultiDayEvent(e)) return false;
          const startDay = e.start.slice(0, 10);
          const endDay = e.end.slice(0, 10);
          return startDay < dayStr && endDay >= dayStr;
        });

        const dayAvailItems = dayAvail(dayStr);
        const dayLayerItems = layer.filter((l) => l.date === dayStr);
        const hasContent = startingEvents.length > 0 || continuingEvents.length > 0 || dayAvailItems.length > 0 || dayLayerItems.length > 0;

        if (!hasContent) return null;

        return (
          <div key={dayStr}>
            <div className={`flex items-center gap-3 py-2 sticky top-44 z-10 bg-surface/95 backdrop-blur-sm border-b border-border/50 ${isToday(day) ? 'text-primary' : 'text-ink-muted'}`}>
              <span
                className={`text-sm font-black w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  isToday(day) ? 'bg-primary text-white shadow-sm' : 'bg-surface-raised'
                }`}
              >
                {format(day, 'd')}
              </span>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-bold capitalize ${isToday(day) ? 'text-primary' : 'text-ink'}`}>
                  {format(day, 'EEEE', { locale: cs })}
                </span>
                {!isToday(day) && (
                  <span className="ml-2 text-xs text-ink-faint">
                    {format(day, 'd. MMMM', { locale: cs })}
                  </span>
                )}
                {isToday(day) && (
                  <span className="ml-2 text-xs font-bold text-primary/70">Dnes</span>
                )}
              </div>
            </div>
            <BirthdayStrip items={dayLayerItems} />
            <AvailabilityStrip
              items={dayAvailItems}
              currentUserId={user?.id}
              isAdmin={user?.role === 'PARENT'}
              onEdit={onEditAvail}
              onDelete={onDeleteAvail}
            />
            {/* Continuing multi-day events (started earlier) */}
            {continuingEvents.length > 0 && (
              <div className="ml-9 space-y-1 pb-1">
                {continuingEvents.map((e) => {
                  const color = e.eventType?.color ?? e.colorOverride ?? '#a3a3a3';
                  const endDay = e.end.slice(0, 10);
                  const navId = (e as any).originalId ?? e.id;
                  return (
                    <a key={`cont-${e.id}`} href={`/event/${navId}`}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border border-dashed border-border hover:border-primary/40 transition-colors"
                      style={{ borderLeftColor: color, borderLeftWidth: 3, borderLeftStyle: 'solid' }}
                    >
                      <span className="text-base opacity-60">{safeIcon(e.eventType?.icon)}</span>
                      <span className="text-xs text-ink-muted truncate flex-1">
                        ↳ {e.title}
                        <span className="ml-1 opacity-60">až {endDay}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
            {startingEvents.length > 0 && (
              <div className="ml-9 space-y-1 pb-2">
                {startingEvents.map((e) => (
                  <EventChip key={e.id} event={e} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Return the icon only when it looks like an emoji/symbol.
 *  Prevents plain-text icon values (e.g. "Tenis") from rendering as large labels. */
function safeIcon(icon: string | undefined | null, fallback = '📌'): string {
  if (!icon) return fallback;
  // If the value contains ASCII letters or digits it's a text label, not an emoji
  return /[a-zA-Z0-9]/.test(icon) ? fallback : icon;
}

function transportLabel(t: Event['transport']): string | null {
  if (!t) return null;
  if (t.externalName) return `🤝 ${t.externalName}`;
  if (t.userName) {
    if (t.userRole === 'KID') return t.note ? `🚶 ${t.note}` : '🚶 samo';
    return `🚗 ${t.userName}`;
  }
  if (t.note) return `🚶 ${t.note}`;
  return null;
}

function ParticipantAvatars({ participants }: { participants: Event['participants'] }) {
  if (!participants.length) return null;
  const shown = participants.slice(0, 4);
  const rest = participants.length - 4;
  return (
    <span className="flex items-center gap-0.5">
      {shown.map((p) => (
        <span
          key={p.userId}
          title={p.name}
          className="w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center ring-1 ring-white/60 shrink-0"
          style={{ background: p.role === 'KID' ? '#8b5cf6' : '#0ea5e9' }}
        >
          {p.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {rest > 0 && <span className="text-[10px] text-ink-faint font-medium">+{rest}</span>}
    </span>
  );
}

function EventChip({ event }: { event: Event & { originalId?: string; isOccurrence?: boolean } }) {
  const color = event.eventType?.color ?? event.colorOverride ?? '#a3a3a3';
  const startDay = event.start.slice(0, 10);
  const endDay = event.end.slice(0, 10);
  const isMultiDay = endDay > startDay;
  const startTime = event.allDay ? '' : new Date(event.start).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const transport = transportLabel(event.transport);
  const navId = event.originalId ?? event.id;
  const isRecurring = !!(event.recurrenceRule || event.isOccurrence);

  return (
    <a
      href={`/event/${navId}`}
      className="flex items-center gap-2 rounded-xl p-2.5 border border-border/60 hover:shadow-raised hover:border-border active:scale-[.99] transition-all"
      style={{
        borderLeftColor: color,
        borderLeftWidth: 3,
        background: color + '0d',
      }}
    >
      <span className="text-lg shrink-0">{safeIcon(event.eventType?.icon)}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-ink truncate">{event.title}</p>
        <div className="flex items-center gap-2 text-xs text-ink-muted flex-wrap">
          {startTime && <span className="font-medium">{startTime}</span>}
          {isMultiDay && (
            <span className="font-bold" style={{ color }}>
              → {format(new Date(event.end), 'd.M.')}
            </span>
          )}
          {event.location && <span>📍 {event.location}</span>}
          {isRecurring && <span className="text-primary/70">🔄</span>}
          {transport && (
            <span className="text-xs font-medium text-primary/80 bg-primary/8 px-1.5 py-0.5 rounded-full">{transport}</span>
          )}
          <ParticipantAvatars participants={event.participants} />
        </div>
      </div>
      {event.status === 'PROPOSED' && (
        <span className="text-xs bg-warning/20 text-warning font-bold px-1.5 py-0.5 rounded-full shrink-0">čeká</span>
      )}
    </a>
  );
}

interface SpanningLayout {
  event: Event;
  colStart: number;  // 0-6, clamped to week
  colEnd: number;    // 0-6, inclusive, clamped to week
  startsHere: boolean;
  endsHere: boolean;
  lane: number;
}

function layoutSpanningForWeek(multiDayEvents: Event[], weekDays: Date[]): SpanningLayout[] {
  const weekStartStr = format(weekDays[0]!, 'yyyy-MM-dd');
  const weekEndStr = format(weekDays[6]!, 'yyyy-MM-dd');

  // Events overlapping this week
  const overlapping = multiDayEvents.filter((e) => {
    const evStart = e.start.slice(0, 10);
    const evEnd = e.end.slice(0, 10);
    return evStart <= weekEndStr && evEnd >= weekStartStr;
  });

  // Sort by start date so earlier events get lower lanes
  overlapping.sort((a, b) => a.start.localeCompare(b.start));

  const laneEndCols: number[] = [];

  return overlapping.map((event) => {
    const evStart = event.start.slice(0, 10);
    const evEnd = event.end.slice(0, 10);
    const startsHere = evStart >= weekStartStr;
    const endsHere = evEnd <= weekEndStr;

    const colStart = startsHere
      ? weekDays.findIndex((d) => format(d, 'yyyy-MM-dd') === evStart)
      : 0;
    const colEnd = endsHere
      ? weekDays.findIndex((d) => format(d, 'yyyy-MM-dd') === evEnd)
      : 6;

    // Greedy lane assignment: find first lane where colStart > last occupied col
    let lane = 0;
    while (laneEndCols[lane] !== undefined && laneEndCols[lane]! >= colStart) {
      lane++;
    }
    laneEndCols[lane] = colEnd;

    return { event, colStart, colEnd, startsHere, endsHere, lane };
  });
}

function MonthGrid({ events, availability, layer, currentDate }: { events: Event[]; availability: Availability[]; layer: CalendarLayerEvent[]; currentDate: Date }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Split days into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7) as Date[]);
  }

  // Separate multi-day (spanning) events from single-day events
  const multiDayEvents = events.filter(isMultiDayEvent);
  const singleDayEvents = events.filter((e) => !isMultiDayEvent(e));

  const dayNames = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

  return (
    <div className="px-2">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-ink-muted py-1">{d}</div>
        ))}
      </div>

      {/* Week rows */}
      <div className="rounded-lg overflow-hidden border border-border">
        {weeks.map((weekDays, weekIdx) => {
          const spanningLayouts = layoutSpanningForWeek(multiDayEvents, weekDays);
          const maxLane = spanningLayouts.length > 0 ? Math.max(...spanningLayouts.map((l) => l.lane)) : -1;
          const spanAreaHeight = maxLane >= 0 ? (maxLane + 1) * LANE_H + 6 : 0;

          return (
            <div key={weekIdx} className={weekIdx > 0 ? 'border-t border-border' : ''}>
              {/* Spanning events bar */}
              {spanAreaHeight > 0 && (
                <div className="relative bg-surface px-px" style={{ height: `${spanAreaHeight}px` }}>
                  {spanningLayouts.map(({ event, colStart, colEnd, startsHere, endsHere, lane }) => {
                    const color = event.eventType?.color ?? event.colorOverride ?? '#a3a3a3';
                    const navId = (event as any).originalId ?? event.id;
                    const leftPct = `${(colStart / 7) * 100}%`;
                    const rightPct = `${((6 - colEnd) / 7) * 100}%`;
                    const rTL = startsHere ? 6 : 0;
                    const rTR = endsHere ? 6 : 0;
                    return (
                      <a
                        key={`${event.id}-w${weekIdx}`}
                        href={`/event/${navId}`}
                        className="absolute flex items-center overflow-hidden text-[11px] font-bold hover:brightness-90 active:scale-[0.99] transition-all select-none shadow-sm"
                        style={{
                          left: leftPct,
                          right: rightPct,
                          top: `${lane * LANE_H + 3}px`,
                          height: `${LANE_H - 4}px`,
                          background: color + '48',
                          color,
                          borderLeft: startsHere ? `3px solid ${color}` : `2px solid ${color}80`,
                          borderRadius: `${rTL}px ${rTR}px ${rTR}px ${rTL}px`,
                          paddingLeft: startsHere ? '6px' : '3px',
                          paddingRight: '4px',
                        }}
                      >
                        <span className={`truncate ${!startsHere ? 'opacity-60' : ''}`}>
                          {startsHere ? `${safeIcon(event.eventType?.icon)} ${event.title}` : `↳ ${event.title}`}
                        </span>
                        {!endsHere && (
                          <span className="ml-auto shrink-0 text-base leading-none opacity-70 pr-0.5">›</span>
                        )}
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Day cells row */}
              <div className="grid grid-cols-7 divide-x divide-border">
                {weekDays.map((day) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const dayEvents = singleDayEvents
                    .filter((e) => String(e.start).slice(0, 10) === dayStr)
                    .slice(0, 2);

                  const dayAvailItems = availability.filter(
                    (a) => a.dateFrom.slice(0, 10) <= dayStr && a.dateTo.slice(0, 10) >= dayStr,
                  );
                  const hasUnavail = dayAvailItems.some((a) => a.status === 'UNAVAILABLE' && !a.isExternal);

                  return (
                    <div
                      key={dayStr}
                      className={`min-h-[60px] p-1 relative transition-colors ${
                        isToday(day)
                          ? 'bg-primary/6 ring-1 ring-inset ring-primary/20'
                          : 'bg-surface'
                      } ${!isCurrentMonth ? 'opacity-40' : ''} ${hasUnavail ? 'ring-1 ring-inset ring-danger/20' : ''}`}
                    >
                      <span
                        className={`font-black flex items-center justify-center rounded-full mb-0.5 ${
                          isToday(day)
                            ? 'bg-primary text-white text-[11px] w-6 h-6 shadow-sm'
                            : 'text-xs w-5 h-5 text-ink'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      <div className="space-y-0.5">
                        {dayEvents.map((e) => (
                          <a
                            key={e.id}
                            href={`/event/${(e as any).originalId ?? e.id}`}
                            className="block text-[10px] px-1 py-0.5 rounded truncate font-medium leading-tight"
                            style={{
                              background: (e.eventType?.color ?? e.colorOverride ?? '#a3a3a3') + '30',
                              color: e.eventType?.color ?? '#475569',
                            }}
                          >
                            {safeIcon(e.eventType?.icon, '•')} {e.title}
                          </a>
                        ))}
                      </div>
                      <BirthdayDots items={layer.filter((l) => l.date === dayStr)} />
                      <AvailabilityDots items={dayAvailItems} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<CalendarView>('agenda');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [showUnavail, setShowUnavail] = useState(false);
  const [showAvail, setShowAvail] = useState(false);
  const [showExternal, setShowExternal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [editAvailItem, setEditAvailItem] = useState<Availability | null>(null);
  const [filter, setFilterState] = useState<CalendarFilter>(loadFilter);
  const { user } = useAuth();
  const deleteAvailability = useDeleteAvailability();
  const { data: adultUsers = [] } = useAdultUsers();

  const setFilter = (f: CalendarFilter) => {
    setFilterState(f);
    localStorage.setItem(FILTER_LS_KEY, JSON.stringify(f));
  };
  const isFilterActive = filter.userIds.length > 0 || filter.eventTypeIds.length > 0;

  const isGuardian = user?.role === 'PARENT' || user?.role === 'GRANDPARENT' || user?.role === 'RELATIVE';

  const { from, to } = view === 'month'
    ? monthRange(currentDate)
    : view === 'week'
    ? weekRange(currentDate)
    : { from: currentDate, to: addDays(currentDate, 13) };

  // Expand range for month view grid
  const queryFrom = view === 'month'
    ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    : from;
  const queryTo = view === 'month'
    ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    : to;

  const { data: events = [], isLoading } = useEvents(queryFrom, queryTo);
  const { data: availability = [] } = useAvailability(queryFrom, queryTo);
  const { data: layer = [] } = useCalendarLayer(queryFrom, queryTo);

  // Derive unique users and event types from fetched events (used by FilterSheet picker)
  const filterUsers = React.useMemo<FilterUser[]>(() => {
    const map = new Map<string, FilterUser>();
    for (const e of events) {
      for (const p of e.participants) {
        if (!map.has(p.userId)) {
          map.set(p.userId, { id: p.userId, name: p.name, role: p.role, photoUrl: p.photoUrl ?? null });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }, [events]);

  const filterEventTypes = React.useMemo<FilterEventType[]>(() => {
    const map = new Map<string, FilterEventType>();
    for (const e of events) {
      if (e.eventType && e.eventTypeId && !map.has(e.eventTypeId)) {
        map.set(e.eventTypeId, {
          id: e.eventTypeId,
          nameCs: e.eventType.nameCs ?? e.eventType.nameEn ?? '',
          icon: e.eventType.icon ?? '📌',
          color: e.eventType.color ?? '#a3a3a3',
        });
      }
    }
    return [...map.values()].sort((a, b) => a.nameCs.localeCompare(b.nameCs, 'cs'));
  }, [events]);

  // Apply client-side filter to the fetched events
  const filteredEvents = React.useMemo(() => {
    let result = events;
    if (filter.userIds.length > 0) {
      result = result.filter((e) =>
        filter.userIds.includes(e.createdById) ||
        e.participants.some((p) => filter.userIds.includes(p.userId)),
      );
    }
    if (filter.eventTypeIds.length > 0) {
      result = result.filter((e) => e.eventTypeId && filter.eventTypeIds.includes(e.eventTypeId));
    }
    return result;
  }, [events, filter]);

  const goNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 7));
  };
  const goPrev = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, -1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, -1));
    else setCurrentDate(addDays(currentDate, -7));
  };

  const canCreate = user?.role !== 'GUEST';
  const title = view === 'month'
    ? format(currentDate, 'MMMM yyyy')
    : view === 'week'
    ? `${format(from, 'd.M.')} – ${format(to, 'd.M. yyyy')}`
    : format(currentDate, 'd. MMMM yyyy');

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="sticky top-14 z-20 bg-surface/95 backdrop-blur-sm px-4 py-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={goPrev} className="p-2 text-ink-muted hover:text-ink transition-colors">
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="font-bold text-ink capitalize hover:text-primary transition-colors"
          >
            {title}
          </button>
          <button onClick={goNext} className="p-2 text-ink-muted hover:text-ink transition-colors">
            <ChevronRight size={22} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ViewTabs view={view} setView={setView} />
          </div>
          <button
            onClick={() => setShowFilter(true)}
            className={`relative p-2 rounded-lg transition-colors shrink-0 ${
              isFilterActive ? 'bg-primary text-white' : 'bg-surface-overlay text-ink-muted hover:text-ink'
            }`}
            aria-label="Filtr"
          >
            <SlidersHorizontal size={16} />
            {isFilterActive && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-warning text-[9px] font-bold text-white flex items-center justify-center leading-none">
                {filter.userIds.length + filter.eventTypeIds.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter active banner */}
      {isFilterActive && (
        <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-semibold">
          <SlidersHorizontal size={12} />
          <span className="flex-1">
            Filtr aktivní
            {filter.userIds.length > 0 && ` · ${filter.userIds.length} ${filter.userIds.length === 1 ? 'osoba' : filter.userIds.length < 5 ? 'osoby' : 'osob'}`}
            {filter.eventTypeIds.length > 0 && ` · ${filter.eventTypeIds.length} ${filter.eventTypeIds.length === 1 ? 'typ' : 'typy'}`}
          </span>
          <button onClick={() => setFilter(EMPTY_FILTER)} className="flex items-center gap-0.5 hover:opacity-70 transition-opacity">
            <RotateCcw size={11} />
            reset
          </button>
        </div>
      )}

      {/* Content */}
      <div className="mt-2">
        {isLoading ? (
          <div className="px-4 space-y-2 mt-4">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
          </div>
        ) : view === 'month' ? (
          <MonthGrid events={filteredEvents} availability={availability} layer={layer} currentDate={currentDate} />
        ) : view === 'week' ? (
          <WeekTimeGrid events={filteredEvents} weekStart={queryFrom} availability={availability} />
        ) : (
          <AgendaView
            events={filteredEvents}
            availability={availability}
            layer={layer}
            from={queryFrom}
            to={queryTo}
            onEditAvail={(item) => setEditAvailItem(item)}
            onDeleteAvail={(item) => {
              if (window.confirm(`Smazat záznam pro ${item.isExternal ? item.externalName : item.userName}?`)) {
                deleteAvailability.mutate(item.id);
              }
            }}
          />
        )}
      </div>

      {/* FABs — speed-dial cluster */}
      <div className="fixed bottom-24 right-4 flex flex-col items-end gap-2 z-20">
        {/* External helper — admin only */}
        {user?.role === 'PARENT' && (
          <button onClick={() => setShowExternal(true)}
            className="flex items-center gap-2 pl-3 pr-4 h-10 bg-blue-500 text-white rounded-full shadow-raised hover:bg-blue-600 active:scale-95 transition-all"
          >
            <UserCheck size={16} />
            <span className="text-xs font-bold whitespace-nowrap">Výpomoc</span>
          </button>
        )}
        {/* Mark as available — all guardians */}
        {isGuardian && (
          <button onClick={() => setShowAvail(true)}
            className="flex items-center gap-2 pl-3 pr-4 h-10 bg-emerald-500 text-white rounded-full shadow-raised hover:bg-emerald-600 active:scale-95 transition-all"
          >
            <CalendarCheck size={16} />
            <span className="text-xs font-bold whitespace-nowrap">Dostupnost</span>
          </button>
        )}
        {/* Own unavailability — all guardians */}
        {isGuardian && (
          <button onClick={() => setShowUnavail(true)}
            className="flex items-center gap-2 pl-3 pr-4 h-10 bg-red-500 text-white rounded-full shadow-raised hover:bg-red-600 active:scale-95 transition-all"
          >
            <UserX size={16} />
            <span className="text-xs font-bold whitespace-nowrap">Nedostupnost</span>
          </button>
        )}
        {canCreate && (
          <button onClick={() => setShowForm(true)}
            className="w-14 h-14 bg-gradient-to-br from-primary to-accent text-white rounded-full shadow-raised flex items-center justify-center hover:scale-105 hover:shadow-[0_0_0_8px_rgba(99,102,241,0.15)] active:scale-95 transition-all duration-200"
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <Sheet open={showForm} onClose={() => setShowForm(false)} title={t('calendar.addEvent')} fullScreen>
        <EventForm onClose={() => setShowForm(false)} defaultDate={currentDate} />
      </Sheet>

      <Sheet open={showUnavail} onClose={() => setShowUnavail(false)} title="Nastavit nedostupnost">
        <UnavailabilitySheet
          onClose={() => setShowUnavail(false)}
          defaultDate={currentDate}
          initialMode="unavailable"
          adminUsers={user?.role === 'PARENT' ? adultUsers.filter((u) => u.id !== user.id) : undefined}
        />
      </Sheet>

      <Sheet open={showAvail} onClose={() => setShowAvail(false)} title="Nastavit dostupnost">
        <UnavailabilitySheet
          onClose={() => setShowAvail(false)}
          defaultDate={currentDate}
          initialMode="available"
          adminUsers={user?.role === 'PARENT' ? adultUsers.filter((u) => u.id !== user.id) : undefined}
        />
      </Sheet>

      <Sheet open={showExternal} onClose={() => setShowExternal(false)} title="Přidat externí výpomoc">
        <UnavailabilitySheet onClose={() => setShowExternal(false)} defaultDate={currentDate} initialMode="external" />
      </Sheet>

      {/* Edit existing availability record */}
      <Sheet
        open={!!editAvailItem}
        onClose={() => setEditAvailItem(null)}
        title="Upravit záznam"
      >
        {editAvailItem && (
          <UnavailabilitySheet
            onClose={() => setEditAvailItem(null)}
            editItem={editAvailItem}
          />
        )}
      </Sheet>

      <FilterSheet
        open={showFilter}
        onClose={() => setShowFilter(false)}
        filter={filter}
        setFilter={setFilter}
        users={filterUsers}
        eventTypes={filterEventTypes}
      />
    </div>
  );
}

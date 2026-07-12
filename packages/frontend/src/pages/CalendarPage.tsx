import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, UserX, UserCheck, CalendarCheck } from 'lucide-react';
import { useEvents } from '../hooks/useEvents.js';
import { useAvailability, useDeleteAvailability } from '../hooks/useAvailability.js';
import { useAuth } from '../hooks/useAuth.js';
import { monthRange, weekRange, addMonths, addWeeks, addDays, format, isToday, parseISO } from '../lib/dates.js';
import { eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cs } from 'date-fns/locale';
import Sheet from '../components/ui/Sheet.js';
import EventForm from '../components/events/EventForm.js';
import UnavailabilitySheet from '../components/calendar/UnavailabilitySheet.js';
import { AvailabilityStrip, AvailabilityDots } from '../components/calendar/AvailabilityStrip.js';
import { BirthdayStrip, BirthdayDots } from '../components/calendar/BirthdayStrip.js';
import { useCalendarLayer, type CalendarLayerEvent } from '../hooks/useCalendarLayer.js';
import type { Event, Availability } from '@rodinkal/shared';

// ─── Week Time-Grid ────────────────────────────────────────────────────────────

const HOUR_START = 7;
const HOUR_END = 21;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const CELL_H = 52; // px per hour

const DAY_SHORT_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

function tgTop(start: Date) {
  const h = start.getHours() + start.getMinutes() / 60;
  return Math.max(0, (h - HOUR_START) * CELL_H);
}
function tgHeight(start: Date, end: Date) {
  const dur = (end.getTime() - start.getTime()) / 3600000;
  return Math.max(CELL_H * 0.4, dur * CELL_H);
}

function TgTimeGutter() {
  return (
    <div className="relative shrink-0 w-10" style={{ height: `${TOTAL_HOURS * CELL_H}px` }}>
      {Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i).map((h) => (
        <div key={h} className="absolute right-1 text-[10px] text-ink-faint font-medium"
          style={{ top: `${(h - HOUR_START) * CELL_H - 6}px` }}>
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
        <div key={i} className="absolute left-0 right-0 border-t border-border/40"
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
      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
      <div className="flex-1 h-0.5 bg-red-500 opacity-70" />
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
      className="absolute left-0.5 right-0.5 rounded-lg px-1.5 py-1 overflow-hidden hover:brightness-95 transition-all z-10"
      style={{ top: `${top}px`, height: `${height}px`, background: color + '22', borderLeft: `3px solid ${color}`, minHeight: 22 }}>
      <p className="text-[11px] font-bold text-ink truncate leading-tight">
        {event.eventType?.icon} {event.title}
      </p>
      {height > 30 && (
        <p className="text-[10px] text-ink-muted leading-tight">
          {start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
          –{end.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </a>
  );
}

function WeekTimeGrid({ events, weekStart }: { events: Event[]; weekStart: Date }) {
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
  return (
    <div className="flex flex-col">
      {/* Column headers */}
      <div className="flex border-b border-border/60 shrink-0">
        <div className="w-10 shrink-0" />
        {days.map((day, idx) => {
          const tod = isToday(day);
          return (
            <div key={idx} className={`flex-1 py-1.5 text-center border-l border-border/40 ${tod ? 'bg-primary/5' : ''}`}>
              <p className={`text-[10px] font-bold uppercase ${tod ? 'text-primary' : 'text-ink-muted'}`}>
                {DAY_SHORT_CS[idx]}
              </p>
              <p className={`text-sm font-extrabold ${tod ? 'text-primary' : 'text-ink'}`}>{format(day, 'd')}</p>
            </div>
          );
        })}
      </div>
      {/* Scrollable grid */}
      <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div className="flex">
          <TgTimeGutter />
          {days.map((day, idx) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayEvents = (events as any[]).filter((e) => !e.allDay && String(e.start).slice(0, 10) === dayStr);
            const tod = isToday(day);
            return (
              <div key={idx} className={`flex-1 relative border-l border-border/40 ${tod ? 'bg-primary/3' : ''}`}
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

// Returns true if this event spans more than one calendar day (allDay only)
function isMultiDayEvent(e: Event): boolean {
  if (!e.allDay) return false;
  return e.end.slice(0, 10) > e.start.slice(0, 10);
}

function AgendaView({ events, availability, layer, from, to }: { events: Event[]; availability: Availability[]; layer: CalendarLayerEvent[]; from: Date; to: Date }) {
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
            <div className={`flex items-center gap-3 py-2 sticky top-14 bg-surface z-10 ${isToday(day) ? 'text-primary' : 'text-ink-muted'}`}>
              <span className={`text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isToday(day) ? 'bg-primary text-white' : ''}`}>
                {format(day, 'd')}
              </span>
              <span className="text-sm capitalize">
                {format(day, 'EEEE')}
              </span>
            </div>
            <BirthdayStrip items={dayLayerItems} />
            <AvailabilityStrip items={dayAvailItems} />
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
                      <span className="text-base opacity-60">{e.eventType?.icon ?? '📌'}</span>
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

function EventChip({ event }: { event: Event & { originalId?: string; isOccurrence?: boolean } }) {
  const color = event.eventType?.color ?? event.colorOverride ?? '#a3a3a3';
  const startTime = event.allDay ? '' : new Date(event.start).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const transport = transportLabel(event.transport);
  // Recurring occurrences have a composite ID — navigate to the original series
  const navId = event.originalId ?? event.id;
  const isRecurring = !!(event.recurrenceRule || event.isOccurrence);

  return (
    <a href={`/event/${navId}`} className="flex items-center gap-2 bg-surface-raised rounded-lg p-2.5 border border-border hover:shadow-card transition-shadow">
      <div className="w-1.5 h-full rounded-full shrink-0 self-stretch" style={{ background: color }} />
      <span className="text-lg">{event.eventType?.icon ?? '📌'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-ink truncate">{event.title}</p>
        <div className="flex items-center gap-2 text-xs text-ink-muted flex-wrap">
          {startTime && <span>{startTime}</span>}
          {event.location && <span>📍 {event.location}</span>}
          {isRecurring && <span className="text-primary/70">🔄</span>}
          {transport && (
            <span className="text-xs font-medium text-primary/80 bg-primary/8 px-1.5 py-0.5 rounded-full">{transport}</span>
          )}
        </div>
      </div>
      {event.status === 'PROPOSED' && (
        <span className="text-xs bg-warning/20 text-warning font-semibold px-1.5 py-0.5 rounded shrink-0">čeká</span>
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

const LANE_H = 22; // px per spanning event lane

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
          const spanAreaHeight = maxLane >= 0 ? (maxLane + 1) * LANE_H + 4 : 0;

          return (
            <div key={weekIdx} className={weekIdx > 0 ? 'border-t border-border' : ''}>
              {/* Spanning events bar */}
              {spanAreaHeight > 0 && (
                <div className="relative bg-surface" style={{ height: `${spanAreaHeight}px` }}>
                  {spanningLayouts.map(({ event, colStart, colEnd, startsHere, endsHere, lane }) => {
                    const color = event.eventType?.color ?? event.colorOverride ?? '#a3a3a3';
                    const navId = (event as any).originalId ?? event.id;
                    const leftPct = `${(colStart / 7) * 100}%`;
                    const rightPct = `${((6 - colEnd) / 7) * 100}%`;
                    const br = `${startsHere ? 4 : 0}px ${endsHere ? 4 : 0}px ${endsHere ? 4 : 0}px ${startsHere ? 4 : 0}px`;
                    return (
                      <a
                        key={`${event.id}-w${weekIdx}`}
                        href={`/event/${navId}`}
                        className="absolute flex items-center overflow-hidden text-xs font-semibold hover:brightness-95 transition-all select-none"
                        style={{
                          left: leftPct,
                          right: rightPct,
                          top: `${lane * LANE_H + 2}px`,
                          height: `${LANE_H - 2}px`,
                          background: color + '28',
                          color,
                          borderLeft: startsHere ? `3px solid ${color}` : `1px dashed ${color}`,
                          borderRight: endsHere ? `1px solid ${color}` : 'none',
                          borderTop: `1px solid ${color}20`,
                          borderBottom: `1px solid ${color}20`,
                          borderRadius: br,
                          paddingLeft: startsHere ? '6px' : '4px',
                          paddingRight: '4px',
                        }}
                      >
                        <span className="truncate">
                          {startsHere
                            ? `${event.eventType?.icon ?? '📌'} ${event.title}`
                            : `↳ ${event.title}`}
                        </span>
                        {!endsHere && (
                          <span className="ml-auto shrink-0 opacity-60 pr-0.5">›</span>
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
                      className={`bg-surface min-h-[60px] p-1 relative ${!isCurrentMonth ? 'opacity-40' : ''} ${hasUnavail ? 'ring-1 ring-inset ring-danger/20' : ''}`}
                    >
                      <span
                        className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full mb-0.5 ${
                          isToday(day) ? 'bg-primary text-white' : 'text-ink'
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
                            {e.eventType?.icon ?? '•'} {e.title}
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
  const { user } = useAuth();

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
        <ViewTabs view={view} setView={setView} />
      </div>

      {/* Content */}
      <div className="mt-2">
        {isLoading ? (
          <div className="px-4 space-y-2 mt-4">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
          </div>
        ) : view === 'month' ? (
          <MonthGrid events={events} availability={availability} layer={layer} currentDate={currentDate} />
        ) : view === 'week' ? (
          <WeekTimeGrid events={events} weekStart={queryFrom} />
        ) : (
          <AgendaView events={events} availability={availability} layer={layer} from={queryFrom} to={queryTo} />
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
            className="w-14 h-14 bg-primary text-white rounded-full shadow-raised flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            <Plus size={26} />
          </button>
        )}
      </div>

      <Sheet open={showForm} onClose={() => setShowForm(false)} title={t('calendar.addEvent')} fullScreen>
        <EventForm onClose={() => setShowForm(false)} defaultDate={currentDate} />
      </Sheet>

      <Sheet open={showUnavail} onClose={() => setShowUnavail(false)} title="Nastavit nedostupnost">
        <UnavailabilitySheet onClose={() => setShowUnavail(false)} defaultDate={currentDate} initialMode="unavailable" />
      </Sheet>

      <Sheet open={showAvail} onClose={() => setShowAvail(false)} title="Nastavit dostupnost">
        <UnavailabilitySheet onClose={() => setShowAvail(false)} defaultDate={currentDate} initialMode="available" />
      </Sheet>

      <Sheet open={showExternal} onClose={() => setShowExternal(false)} title="Přidat externí výpomoc">
        <UnavailabilitySheet onClose={() => setShowExternal(false)} defaultDate={currentDate} initialMode="external" />
      </Sheet>
    </div>
  );
}

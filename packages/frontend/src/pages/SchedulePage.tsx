import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ChevronLeft, ChevronRight, RefreshCw, Clock } from 'lucide-react';
import { startOfWeek, endOfWeek, addWeeks, format, eachDayOfInterval, isToday, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useEvents } from '../hooks/useEvents.js';
import Sheet from '../components/ui/Sheet.js';
import EventForm from '../components/events/EventForm.js';
import type { Event } from '@rodinkal/shared';

const HOUR_START = 7;  // 7:00
const HOUR_END = 20;   // 20:00
const TOTAL_HOURS = HOUR_END - HOUR_START;
const CELL_HEIGHT = 56; // px per hour

const DAY_LABELS_CS = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
const DAY_SHORT_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

function eventTop(start: Date): number {
  const h = start.getHours() + start.getMinutes() / 60;
  return Math.max(0, (h - HOUR_START) * CELL_HEIGHT);
}

function eventHeight(start: Date, end: Date): number {
  const duration = (end.getTime() - start.getTime()) / 1000 / 60 / 60;
  return Math.max(CELL_HEIGHT * 0.4, duration * CELL_HEIGHT);
}

function EventBlock({ event }: { event: Event & { originalId?: string; isOccurrence?: boolean } }) {
  const color = event.eventType?.color ?? event.colorOverride ?? '#a3a3a3';
  const start = new Date(event.start);
  const end = new Date(event.end);
  const top = eventTop(start);
  const height = eventHeight(start, end);
  const navId = event.originalId ?? event.id;
  const isRecurring = !!(event.recurrenceRule || event.isOccurrence);
  const startFmt = start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const endFmt = end.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

  return (
    <a
      href={`/event/${navId}`}
      className="absolute left-0.5 right-0.5 rounded-lg px-1.5 py-1 overflow-hidden hover:brightness-95 active:scale-[0.98] transition-all cursor-pointer z-10"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        background: color + '22',
        borderLeft: `3px solid ${color}`,
        minHeight: '24px',
      }}
    >
      <p className="text-[11px] font-bold text-ink truncate leading-tight">
        {event.eventType?.icon} {event.title}
      </p>
      {height > 32 && (
        <p className="text-[10px] text-ink-muted leading-tight">
          {startFmt}–{endFmt}
          {isRecurring && ' 🔄'}
        </p>
      )}
    </a>
  );
}

function TimeGutter() {
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i);
  return (
    <div className="relative shrink-0 w-10" style={{ height: `${TOTAL_HOURS * CELL_HEIGHT}px` }}>
      {hours.map((h) => (
        <div
          key={h}
          className="absolute right-1 text-[10px] text-ink-faint font-medium"
          style={{ top: `${(h - HOUR_START) * CELL_HEIGHT - 6}px` }}
        >
          {h}:00
        </div>
      ))}
    </div>
  );
}

function HourLines() {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i);
  return (
    <>
      {hours.map((i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-border/40"
          style={{ top: `${i * CELL_HEIGHT}px` }}
        />
      ))}
    </>
  );
}

function CurrentTimeLine({ weekStart }: { weekStart: Date }) {
  const now = new Date();
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  if (now < weekStart || now > weekEnd) return null;

  const h = now.getHours() + now.getMinutes() / 60;
  if (h < HOUR_START || h > HOUR_END) return null;

  const dayIdx = (now.getDay() + 6) % 7; // 0=Mon
  const top = (h - HOUR_START) * CELL_HEIGHT;
  // We'll render an absolutely positioned line over the correct column
  // Since we can't know the column width in CSS easily, we use a full-width bar
  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px` }}
      data-day={dayIdx}
    >
      <div className="h-0.5 bg-red-500 opacity-70" />
    </div>
  );
}

interface LegendProps {
  events: Event[];
}

function RecurringSummary({ events }: LegendProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('cs') ? 'cs' : 'en';

  const recurring = events.filter((e: any) => e.recurrenceRule || e.isOccurrence);
  if (recurring.length === 0) return null;

  const uniqueSeries = new Map<string, typeof events[0]>();
  recurring.forEach((e: any) => {
    const key = e.originalId ?? e.id;
    if (!uniqueSeries.has(key)) uniqueSeries.set(key, e);
  });

  return (
    <div className="px-4 py-3 border-t border-border/60 bg-surface-overlay/50">
      <p className="text-xs font-bold text-ink-muted mb-2 flex items-center gap-1">
        <RefreshCw size={11} /> {lang === 'cs' ? 'Pravidelné události tento týden' : 'Recurring events this week'}
      </p>
      <div className="flex flex-wrap gap-2">
        {Array.from(uniqueSeries.values()).map((e) => (
          <a
            key={e.id}
            href={`/event/${(e as any).originalId ?? e.id}`}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border border-border bg-surface-raised hover:border-primary transition-colors"
            style={{ borderColor: (e.eventType?.color ?? '#a3a3a3') + '60' }}
          >
            <span>{e.eventType?.icon ?? '📌'}</span>
            <span className="text-ink">{e.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('cs') ? 'cs' : 'en';

  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formDefault, setFormDefault] = useState<Date | undefined>(undefined);

  const today = new Date();
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const { data: events = [], isLoading } = useEvents(weekStart, weekEnd);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const isCurrentWeek = weekOffset === 0;

  const getEventsForDay = (day: Date): (Event & { originalId?: string; isOccurrence?: boolean })[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return (events as any[]).filter((e) => {
      if (e.allDay) return false; // all-day events not shown in timetable
      const eDate = String(e.start).slice(0, 10);
      return eDate === dayStr;
    });
  };

  const handleDayClick = (day: Date) => {
    const d = new Date(day);
    d.setHours(9, 0, 0, 0);
    setFormDefault(d);
    setShowForm(true);
  };

  const weekLabel = lang === 'cs'
    ? `${format(weekStart, 'd. M.', { locale: cs })} – ${format(weekEnd, 'd. M. yyyy', { locale: cs })}`
    : `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-3">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-surface-overlay transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex-1 text-center">
          <p className="font-bold text-ink text-sm">{weekLabel}</p>
          {isCurrentWeek && (
            <p className="text-xs text-primary font-medium">
              {lang === 'cs' ? 'Tento týden' : 'This week'}
            </p>
          )}
        </div>

        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-surface-overlay transition-colors"
        >
          <ChevronRight size={16} />
        </button>

        {weekOffset !== 0 && (
          <button
            onClick={() => setWeekOffset(0)}
            className="text-xs text-primary font-semibold px-2 py-1 rounded-lg border border-primary/30 hover:bg-primary/10 transition-colors"
          >
            {lang === 'cs' ? 'Dnes' : 'Today'}
          </button>
        )}
      </div>

      {/* Day column headers */}
      <div className="flex border-b border-border/60 shrink-0">
        <div className="w-10 shrink-0" /> {/* gutter spacer */}
        {days.map((day, idx) => {
          const isTod = isToday(day);
          return (
            <button
              key={idx}
              onClick={() => handleDayClick(day)}
              className={`flex-1 py-2 text-center border-l border-border/40 hover:bg-surface-overlay transition-colors ${isTod ? 'bg-primary/5' : ''}`}
            >
              <p className={`text-[10px] font-semibold uppercase ${isTod ? 'text-primary' : 'text-ink-muted'}`}>
                {DAY_SHORT_CS[idx]}
              </p>
              <p className={`text-sm font-bold ${isTod ? 'text-primary' : 'text-ink'}`}>
                {format(day, 'd')}
              </p>
            </button>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-ink-muted text-sm">
            <Clock size={16} className="mr-2 animate-spin" />
            {lang === 'cs' ? 'Načítám...' : 'Loading...'}
          </div>
        ) : (
          <div className="flex">
            {/* Time gutter */}
            <TimeGutter />

            {/* Day columns */}
            {days.map((day, idx) => {
              const dayEvents = getEventsForDay(day);
              const isTod = isToday(day);
              return (
                <div
                  key={idx}
                  className={`flex-1 relative border-l border-border/40 ${isTod ? 'bg-primary/3' : ''}`}
                  style={{ height: `${TOTAL_HOURS * CELL_HEIGHT}px` }}
                >
                  <HourLines />
                  {isTod && <CurrentTimeLine weekStart={weekStart} />}
                  {dayEvents.map((e) => (
                    <EventBlock key={e.id} event={e} />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recurring events summary */}
      <RecurringSummary events={events as any[]} />

      {/* FAB */}
      <button
        onClick={() => { setFormDefault(undefined); setShowForm(true); }}
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
        aria-label={lang === 'cs' ? 'Přidat událost' : 'Add event'}
      >
        <Plus size={24} />
      </button>

      <Sheet open={showForm} onClose={() => setShowForm(false)} title={t('calendar.addEvent')}>
        <EventForm onClose={() => setShowForm(false)} defaultDate={formDefault} />
      </Sheet>
    </div>
  );
}

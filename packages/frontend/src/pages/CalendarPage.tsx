import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, UserX, UserCheck, CalendarCheck } from 'lucide-react';
import { useEvents } from '../hooks/useEvents.js';
import { useAvailability, useDeleteAvailability } from '../hooks/useAvailability.js';
import { useAuth } from '../hooks/useAuth.js';
import { monthRange, weekRange, addMonths, addWeeks, addDays, format, isToday, parseISO } from '../lib/dates.js';
import { eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import Sheet from '../components/ui/Sheet.js';
import EventForm from '../components/events/EventForm.js';
import UnavailabilitySheet from '../components/calendar/UnavailabilitySheet.js';
import { AvailabilityStrip, AvailabilityDots } from '../components/calendar/AvailabilityStrip.js';
import { BirthdayStrip, BirthdayDots } from '../components/calendar/BirthdayStrip.js';
import { useCalendarLayer, type CalendarLayerEvent } from '../hooks/useCalendarLayer.js';
import type { Event, Availability } from '@rodinkal/shared';

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
        const dayEvents = events.filter((e) => {
          const eDate = typeof e.start === 'string' ? e.start.slice(0, 10) : format(new Date(e.start), 'yyyy-MM-dd');
          return eDate === dayStr;
        });
        const dayAvailItems = dayAvail(dayStr);
        const dayLayerItems = layer.filter((l) => l.date === dayStr);
        const hasContent = dayEvents.length > 0 || dayAvailItems.length > 0 || dayLayerItems.length > 0;

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
            {dayEvents.length > 0 && (
              <div className="ml-9 space-y-1 pb-2">
                {dayEvents.map((e) => (
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

function EventChip({ event }: { event: Event }) {
  const color = event.eventType?.color ?? event.colorOverride ?? '#a3a3a3';
  const startTime = event.allDay ? '' : new Date(event.start).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const transport = transportLabel(event.transport);

  return (
    <a href={`/event/${event.id}`} className="flex items-center gap-2 bg-surface-raised rounded-lg p-2.5 border border-border hover:shadow-card transition-shadow">
      <div className="w-1.5 h-full rounded-full shrink-0 self-stretch" style={{ background: color }} />
      <span className="text-lg">{event.eventType?.icon ?? '📌'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-ink truncate">{event.title}</p>
        <div className="flex items-center gap-2 text-xs text-ink-muted flex-wrap">
          {startTime && <span>{startTime}</span>}
          {event.location && <span>📍 {event.location}</span>}
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

function MonthGrid({ events, availability, layer, currentDate }: { events: Event[]; availability: Availability[]; layer: CalendarLayerEvent[]; currentDate: Date }) {
  const { user } = useAuth();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const dayNames = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

  return (
    <div className="px-2">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-ink-muted py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {days.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const dayEvents = events.filter((e) => {
            const es = String(e.start);
            return es.slice(0, 10) === dayStr;
          }).slice(0, 3);

          const dayAvailItems = availability.filter((a) => {
            return a.dateFrom.slice(0, 10) <= dayStr && a.dateTo.slice(0, 10) >= dayStr;
          });
          const hasUnavail = dayAvailItems.some((a) => a.status === 'UNAVAILABLE' && !a.isExternal);
          const hasExternal = dayAvailItems.some((a) => a.isExternal);

          return (
            <div
              key={dayStr}
              className={`bg-surface min-h-16 p-1 relative ${!isCurrentMonth ? 'opacity-40' : ''} ${hasUnavail ? 'ring-1 ring-inset ring-danger/20' : ''}`}
            >
              <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${
                isToday(day) ? 'bg-primary text-white' : 'text-ink'
              }`}>
                {format(day, 'd')}
              </span>
              <div className="space-y-0.5">
                {dayEvents.map((e) => (
                  <div
                    key={e.id}
                    className="text-xs px-1 py-0.5 rounded truncate font-medium"
                    style={{ background: (e.eventType?.color ?? e.colorOverride ?? '#a3a3a3') + '30', color: e.eventType?.color ?? '#475569' }}
                  >
                    {e.eventType?.icon ?? '•'} {e.title}
                  </div>
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

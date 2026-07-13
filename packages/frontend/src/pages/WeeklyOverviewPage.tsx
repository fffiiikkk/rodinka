/**
 * WeeklyOverviewPage — personalised next-7-days summary
 *
 * Kids  → colourful day cards, big emoji, motivational phrases, fun design
 * Adults → structured daily grid with events, availability coverage & transport
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, startOfDay, isSameDay, isToday, isTomorrow } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Car, UserX, CalendarCheck, UserCheck, ChevronRight, Star } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useEvents } from '../hooks/useEvents.js';
import { useAvailability } from '../hooks/useAvailability.js';
import { useCalendarLayer } from '../hooks/useCalendarLayer.js';
import type { Event } from '@rodinkal/shared';
import type { Availability } from '@rodinkal/shared';

/** Render icon only if it looks like an emoji/symbol — not a plain-text label. */
function safeIcon(icon: string | undefined | null, fallback = '📌'): string {
  if (!icon) return fallback;
  return /[a-zA-Z0-9]/.test(icon) ? fallback : icon;
}

/** Build the URL for an event, including ?occ= for recurring occurrences. */
function occUrl(event: { id: string; start: string; [key: string]: unknown }): string {
  const parentId: string = (event as any).originalId ?? event.id;
  if ((event as any).isOccurrence && (event as any).originalId) {
    return `/event/${parentId}?occ=${event.start.slice(0, 10)}`;
  }
  return `/event/${parentId}`;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function weekDays(startDate: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => startOfDay(addDays(startDate, i)));
}

function dayLabel(d: Date): string {
  if (isToday(d))    return 'Dnes';
  if (isTomorrow(d)) return 'Zítra';
  return format(d, 'EEEE', { locale: cs });
}

function eventsForDay(events: Event[], day: Date): Event[] {
  const ds = format(day, 'yyyy-MM-dd');
  return events.filter((e) => {
    const start = new Date(e.start);
    return format(start, 'yyyy-MM-dd') === ds && e.status !== 'CANCELLED';
  });
}

function availForDay(avail: Availability[], day: Date): Availability[] {
  return avail.filter((a) => {
    const from = new Date(a.dateFrom);
    const to   = new Date(a.dateTo);
    return day >= startOfDay(from) && day <= startOfDay(to);
  });
}

// Per-day gradient backgrounds for kid view (Monday–Sunday)
const DAY_GRADIENTS = [
  'from-blue-400 to-blue-600',    // Mon
  'from-purple-400 to-purple-600', // Tue
  'from-green-400 to-teal-500',   // Wed
  'from-orange-400 to-amber-500', // Thu
  'from-pink-400 to-rose-500',    // Fri
  'from-yellow-400 to-orange-400',// Sat
  'from-indigo-400 to-blue-500',  // Sun
];

const DAY_BG_LIGHT = [
  'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
  'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
  'bg-green-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800',
  'bg-orange-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
  'bg-pink-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800',
  'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800',
  'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800',
];

const DAY_TEXT = [
  'text-blue-700 dark:text-blue-300',
  'text-purple-700 dark:text-purple-300',
  'text-teal-700 dark:text-teal-300',
  'text-amber-700 dark:text-amber-300',
  'text-rose-700 dark:text-rose-300',
  'text-yellow-700 dark:text-yellow-300',
  'text-indigo-700 dark:text-indigo-300',
];

const FUN_EMPTY_MESSAGES = [
  ['😴', 'Lenošivý den — odpočiň si!'],
  ['🎮', 'Volný čas pro hry!'],
  ['🍦', 'Třeba zmrzlina?'],
  ['📺', 'Maraton filmů!'],
  ['🏃', 'Čas na výlet!'],
  ['🎨', 'Kreativní den!'],
  ['📚', 'Čtení na lůžku!'],
];

const ACTIVITY_CHEERS: Record<string, string> = {
  hockey: '🏒 Tak do toho!',
  'ice-hockey': '🏒 Střílej góly!',
  swimming: '🏊 Plave jako ryba!',
  football: '⚽ Hattrick dnes?',
  training: '💪 Dej do toho vše!',
  lesson: '📚 Učení je síla!',
  trip: '🌍 Dobrodružství čeká!',
  vacation: '🏖️ Paráda!',
};

function getCheer(event: Event): string | null {
  const slug = event.eventType?.slug ?? '';
  for (const [key, cheer] of Object.entries(ACTIVITY_CHEERS)) {
    if (slug.includes(key) || (event.title ?? '').toLowerCase().includes(key)) return cheer;
  }
  return null;
}

// ─── Kid view ─────────────────────────────────────────────────────────────────

function KidDayCard({ day, events, calEvents, idx }: {
  day: Date; events: Event[]; calEvents: any[]; idx: number;
}) {
  const gradient = DAY_GRADIENTS[day.getDay() === 0 ? 6 : day.getDay() - 1];
  const isEmpty  = events.length === 0 && calEvents.length === 0;
  const emptyMsg = FUN_EMPTY_MESSAGES[idx % FUN_EMPTY_MESSAGES.length];

  return (
    <div className="rounded-2xl overflow-hidden shadow-raised">
      {/* Day header */}
      <div className={`bg-gradient-to-r ${gradient} p-4 flex items-center justify-between`}>
        <div>
          <p className="text-white/80 text-xs font-bold uppercase tracking-widest">{dayLabel(day)}</p>
          <p className="text-white font-extrabold text-2xl leading-none">
            {format(day, 'd. MMMM', { locale: cs })}
          </p>
        </div>
        <div className="text-4xl">{isEmpty ? emptyMsg[0] : safeIcon(events[0]?.eventType?.icon, '📅')}</div>
      </div>

      {/* Content */}
      <div className="bg-surface p-3 space-y-2">
        {isEmpty ? (
          <div className="text-center py-3">
            <p className="text-ink-muted text-sm font-semibold">{emptyMsg[1]}</p>
          </div>
        ) : (
          <>
            {events.map((e) => {
              const cheer = getCheer(e);
              return (
                <Link key={e.id} to={occUrl(e as any)}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-raised hover:bg-surface-overlay transition-colors"
                >
                  <span className="text-2xl">{safeIcon(e.eventType?.icon)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-ink truncate">{e.title}</p>
                    <p className="text-xs text-ink-muted">
                      {e.allDay ? 'Celý den' : format(new Date(e.start), 'HH:mm')}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                    {cheer && <p className="text-xs font-bold text-primary mt-0.5">{cheer}</p>}
                  </div>
                  <ChevronRight size={14} className="text-ink-faint shrink-0" />
                </Link>
              );
            })}
            {calEvents.map((ce) => (
              <div key={ce.id}
                className="flex items-center gap-3 p-2.5 rounded-xl"
                style={{ background: (ce.color ?? '#6366f1') + '20' }}
              >
                <span className="text-2xl">{ce.type === 'birthday' ? '🎂' : '🌸'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: ce.color }}>{ce.label}</p>
                  {ce.age != null && <p className="text-xs text-ink-muted">Slaví {ce.age} let 🎉</p>}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function KidWeeklyOverview({ events, calLayer }: { events: Event[]; calLayer: any[] }) {
  const { user } = useAuth();
  const today = startOfDay(new Date());
  const days  = weekDays(today);
  const totalEvents = events.length;

  return (
    <div className="pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 text-white text-center">
        <div className="text-5xl mb-2">🗓️</div>
        <h1 className="text-2xl font-extrabold mb-1">Tvůj týden, {user?.name}!</h1>
        <p className="text-white/80 text-sm">
          {totalEvents === 0
            ? 'Zatím nic naplánováno — užij si volno!'
            : `${totalEvents} ${totalEvents === 1 ? 'akce' : totalEvents < 5 ? 'akce' : 'akcí'} tě čeká 🎉`}
        </p>
        {/* Star count */}
        <div className="flex justify-center gap-1 mt-3">
          {Array.from({ length: Math.min(totalEvents, 7) }).map((_, i) => (
            <Star key={i} size={16} className="fill-yellow-300 text-yellow-300" />
          ))}
          {totalEvents === 0 && <span className="text-white/60 text-xs">Žádné hvězdičky tento týden</span>}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {days.map((day, idx) => {
          const dayEvents = eventsForDay(events, day);
          const dayCal    = calLayer.filter((ce) => isSameDay(new Date(ce.date), day));
          return (
            <KidDayCard key={day.toISOString()} day={day} events={dayEvents} calEvents={dayCal} idx={idx} />
          );
        })}
      </div>
    </div>
  );
}

// ─── Guardian/Parent view ─────────────────────────────────────────────────────

function AvailabilityBadges({ avail }: { avail: Availability[] }) {
  if (avail.length === 0) return null;
  const unavail   = avail.filter((a) => a.status === 'UNAVAILABLE' && !a.isExternal);
  const available = avail.filter((a) => a.status === 'AVAILABLE'   && !a.isExternal);
  const external  = avail.filter((a) => a.isExternal);

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {unavail.map((a) => (
        <span key={a.id}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
          title={`${a.userName} — ${a.note ?? 'nedostupný/á'}`}
        >
          <UserX size={9} /> {a.userName}
        </span>
      ))}
      {available.map((a) => (
        <span key={a.id}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
          title={`${a.userName} — ${a.note ?? 'dostupný/á'}`}
        >
          <CalendarCheck size={9} /> {a.userName}
        </span>
      ))}
      {external.map((a) => (
        <span key={a.id}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          title={a.externalRole ?? 'Výpomoc'}
        >
          <UserCheck size={9} /> {a.externalName}
        </span>
      ))}
    </div>
  );
}

function GuardianDaySection({
  day, events, avail, calEvents, idx,
}: {
  day: Date; events: Event[]; avail: Availability[]; calEvents: any[]; idx: number;
}) {
  const bgCls  = DAY_BG_LIGHT[day.getDay() === 0 ? 6 : day.getDay() - 1];
  const txtCls = DAY_TEXT[day.getDay() === 0 ? 6 : day.getDay() - 1];
  const isEmpty = events.length === 0 && calEvents.length === 0;

  return (
    <div className={`rounded-2xl border overflow-hidden ${bgCls}`}>
      {/* Day header */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div>
          <span className={`font-extrabold text-base capitalize ${txtCls}`}>{dayLabel(day)}</span>
          <span className="text-ink-muted text-xs ml-2">{format(day, 'd. MMMM', { locale: cs })}</span>
        </div>
        <span className="text-xs font-bold text-ink-faint">{events.length > 0 ? `${events.length} ${events.length === 1 ? 'akce' : 'akcí'}` : ''}</span>
      </div>

      {/* Availability row */}
      {avail.length > 0 && (
        <div className="px-4 pb-2">
          <AvailabilityBadges avail={avail} />
        </div>
      )}

      {/* Events */}
      <div className="bg-surface mx-2 mb-2 rounded-xl overflow-hidden divide-y divide-border">
        {isEmpty ? (
          <p className="text-center text-xs text-ink-faint py-3">Žádné akce</p>
        ) : (
          <>
            {events.map((e) => (
              <Link key={e.id} to={occUrl(e as any)}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-overlay transition-colors"
              >
                <span className="text-lg shrink-0">{safeIcon(e.eventType?.icon)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{e.title}</p>
                  <p className="text-xs text-ink-muted">
                    {e.allDay ? 'Celý den' : `${format(new Date(e.start), 'HH:mm')}–${format(new Date(e.end), 'HH:mm')}`}
                    {e.location ? ` · ${e.location}` : ''}
                  </p>
                  {e.transport?.userName && (
                    <p className="text-xs text-ink-faint flex items-center gap-1 mt-0.5">
                      <Car size={10} /> {e.transport.userName}
                      {e.transport.direction && e.transport.direction !== 'BOTH' && (
                        <span className="text-warning font-semibold">
                          {e.transport.direction === 'THERE' ? '→' : '←'}
                        </span>
                      )}
                    </p>
                  )}
                  {e.transport?.externalName && (
                    <p className="text-xs text-ink-faint flex items-center gap-1 mt-0.5">
                      <Car size={10} /> {e.transport.externalName} (ext.)
                    </p>
                  )}
                  {/* Participants */}
                  {e.participants.length > 0 && (
                    <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
                      {e.participants.slice(0, 4).map((p) => (
                        <span key={p.userId} title={p.name}
                          className="w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
                          style={{ background: p.role === 'KID' ? '#8b5cf6' : '#0ea5e9' }}>
                          {p.name.slice(0, 1).toUpperCase()}
                        </span>
                      ))}
                      {e.participants.length > 4 && (
                        <span className="text-[10px] text-ink-faint">+{e.participants.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
                <div
                  className="w-2 h-8 rounded-full shrink-0"
                  style={{ background: e.eventType?.color ?? '#a3a3a3' }}
                />
              </Link>
            ))}
            {calEvents.map((ce) => (
              <div key={ce.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="text-lg shrink-0">{ce.type === 'birthday' ? '🎂' : '🌸'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: ce.color }}>{ce.label}</p>
                  {ce.age != null && <p className="text-xs text-ink-muted">{ce.age} let</p>}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function GuardianWeeklyOverview({
  events, avail, calLayer, isParent,
}: {
  events: Event[]; avail: Availability[]; calLayer: any[]; isParent: boolean;
}) {
  const { user } = useAuth();
  const today = startOfDay(new Date());
  const days  = weekDays(today);

  const totalEvents = events.filter((e) => e.status !== 'CANCELLED').length;
  const unavailCount = avail.filter((a) => a.status === 'UNAVAILABLE' && !a.isExternal).length;
  const helpCount = avail.filter((a) => a.isExternal).length;

  return (
    <div className="pb-8">
      {/* Summary header */}
      <div className="bg-gradient-to-br from-surface-raised to-surface p-6">
        <h1 className="text-xl font-extrabold text-ink mb-1">
          Přehled týdne — {user?.name}
        </h1>
        <p className="text-ink-muted text-sm mb-4">
          {format(today, 'd. MMMM', { locale: cs })} – {format(addDays(today, 6), 'd. MMMM yyyy', { locale: cs })}
        </p>
        {/* Stat pills */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
            <span className="text-sm">📅</span>
            <span className="text-xs font-bold text-primary">{totalEvents} akcí</span>
          </div>
          {unavailCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 rounded-full">
              <UserX size={12} className="text-red-600" />
              <span className="text-xs font-bold text-red-600">{unavailCount}× nedostupnost</span>
            </div>
          )}
          {helpCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <UserCheck size={12} className="text-blue-600" />
              <span className="text-xs font-bold text-blue-600">{helpCount}× výpomoc</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {days.map((day, idx) => {
          const dayEvents = eventsForDay(events, day);
          const dayAvail  = availForDay(avail, day);
          const dayCal    = calLayer.filter((ce) => isSameDay(new Date(ce.date), day));
          return (
            <GuardianDaySection
              key={day.toISOString()}
              day={day}
              events={dayEvents}
              avail={dayAvail}
              calEvents={dayCal}
              idx={idx}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function WeeklyOverviewPage() {
  const { user } = useAuth();
  const isKid     = user?.role === 'KID';
  const isParent  = user?.role === 'PARENT';

  const today   = useMemo(() => startOfDay(new Date()), []);
  const weekEnd = useMemo(() => addDays(today, 7), [today]);

  const { data: events    = [] } = useEvents(today, weekEnd);
  const { data: avail     = [] } = useAvailability(today, weekEnd);
  const { data: calLayer  = [] } = useCalendarLayer(today, weekEnd);

  if (isKid) {
    return <KidWeeklyOverview events={events} calLayer={calLayer} />;
  }

  return (
    <GuardianWeeklyOverview
      events={events}
      avail={avail}
      calLayer={calLayer}
      isParent={isParent}
    />
  );
}

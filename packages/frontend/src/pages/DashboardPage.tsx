import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth.js';
import { useEvents } from '../hooks/useEvents.js';
import { useBadgeProgress } from '../hooks/useBadges.js';
import { api } from '../lib/api.js';
import { addDays, formatRelativeDate, formatDate } from '../lib/dates.js';
import Avatar from '../components/ui/Avatar.js';
import { AlertTriangle, CheckCircle2, Clock, CalendarRange } from 'lucide-react';

function MotdBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['motd', 'active'],
    queryFn: () => api.get<{ motd: any }>('/motd/active'),
  });

  const motd = data?.motd;
  if (!motd) return null;
  const html = user?.preferredLanguage === 'EN' ? motd.textEn : motd.textCs;

  return (
    <div className="mx-4 mt-4 p-4 bg-accent/10 border border-accent/30 rounded-xl">
      <p className="text-xs font-bold text-accent uppercase tracking-wide mb-2">💬 {t('dashboard.motd')}</p>
      <div
        className="motd-content text-sm text-ink"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function ParentDashboard() {
  const { t } = useTranslation();
  const { data: proposals } = useQuery({
    queryKey: ['events', 'proposals'],
    queryFn: () => api.get<{ proposals: any[] }>('/events/proposals').then((r) => r.proposals),
  });
  const { data: gaps } = useQuery({
    queryKey: ['coverage-gaps'],
    queryFn: () => api.get<{ gaps: any[] }>('/availability/coverage-gaps?' + new URLSearchParams({
      from: new Date().toISOString(),
      to: addDays(new Date(), 14).toISOString(),
    })).then((r) => r.gaps),
  });
  const { user } = useAuth();
  const from = new Date(); const to = addDays(new Date(), 7);
  const { data: events } = useEvents(from, to);
  const { data: progress } = useBadgeProgress();

  return (
    <div className="space-y-4 px-4 pb-4">
      {/* Welcome */}
      <div className="pt-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-ink">{t('dashboard.welcome', { name: user?.name })}</h2>
          <p className="text-ink-muted text-sm">{formatDate(new Date(), user?.preferredLanguage?.toLowerCase())}</p>
        </div>
        <Link to="/week"
          className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors shrink-0"
        >
          <CalendarRange size={14} /> Týdenní přehled
        </Link>
      </div>

      {/* Coverage warnings */}
      {(gaps?.length ?? 0) > 0 ? (
        <div className="card p-4 border-l-4 border-danger">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-danger" />
            <h3 className="font-bold text-ink">{t('dashboard.coverageWarnings')}</h3>
            <span className="ml-auto bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">{gaps?.length}</span>
          </div>
          {gaps?.slice(0, 3).map((gap: any) => (
            <p key={gap.date} className="text-sm text-ink-muted">{formatDate(gap.date)} — {gap.events[0]?.title}</p>
          ))}
        </div>
      ) : (
        <div className="card p-4 border-l-4 border-success">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-success" />
            <span className="font-semibold text-ink">{t('dashboard.noCoverageWarnings')}</span>
          </div>
        </div>
      )}

      {/* Proposals inbox */}
      {(proposals?.length ?? 0) > 0 && (
        <div className="card p-4">
          <h3 className="font-bold text-ink mb-3">{t('dashboard.proposals')} ({proposals?.length})</h3>
          {proposals?.map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="text-2xl">{p.eventType?.icon ?? '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{p.title}</p>
                <p className="text-xs text-ink-muted">{formatRelativeDate(p.start)}</p>
              </div>
              <div className="flex gap-1">
                <ApproveButton eventId={p.id} />
                <RejectButton eventId={p.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming events */}
      <div className="card p-4">
        <h3 className="font-bold text-ink mb-3">{t('dashboard.upcomingEvents')}</h3>
        {!events?.length ? (
          <p className="text-ink-muted text-sm">{t('dashboard.noUpcomingEvents')}</p>
        ) : (
          events.slice(0, 5).map((e: any) => (
            <EventRow key={e.id} event={e} />
          ))
        )}
      </div>

      {/* Badge progress */}
      {(progress?.length ?? 0) > 0 && (
        <div className="card p-4">
          <h3 className="font-bold text-ink mb-3">🏅 {t('dashboard.myBadges')}</h3>
          {progress?.slice(0, 3).map((p: any) => (
            <div key={p.badge.id} className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span>{p.badge.icon}</span>
                <span className="text-sm font-medium text-ink flex-1">{p.badge.nameCs}</span>
                <span className="text-xs text-ink-muted">{p.current}/{p.threshold}</span>
              </div>
              <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${p.percentComplete}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KidDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const from = new Date(); const to = addDays(new Date(), 7);
  const { data: events } = useEvents(from, to, { userId: user?.id });

  return (
    <div className="space-y-4 px-4 pb-4">
      <div className="pt-4 text-center">
        <div className="text-4xl mb-2">👋</div>
        <h2 className="text-2xl font-extrabold text-ink">{t('dashboard.welcome', { name: user?.name })}</h2>
      </div>

      <div className="card p-4">
        <h3 className="font-bold text-ink mb-3 flex items-center gap-2">
          <Clock size={18} /> {t('dashboard.upcomingEvents')}
        </h3>
        {!events?.length ? (
          <p className="text-ink-muted text-sm text-center py-4">{t('dashboard.noUpcomingEvents')}</p>
        ) : (
          events.slice(0, 7).map((e: any) => (
            <EventRow key={e.id} event={e} large />
          ))
        )}
      </div>

      <Link to="/week"
        className="w-full py-4 text-lg flex items-center justify-center gap-2 rounded-xl font-bold bg-gradient-to-r from-primary to-accent text-white shadow-raised"
      >
        🗓️ Můj týden
      </Link>

      <a
        href="/calendar?propose=1"
        className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 rounded-xl"
      >
        ✋ {t('calendar.proposeEvent')}
      </a>
    </div>
  );
}

function GuardianDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const from = new Date(); const to = addDays(new Date(), 14);
  const { data: events } = useEvents(from, to);

  return (
    <div className="space-y-4 px-4 pb-4">
      <div className="pt-4 flex items-start justify-between">
        <h2 className="text-xl font-extrabold text-ink">{t('dashboard.welcome', { name: user?.name })}</h2>
        <Link to="/week"
          className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors shrink-0"
        >
          <CalendarRange size={14} /> Týdenní přehled
        </Link>
      </div>
      <div className="card p-4">
        <h3 className="font-bold text-ink mb-3">{t('dashboard.upcomingEvents')}</h3>
        {events?.slice(0, 8).map((e: any) => (
          <EventRow key={e.id} event={e} />
        ))}
      </div>
    </div>
  );
}

function EventRow({ event, large = false }: { event: any; large?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ background: event.eventType?.color ?? event.colorOverride ?? '#a3a3a3' }}
      />
      <span className="text-xl shrink-0">{event.eventType?.icon ?? '📌'}</span>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${large ? 'text-base' : 'text-sm'}`}>{event.title}</p>
        <p className="text-xs text-ink-muted">{formatRelativeDate(event.start)}{event.location ? ` · ${event.location}` : ''}</p>
      </div>
    </div>
  );
}

function ApproveButton({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  return (
    <button
      onClick={() => api.post(`/events/${eventId}/approve`).then(() => qc.invalidateQueries({ queryKey: ['events'] }))}
      className="text-xs bg-success/10 text-success font-semibold px-2 py-1 rounded"
    >✓</button>
  );
}

function RejectButton({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  return (
    <button
      onClick={() => api.post(`/events/${eventId}/reject`).then(() => qc.invalidateQueries({ queryKey: ['events'] }))}
      className="text-xs bg-danger/10 text-danger font-semibold px-2 py-1 rounded"
    >✗</button>
  );
}

import { useQueryClient } from '@tanstack/react-query';

export default function DashboardPage() {
  const { user } = useAuth();

  const dashboard = user?.role === 'KID'
    ? <KidDashboard />
    : user?.role === 'PARENT'
    ? <ParentDashboard />
    : <GuardianDashboard />;

  return (
    <div>
      <MotdBanner />
      {dashboard}
    </div>
  );
}

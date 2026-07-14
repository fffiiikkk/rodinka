import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth.js';
import { useEvents } from '../hooks/useEvents.js';
import { useBadgeProgress } from '../hooks/useBadges.js';
import { useFeatureFlag } from '../hooks/useFeatureFlag.js';
import { api } from '../lib/api.js';
import { addDays, formatRelativeDate, formatDate } from '../lib/dates.js';
import Avatar from '../components/ui/Avatar.js';
import FridgeBoard from '../components/dashboard/FridgeBoard.js';
import { AlertTriangle, CheckCircle2, Clock, CalendarRange, ChevronRight } from 'lucide-react';

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

function WelcomeHero({ showWeekLink = true }: { showWeekLink?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const roleLabel = () => {
    const overrides: Record<string, string> = {
      PARENT: 'Rodič',
      GRANDPARENT: 'Prarodič',
      RELATIVE: 'Příbuzný',
      KID: 'Člen rodiny',
      GUEST: 'Host',
    };
    return (user as any)?.relationship || overrides[user?.role ?? ''] || '';
  };

  const firstName = (user as any)?.nickname ?? user?.name?.split(' ')[0] ?? '';

  return (
    <div className="mx-4 mt-4 p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-surface to-accent/5 border border-primary/10 relative overflow-hidden">
      {/* Decorative orb */}
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-gradient-to-br from-primary/10 to-accent/5 pointer-events-none" />
      <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-gradient-to-tr from-accent/8 to-transparent pointer-events-none" />

      <div className="flex items-center gap-3 relative">
        {user && <Avatar name={user.name} photoUrl={user.photoUrl} size="lg" />}
        <div className="flex-1 min-w-0">
          {roleLabel() && (
            <p className="text-[11px] font-bold text-primary/70 uppercase tracking-widest mb-0.5">{roleLabel()}</p>
          )}
          <h2 className="text-lg font-black text-ink leading-tight">
            {t('dashboard.welcome', { name: firstName })}
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            {formatDate(new Date(), user?.preferredLanguage?.toLowerCase())}
          </p>
        </div>
        {showWeekLink && (
          <Link
            to="/week"
            className="flex items-center gap-1 px-2.5 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:brightness-110 active:scale-95 transition-all shrink-0 shadow-sm"
          >
            <CalendarRange size={13} />
            <span>Týden</span>
          </Link>
        )}
      </div>
    </div>
  );
}

function ParentDashboard() {
  const { t } = useTranslation();
  const { data: proposals, isLoading: loadingProposals } = useQuery({
    queryKey: ['events', 'proposals'],
    queryFn: () => api.get<{ proposals: any[] }>('/events/proposals').then((r) => r.proposals),
  });
  const { data: gaps, isLoading: loadingGaps } = useQuery({
    queryKey: ['coverage-gaps'],
    queryFn: () => api.get<{ gaps: any[] }>('/availability/coverage-gaps?' + new URLSearchParams({
      from: new Date().toISOString(),
      to: addDays(new Date(), 14).toISOString(),
    })).then((r) => r.gaps),
  });
  const { user } = useAuth();
  const from = new Date(); const to = addDays(new Date(), 7);
  const { data: events, isLoading: loadingEvents } = useEvents(from, to);
  const { data: progress } = useBadgeProgress();

  if (loadingProposals && loadingGaps && loadingEvents) {
    return (
      <div className="px-4 pb-4 space-y-3 pt-4">
        <div className="skeleton h-8 rounded-xl w-2/3" />
        <div className="skeleton h-16 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-16 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <WelcomeHero />

      <div className="px-4 space-y-4">
        {/* Coverage warnings */}
        {(gaps?.length ?? 0) > 0 ? (
          <div className="card overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-danger via-danger/70 to-danger/30" />
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={17} className="text-danger shrink-0" />
                <h3 className="font-bold text-ink flex-1">{t('dashboard.coverageWarnings')}</h3>
                <span className="bg-danger text-white text-xs font-black px-2 py-0.5 rounded-full">{gaps?.length}</span>
              </div>
              {gaps?.slice(0, 3).map((gap: any) => (
                <p key={gap.date} className="text-sm text-ink-muted py-0.5">{formatDate(gap.date)} — {gap.events[0]?.title}</p>
              ))}
            </div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-success via-success/70 to-success/30" />
            <div className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={17} className="text-success shrink-0" />
                <span className="font-semibold text-ink">{t('dashboard.noCoverageWarnings')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Proposals inbox */}
        {(proposals?.length ?? 0) > 0 && (
          <div className="card overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-warning via-warning/70 to-warning/30" />
            <div className="p-4">
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
          </div>
        )}

        {/* Upcoming events */}
        <div className="card p-4">
          <h3 className="font-bold text-ink mb-3">{t('dashboard.upcomingEvents')}</h3>
          {!events?.length ? (
            <p className="text-ink-muted text-sm text-center py-3">{t('dashboard.noUpcomingEvents')}</p>
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
              <div key={p.badge.id} className="mb-3 last:mb-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">{p.badge.icon}</span>
                  <span className="text-sm font-semibold text-ink flex-1 truncate">{p.badge.nameCs}</span>
                  <span className="text-xs font-bold text-primary">{p.current}/{p.threshold}</span>
                </div>
                <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                    style={{ width: `${p.percentComplete}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KidDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const from = new Date(); const to = addDays(new Date(), 7);
  const { data: events } = useEvents(from, to, { userId: user?.id });

  return (
    <div className="space-y-4 pb-4">
      <WelcomeHero showWeekLink={false} />

      <div className="px-4 space-y-4">
        <div className="card p-4">
          <h3 className="font-bold text-ink mb-3 flex items-center gap-2">
            <Clock size={17} className="text-primary" /> {t('dashboard.upcomingEvents')}
          </h3>
          {!events?.length ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-ink-muted text-sm">{t('dashboard.noUpcomingEvents')}</p>
            </div>
          ) : (
            events.slice(0, 7).map((e: any) => (
              <EventRow key={e.id} event={e} large />
            ))
          )}
        </div>

        <Link to="/week"
          className="w-full py-3.5 text-base flex items-center justify-center gap-2 rounded-2xl font-black bg-gradient-to-r from-primary to-accent text-white shadow-raised active:scale-[.98] transition-transform"
        >
          🗓️ Můj týden
        </Link>

        <a
          href="/calendar?propose=1"
          className="btn-primary w-full py-3.5 text-base rounded-2xl"
        >
          ✋ {t('calendar.proposeEvent')}
        </a>
      </div>
    </div>
  );
}

function GuardianDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const from = new Date(); const to = addDays(new Date(), 14);
  const { data: events } = useEvents(from, to);

  return (
    <div className="space-y-4 pb-4">
      <WelcomeHero />

      <div className="px-4">
        <div className="card p-4">
          <h3 className="font-bold text-ink mb-3">{t('dashboard.upcomingEvents')}</h3>
          {!events?.length ? (
            <p className="text-ink-muted text-sm text-center py-3">{t('dashboard.noUpcomingEvents')}</p>
          ) : (
            events.slice(0, 8).map((e: any) => (
              <EventRow key={e.id} event={e} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function EventRow({ event, large = false }: { event: any; large?: boolean }) {
  const color = event.eventType?.color ?? event.colorOverride ?? '#a3a3a3';
  return (
    <Link
      to={`/event/${event.id}`}
      className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl border-b border-border/50 last:border-0 hover:bg-surface-raised active:bg-surface-overlay transition-colors group"
      style={{ borderLeftColor: color, borderLeftWidth: 3, borderLeftStyle: 'solid' }}
    >
      <span className={`shrink-0 ${large ? 'text-2xl' : 'text-xl'}`}>{event.eventType?.icon ?? '📌'}</span>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate text-ink ${large ? 'text-base' : 'text-sm'}`}>{event.title}</p>
        <p className="text-xs text-ink-muted">{formatRelativeDate(event.start)}{event.location ? ` · ${event.location}` : ''}</p>
      </div>
      <ChevronRight size={14} className="text-ink-faint shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
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
  const fridgeNotesEnabled = useFeatureFlag('fridge_notes');

  const dashboard = user?.role === 'KID'
    ? <KidDashboard />
    : user?.role === 'PARENT'
    ? <ParentDashboard />
    : <GuardianDashboard />;

  return (
    <div>
      <MotdBanner />
      {dashboard}
      {fridgeNotesEnabled && (
        <div className="px-4 pb-6 mt-4">
          <FridgeBoard />
        </div>
      )}
    </div>
  );
}

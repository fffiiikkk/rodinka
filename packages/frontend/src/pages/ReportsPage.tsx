import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../lib/api.js';
import { format, subDays } from 'date-fns';

function DateRangePicker({ from, to, onChange }: {
  from: Date; to: Date;
  onChange: (from: Date, to: Date) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="label">{t('reports.from')}</label>
        <input type="date" className="input" value={format(from, 'yyyy-MM-dd')}
          onChange={(e) => onChange(new Date(e.target.value), to)} />
      </div>
      <div className="flex-1">
        <label className="label">{t('reports.to')}</label>
        <input type="date" className="input" value={format(to, 'yyyy-MM-dd')}
          onChange={(e) => onChange(from, new Date(e.target.value))} />
      </div>
    </div>
  );
}

function ActivityReport() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(() => subDays(new Date(), 30));
  const [to, setTo] = useState(() => new Date());

  const { data } = useQuery({
    queryKey: ['reports', 'activity', from, to],
    queryFn: () => api.get<{ data: any[] }>(`/reports/activity?from=${from.toISOString()}&to=${to.toISOString()}`).then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      {data ? (
        <div className="space-y-3">
          {data.map((row: any) => (
            <div key={row.user.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold">{row.user.name}</span>
                <span className="text-xs text-ink-muted">{row.user.role}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div><span className="font-bold text-lg">{row.logins}</span><br />přihlášení</div>
                <div><span className="font-bold text-lg">{row.eventsCreated}</span><br />událostí</div>
                <div><span className="font-bold text-lg text-ink-muted">{row.lastLogin ? format(new Date(row.lastLogin), 'd.M.') : '—'}</span><br />naposledy</div>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="skeleton h-48 rounded-lg" />}
    </div>
  );
}

function CoverageReport() {
  const [from, setFrom] = useState(() => new Date());
  const [to, setTo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; });

  const { data } = useQuery({
    queryKey: ['reports', 'coverage', from, to],
    queryFn: () => api.get<{ gaps: any[] }>(`/reports/coverage-gaps?from=${from.toISOString()}&to=${to.toISOString()}`).then((r) => r.gaps),
  });

  return (
    <div className="space-y-4">
      <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      {data?.length === 0 && <p className="text-center text-success font-semibold py-8">Vše pokryto ✓</p>}
      {data?.map((gap: any) => (
        <div key={gap.date} className="card p-4 border-l-4 border-danger">
          <p className="font-bold">{format(new Date(gap.date), 'd. MMMM yyyy')}</p>
          {gap.events.map((e: any) => (
            <p key={e.id} className="text-sm text-ink-muted">{e.title} — {e.participantNames.join(', ')}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'activity' | 'coverage'>('activity');

  return (
    <div className="px-4 pb-8 pt-4">
      <h1 className="text-xl font-extrabold text-ink mb-4">{t('reports.title')}</h1>

      <div className="flex bg-surface-overlay rounded-lg p-0.5 gap-0.5 mb-6">
        {(['activity', 'coverage'] as const).map((t2) => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            className={`flex-1 py-2 text-sm font-semibold rounded transition-colors ${
              tab === t2 ? 'bg-surface text-primary shadow-card' : 'text-ink-muted'
            }`}
          >
            {t2 === 'activity' ? t('reports.activity') : t('reports.coverage')}
          </button>
        ))}
      </div>

      {tab === 'activity' ? <ActivityReport /> : <CoverageReport />}
    </div>
  );
}

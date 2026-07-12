import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useCreateEvent } from '../../hooks/useEvents.js';
import { useAuth } from '../../hooks/useAuth.js';
import { api } from '../../lib/api.js';
import { format, addMinutes } from 'date-fns';
import { Car } from 'lucide-react';
import type { EventType } from '@rodinkal/shared';
import { useToast } from '../ui/Toast.js';
import TimePicker from '../ui/TimePicker.js';
import DatePicker from '../ui/DatePicker.js';

type TransportMode = 'none' | 'user' | 'external' | 'self';

interface Props {
  onClose: () => void;
  defaultDate?: Date;
}

export default function EventForm({ onClose, defaultDate = new Date() }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const createEvent = useCreateEvent();

  const isKid = user?.role === 'KID';

  const { data: typesData } = useQuery({
    queryKey: ['event-types'],
    queryFn: () => api.get<{ types: EventType[] }>('/event-types').then((r) => r.types),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => api.get<{ items: any[] }>('/users?pageSize=100').then((r) => r.items),
    enabled: !isKid,
  });

  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [step, setStep] = useState<'type' | 'form'>('type');

  const defaultStart = new Date(defaultDate);
  defaultStart.setHours(17, 0, 0, 0);
  const defaultEnd = addMinutes(defaultStart, selectedType?.defaultDurationMinutes ?? 60);

  const [title, setTitle] = useState('');
  // Separate date and time fields for better mobile UX
  const [startDate, setStartDate] = useState(format(defaultStart, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(format(defaultStart, 'HH:mm'));
  const [endDate, setEndDate] = useState(format(defaultEnd, 'yyyy-MM-dd'));
  const [endTime, setEndTime] = useState(format(defaultEnd, 'HH:mm'));
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>(user ? [user.id] : []);
  const [submitting, setSubmitting] = useState(false);

  // Transport
  const [transportMode, setTransportMode] = useState<TransportMode>('none');
  const [transportUserId, setTransportUserId] = useState('');
  const [transportExternalName, setTransportExternalName] = useState('');
  const [transportNote, setTransportNote] = useState('');

  // Derived ISO strings for submission
  const startISO = `${startDate}T${startTime}`;
  const endISO = `${endDate}T${endTime}`;

  // Quick duration presets — recalculate end from current start
  const DURATIONS = [
    { label: '15m', minutes: 15 },
    { label: '30m', minutes: 30 },
    { label: '1h',  minutes: 60 },
    { label: '2h',  minutes: 120 },
    { label: '3h',  minutes: 180 },
  ];
  const applyDuration = (minutes: number) => {
    const base = new Date(`${startDate}T${startTime}`);
    const newEnd = addMinutes(base, minutes);
    setEndDate(format(newEnd, 'yyyy-MM-dd'));
    setEndTime(format(newEnd, 'HH:mm'));
  };

  // Group event types
  const groups = typesData ? groupBy(typesData, (t) => t.groupCs) : {};

  const selectType = (et: EventType) => {
    setSelectedType(et);
    if (!title) setTitle(et.nameCs);
    const newEnd = addMinutes(new Date(`${startDate}T${startTime}`), et.defaultDurationMinutes);
    setEndDate(format(newEnd, 'yyyy-MM-dd'));
    setEndTime(format(newEnd, 'HH:mm'));
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await createEvent.mutateAsync({
        title,
        description: description || undefined,
        eventTypeId: selectedType?.id,
        start: allDay ? new Date(startDate).toISOString() : new Date(startISO).toISOString(),
        end: allDay ? new Date(endDate).toISOString() : new Date(endISO).toISOString(),
        allDay,
        location: location || undefined,
        participantIds,
        transportUserId: transportMode === 'user' ? (transportUserId || undefined) :
                         transportMode === 'self' ? (participantIds[0] || undefined) : undefined,
        transportExternalName: transportMode === 'external' ? (transportExternalName || undefined) : undefined,
        transportNote: transportNote || undefined,
      });
      toast(isKid ? '✋ Návrh odeslán!' : '✅ Událost přidána!', 'success');
      onClose();
    } catch {
      toast(t('errors.generic'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'type') {
    return (
      <div className="p-4">
        <p className="text-sm text-ink-muted mb-4">{t('event.type')}:</p>
        {Object.entries(groups).map(([group, types]) => (
          <div key={group} className="mb-4">
            <p className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2">
              {t(`eventTypes.groups.${group}`, group)}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {types.map((et) => (
                <button
                  key={et.id}
                  onClick={() => selectType(et)}
                  className="flex flex-col items-center gap-1 p-3 bg-surface-raised rounded-xl border border-border hover:border-primary active:scale-95 transition-all text-center"
                >
                  <span className="text-2xl">{et.icon}</span>
                  <span className="text-xs font-semibold text-ink leading-tight">{et.nameCs}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() => setStep('form')}
          className="btn-ghost w-full mt-2"
        >
          Bez výběru typu →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {selectedType && (
        <button
          type="button"
          onClick={() => setStep('type')}
          className="flex items-center gap-2 text-sm text-primary"
        >
          ← <span className="text-xl">{selectedType.icon}</span> {selectedType.nameCs}
        </button>
      )}

      <div>
        <label className="label">{t('event.title')} *</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      {/* All-day toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="w-4 h-4 accent-primary" />
        <span className="text-sm font-medium text-ink">{t('event.allDay')}</span>
      </label>

      {/* Start date + time */}
      <div>
        <label className="label">{t('event.start')}</label>
        <div className={`grid gap-2 ${allDay ? '' : 'grid-cols-[1fr_auto]'}`}>
          <DatePicker
            value={startDate}
            onChange={(v) => {
              setStartDate(v);
              if (v > endDate) setEndDate(v);
            }}
          />
          {!allDay && (
            <TimePicker value={startTime} onChange={setStartTime} />
          )}
        </div>
      </div>

      {/* End date + time */}
      <div>
        <label className="label">{t('event.end')}</label>
        {!allDay && (
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {DURATIONS.map(({ label, minutes }) => (
              <button
                key={label}
                type="button"
                onClick={() => applyDuration(minutes)}
                className="px-3 py-1 rounded-full border border-border bg-surface-raised text-xs font-bold text-ink hover:bg-primary hover:text-white hover:border-primary active:scale-95 transition-all"
              >
                +{label}
              </button>
            ))}
          </div>
        )}
        <div className={`grid gap-2 ${allDay ? '' : 'grid-cols-[1fr_auto]'}`}>
          <DatePicker
            value={endDate}
            min={startDate}
            onChange={setEndDate}
          />
          {!allDay && (
            <TimePicker value={endTime} onChange={setEndTime} />
          )}
        </div>
      </div>

      <div>
        <label className="label">{t('event.location')}</label>
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Kde?" />
      </div>

      <div>
        <label className="label">{t('event.description')}</label>
        <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {!isKid && usersData && (
        <div>
          <label className="label">{t('event.participants')}</label>
          <div className="space-y-1">
            {usersData.filter((u: any) => u.isActive && u.role !== 'GUEST').map((u: any) => (
              <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={participantIds.includes(u.id)}
                  onChange={(e) => {
                    if (e.target.checked) setParticipantIds((p) => [...p, u.id]);
                    else setParticipantIds((p) => p.filter((id) => id !== u.id));
                  }}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm">{u.name}</span>
                <span className="text-xs text-ink-faint">{u.role}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Transport section — for non-allDay events */}
      {!allDay && (
        <div className="space-y-2">
          <label className="label flex items-center gap-1.5">
            <Car size={14} className="text-ink-muted" /> Doprava / zodpovědná osoba
            <span className="text-ink-faint text-xs">(nepovinné)</span>
          </label>

          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { id: 'none',     icon: '—',  label: 'Bez dopravy' },
              { id: 'user',     icon: '👤', label: 'Člen rodiny' },
              { id: 'external', icon: '🤝', label: 'Cizí osoba' },
              { id: 'self',     icon: '🚶', label: 'Samo dítě' },
            ] as { id: TransportMode; icon: string; label: string }[]).map(({ id, icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTransportMode(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                  transportMode === id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-ink-muted hover:border-primary/40'
                }`}
              >
                <span>{icon}</span> {label}
              </button>
            ))}
          </div>

          {/* Registered user picker */}
          {transportMode === 'user' && usersData && (
            <select
              className="input"
              value={transportUserId}
              onChange={(e) => setTransportUserId(e.target.value)}
            >
              <option value="">— vyber osobu —</option>
              {usersData
                .filter((u: any) => u.isActive)
                .map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
            </select>
          )}

          {/* External person name */}
          {transportMode === 'external' && (
            <input
              className="input"
              placeholder="Jméno osoby, např. Pavel Novák"
              value={transportExternalName}
              onChange={(e) => setTransportExternalName(e.target.value)}
            />
          )}

          {/* Self-transport note */}
          {transportMode === 'self' && (
            <input
              className="input"
              placeholder="Jak se dostane? např. jde pěšky, vlak 15:30…"
              value={transportNote}
              onChange={(e) => setTransportNote(e.target.value)}
            />
          )}

          {/* Optional note for user/external modes */}
          {(transportMode === 'user' || transportMode === 'external') && (
            <input
              className="input"
              placeholder="Poznámka k dopravě (nepovinné)…"
              value={transportNote}
              onChange={(e) => setTransportNote(e.target.value)}
            />
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
        <button type="submit" disabled={submitting} className="btn-primary flex-1">
          {submitting ? t('common.loading') : isKid ? t('calendar.proposeEvent') : t('common.save')}
        </button>
      </div>
    </form>
  );
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k]!.push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

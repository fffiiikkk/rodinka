import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useCreateEvent, useUpdateEvent } from '../../hooks/useEvents.js';
import { useAuth } from '../../hooks/useAuth.js';
import { api } from '../../lib/api.js';
import { format, addMinutes, differenceInMinutes } from 'date-fns';
import { Car, ChevronDown, ChevronRight, Plus, Trash2, Users } from 'lucide-react';
import type { Event, EventType } from '@rodinkal/shared';
import { useToast } from '../ui/Toast.js';
import TimePicker from '../ui/TimePicker.js';
import DatePicker from '../ui/DatePicker.js';
import RecurrenceEditor from './RecurrenceEditor.js';
import { UserPickerRow } from '../ui/UserPickerRow.js';

type TransportMode = 'none' | 'user' | 'external' | 'self';
type TransportDirection = 'BOTH' | 'THERE' | 'BACK';

interface OccurrenceSlot {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

interface Props {
  onClose: () => void;
  defaultDate?: Date;
  initialValues?: Event;
}

export default function EventForm({ onClose, defaultDate = new Date(), initialValues }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const isEdit = !!initialValues;
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

  const [selectedType, setSelectedType] = useState<EventType | null>(initialValues?.eventType ?? null);
  const [step, setStep] = useState<'type' | 'form'>(isEdit ? 'form' : 'type');

  const defaultStart = new Date(defaultDate);
  defaultStart.setHours(17, 0, 0, 0);
  const defaultEnd = addMinutes(defaultStart, selectedType?.defaultDurationMinutes ?? 60);

  // Main occurrence
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [startDate, setStartDate] = useState(
    initialValues ? format(new Date(initialValues.start), 'yyyy-MM-dd') : format(defaultStart, 'yyyy-MM-dd'),
  );
  const [startTime, setStartTime] = useState(
    initialValues ? format(new Date(initialValues.start), 'HH:mm') : format(defaultStart, 'HH:mm'),
  );
  const [endDate, setEndDate] = useState(
    initialValues ? format(new Date(initialValues.end), 'yyyy-MM-dd') : format(defaultEnd, 'yyyy-MM-dd'),
  );
  const [endTime, setEndTime] = useState(
    initialValues ? format(new Date(initialValues.end), 'HH:mm') : format(defaultEnd, 'HH:mm'),
  );
  const [location, setLocation] = useState(initialValues?.location ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [allDay, setAllDay] = useState(initialValues?.allDay ?? false);
  const [participantIds, setParticipantIds] = useState<string[]>(
    initialValues ? initialValues.participants.map((p) => p.userId) : (user ? [user.id] : []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(initialValues?.recurrenceRule ?? null);

  // Collapsible sections
  const [showParticipants, setShowParticipants] = useState(false);
  const [showTransport, setShowTransport] = useState(false);
  const [showDescription, setShowDescription] = useState(!!initialValues?.description || !!initialValues?.location);

  // Extra occurrences (new events with different date/times, same metadata)
  const [extraOccurrences, setExtraOccurrences] = useState<OccurrenceSlot[]>([]);

  // Transport
  const initTransportMode = (): TransportMode => {
    if (!initialValues?.transport) return 'none';
    if (initialValues.transport.externalName) return 'external';
    if (initialValues.transport.userRole === 'KID') return 'self';
    if (initialValues.transport.userId) return 'user';
    return 'none';
  };
  const [transportMode, setTransportMode] = useState<TransportMode>(initTransportMode);
  const [transportUserId, setTransportUserId] = useState(initialValues?.transport?.userId ?? '');
  const [transportExternalName, setTransportExternalName] = useState(initialValues?.transport?.externalName ?? '');
  const [transportNote, setTransportNote] = useState(initialValues?.transport?.note ?? '');
  const [transportDirection, setTransportDirection] = useState<TransportDirection>(
    (initialValues?.transport?.direction as TransportDirection | null) ?? 'BOTH',
  );
  // null = není nutné (default), true = zajistí, false = nezajistí
  const [transportCoversSupervision, setTransportCoversSupervision] = useState<boolean | null>(
    initialValues?.transport?.coversSupervision ?? null,
  );

  const startISO = `${startDate}T${startTime}`;
  const endISO = `${endDate}T${endTime}`;

  // Determine if all selected participants are adults (non-KID) — transport is optional in that case
  const selectedParticipantRoles = usersData
    ? participantIds.map((id) => usersData.find((u: any) => u.id === id)?.role ?? 'PARENT')
    : [];
  const allParticipantsAdult = selectedParticipantRoles.length > 0
    && selectedParticipantRoles.every((r) => r !== 'KID');

  const DURATIONS = [
    { label: '15m', minutes: 15 },
    { label: '30m', minutes: 30 },
    { label: '1h',  minutes: 60 },
    { label: '1.5h', minutes: 90 },
    { label: '2h',  minutes: 120 },
    { label: '3h',  minutes: 180 },
  ];

  const applyDuration = (minutes: number) => {
    const base = new Date(`${startDate}T${startTime}`);
    const newEnd = addMinutes(base, minutes);
    setEndDate(format(newEnd, 'yyyy-MM-dd'));
    setEndTime(format(newEnd, 'HH:mm'));
  };

  const groups = typesData ? groupBy(typesData, (t) => t.groupCs) : {};

  const selectType = (et: EventType) => {
    setSelectedType(et);
    if (!title) setTitle(et.nameCs);
    const newEnd = addMinutes(new Date(`${startDate}T${startTime}`), et.defaultDurationMinutes);
    setEndDate(format(newEnd, 'yyyy-MM-dd'));
    setEndTime(format(newEnd, 'HH:mm'));
    setStep('form');
  };

  // Add an extra occurrence — defaults to next day, same time
  const addOccurrence = () => {
    const nextDate = format(addMinutes(new Date(`${startDate}T${startTime}`), 24 * 60), 'yyyy-MM-dd');
    setExtraOccurrences((prev) => [
      ...prev,
      { startDate: nextDate, startTime, endDate: nextDate, endTime },
    ]);
  };

  const removeOccurrence = (idx: number) => {
    setExtraOccurrences((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateOccurrence = (idx: number, field: keyof OccurrenceSlot, value: string) => {
    setExtraOccurrences((prev) =>
      prev.map((occ, i) => {
        if (i !== idx) return occ;
        const updated = { ...occ, [field]: value };
        // If changing startDate and endDate was same as old startDate, keep them in sync
        if (field === 'startDate' && occ.startDate === occ.endDate) {
          updated.endDate = value;
        }
        return updated;
      }),
    );
  };

  const buildPayload = (overrideStart?: string, overrideEnd?: string) => ({
    title,
    description: description || undefined,
    eventTypeId: selectedType?.id,
    start: allDay
      ? new Date(overrideStart ?? startDate).toISOString()
      : new Date(overrideStart ?? startISO).toISOString(),
    end: allDay
      ? new Date(overrideEnd ?? endDate).toISOString()
      : new Date(overrideEnd ?? endISO).toISOString(),
    allDay,
    location: location || undefined,
    recurrenceRule: recurrenceRule || undefined,
    participantIds,
    transportUserId: transportMode === 'user' ? (transportUserId || undefined) :
                     transportMode === 'self' ? (participantIds[0] || undefined) : undefined,
    transportExternalName: transportMode === 'external' ? (transportExternalName || undefined) : undefined,
    transportNote: transportNote || undefined,
    transportDirection: transportMode !== 'none' ? transportDirection : undefined,
    transportCoversSupervision: transportMode !== 'none' ? (transportCoversSupervision ?? undefined) : undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (isEdit) {
        await updateEvent.mutateAsync({ id: initialValues!.id, data: buildPayload() });
        toast('✅ Událost uložena!', 'success');
      } else {
        // Create main + any extra occurrences
        const allSlots: OccurrenceSlot[] = [
          { startDate, startTime, endDate, endTime },
          ...extraOccurrences,
        ];
        for (const slot of allSlots) {
          await createEvent.mutateAsync(
            buildPayload(`${slot.startDate}T${slot.startTime}`, `${slot.endDate}T${slot.endTime}`),
          );
        }
        const count = allSlots.length;
        toast(
          isKid
            ? `✋ Návrh odeslán!`
            : count > 1 ? `✅ ${count} události přidány!` : '✅ Událost přidána!',
          'success',
        );
      }
      onClose();
    } catch {
      toast(t('errors.generic'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 1: type selection ────────────────────────────────────────────────

  if (step === 'type') {
    return (
      <div className="p-3">
        <p className="text-xs text-ink-muted mb-3">{t('event.type')}:</p>
        {Object.entries(groups).map(([group, types]) => (
          <div key={group} className="mb-3">
            <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wide mb-1.5">
              {t(`eventTypes.groups.${group}`, group)}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {types.map((et) => (
                <button
                  key={et.id}
                  onClick={() => selectType(et)}
                  className="flex flex-col items-center gap-0.5 p-2 bg-surface-raised rounded-xl border border-border hover:border-primary active:scale-95 transition-all text-center"
                >
                  <span className="text-xl">{et.icon}</span>
                  <span className="text-[10px] font-semibold text-ink leading-tight">{et.nameCs}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={() => setStep('form')} className="btn-ghost w-full mt-1 text-sm">
          Bez výběru typu →
        </button>
      </div>
    );
  }

  // ─── Step 2: main form ─────────────────────────────────────────────────────

  const durationMins = !allDay
    ? differenceInMinutes(new Date(endISO), new Date(startISO))
    : null;

  const participantCount = participantIds.length;
  const transportActive = transportMode !== 'none';

  return (
    <form onSubmit={handleSubmit} className="p-3 space-y-3">
      {/* Type breadcrumb */}
      {selectedType && (
        <button
          type="button"
          onClick={() => setStep('type')}
          className="flex items-center gap-1.5 text-xs text-primary font-semibold"
        >
          ← <span className="text-lg">{selectedType.icon}</span>
          <span>{selectedType.nameCs}</span>
        </button>
      )}

      {/* Title row */}
      <div className="flex gap-2 items-center">
        <input
          className="input flex-1 text-sm"
          placeholder={`${t('event.title')} *`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <label className="flex items-center gap-1 shrink-0 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="w-3.5 h-3.5 accent-primary"
          />
          <span className="text-xs font-medium text-ink-muted whitespace-nowrap">Celý den</span>
        </label>
      </div>

      {/* ── Date / time block ─────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface-raised/60 p-2.5 space-y-2">

        {/* Main occurrence */}
        <div className="space-y-1.5">
          {/* Start row */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wide w-10 shrink-0">Od</span>
            <DatePicker
              value={startDate}
              onChange={(v) => {
                setStartDate(v);
                if (v > endDate) setEndDate(v);
              }}
            />
            {!allDay && <TimePicker value={startTime} onChange={setStartTime} />}
          </div>

          {/* End row */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wide w-10 shrink-0">Do</span>
            <DatePicker value={endDate} min={startDate} onChange={setEndDate} />
            {!allDay && <TimePicker value={endTime} onChange={setEndTime} />}
          </div>

          {/* Duration presets + badge */}
          {!allDay && (
            <div className="flex items-center gap-1 flex-wrap pl-11">
              {durationMins !== null && durationMins > 0 && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full mr-1">
                  {durationMins >= 60
                    ? `${Math.floor(durationMins / 60)}h${durationMins % 60 ? ` ${durationMins % 60}m` : ''}`
                    : `${durationMins}m`}
                </span>
              )}
              {DURATIONS.map(({ label, minutes }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => applyDuration(minutes)}
                  className="px-2 py-0.5 rounded-full border border-border bg-surface text-[10px] font-bold text-ink-muted hover:bg-primary hover:text-white hover:border-primary active:scale-95 transition-all"
                >
                  +{label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Extra occurrences */}
        {extraOccurrences.map((occ, i) => (
          <div key={i} className="border-t border-border/60 pt-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wide w-10 shrink-0">
                #{i + 2}
              </span>
              <DatePicker
                value={occ.startDate}
                onChange={(v) => updateOccurrence(i, 'startDate', v)}
              />
              {!allDay && (
                <TimePicker
                  value={occ.startTime}
                  onChange={(v) => updateOccurrence(i, 'startTime', v)}
                />
              )}
              <button
                type="button"
                onClick={() => removeOccurrence(i)}
                className="ml-auto p-1 text-ink-faint hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                title="Odebrat výskyt"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wide w-10 shrink-0">do</span>
              <DatePicker
                value={occ.endDate}
                min={occ.startDate}
                onChange={(v) => updateOccurrence(i, 'endDate', v)}
              />
              {!allDay && (
                <TimePicker
                  value={occ.endTime}
                  onChange={(v) => updateOccurrence(i, 'endTime', v)}
                />
              )}
            </div>
          </div>
        ))}

        {/* Add occurrence — only in create mode */}
        {!isEdit && (
          <button
            type="button"
            onClick={addOccurrence}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-primary border border-dashed border-primary/40 rounded-lg py-1.5 hover:bg-primary/5 active:scale-98 transition-all mt-1"
          >
            <Plus size={12} />
            Přidat výskyt
          </button>
        )}
      </div>

      {/* Recurrence — hide for kids */}
      {!isKid && (
        <RecurrenceEditor value={recurrenceRule} onChange={setRecurrenceRule} startDate={startDate} />
      )}

      {/* ── Collapsible extras ─────────────────────────────────── */}

      {/* Location + Description toggle */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowDescription((v) => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink transition-colors w-full"
        >
          {showDescription ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span>📍 Místo a popis</span>
          {(location || description) && (
            <span className="ml-auto text-[10px] text-primary font-bold">vyplněno</span>
          )}
        </button>
        {showDescription && (
          <div className="space-y-2 pl-4">
            <input
              className="input text-sm"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Kde? (místo, adresa…)"
            />
            <textarea
              className="input text-sm"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Popis, poznámka…"
            />
          </div>
        )}
      </div>

      {/* Participants toggle */}
      {!isKid && usersData && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowParticipants((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink transition-colors w-full"
          >
            {showParticipants ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <Users size={13} />
            <span>Účastníci</span>
            {participantCount > 0 && (
              <span className="ml-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                {participantCount}
              </span>
            )}
          </button>
          {showParticipants && (
            <div className="pl-4 grid grid-cols-2 gap-1">
              {usersData.filter((u: any) => u.isActive && u.role !== 'GUEST').map((u: any) => (
                <label key={u.id} className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-surface-raised transition-colors">
                  <input
                    type="checkbox"
                    checked={participantIds.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) setParticipantIds((p) => [...p, u.id]);
                      else setParticipantIds((p) => p.filter((id) => id !== u.id));
                    }}
                    className="w-3.5 h-3.5 accent-primary shrink-0"
                  />
                  <UserPickerRow u={u} />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transport toggle */}
      {!allDay && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowTransport((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink transition-colors w-full"
          >
            {showTransport ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <Car size={13} />
            <span>Doprava / zodpovědná osoba</span>
            {allParticipantsAdult && transportMode === 'none' && (
              <span className="ml-auto text-[10px] text-ink-faint italic">dospělí se odvezou sami</span>
            )}
            {transportActive && (
              <span className="ml-auto text-[10px] text-primary font-bold">nastaveno</span>
            )}
          </button>

          {showTransport && (
            <div className="pl-4 space-y-2">
              {/* Hint for adult-only events */}
              {allParticipantsAdult && (
                <p className="text-[11px] text-ink-faint bg-surface-raised rounded-lg px-2.5 py-1.5 border border-border">
                  💡 Pouze dospělí účastníci — doprava není nutná. Vyplň jen pokud je třeba koordinovat odvoz.
                </p>
              )}
              <div className="grid grid-cols-2 gap-1">
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
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      transportMode === id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-ink-muted hover:border-primary/40'
                    }`}
                  >
                    <span>{icon}</span> {label}
                  </button>
                ))}
              </div>
              {transportMode === 'user' && usersData && (
                <div className="space-y-0.5 rounded-xl border border-border overflow-hidden">
                  {usersData.filter((u: any) => u.isActive).map((u: any) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setTransportUserId(u.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                        transportUserId === u.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-surface-raised text-ink'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${transportUserId === u.id ? 'bg-primary' : 'bg-border'}`} />
                      <UserPickerRow u={u} />
                    </button>
                  ))}
                </div>
              )}
              {transportMode === 'external' && (
                <input className="input text-sm" placeholder="Jméno osoby…" value={transportExternalName} onChange={(e) => setTransportExternalName(e.target.value)} />
              )}
              {(transportMode === 'self' || transportMode === 'user' || transportMode === 'external') && (
                <>
                  <input className="input text-sm" placeholder="Poznámka k dopravě…" value={transportNote} onChange={(e) => setTransportNote(e.target.value)} />

                  {/* Direction: which way does the transport cover? */}
                  <div>
                    <label className="label text-[10px]">Směr dopravy</label>
                    <div className="flex gap-1">
                      {([
                        { id: 'BOTH',  label: '↔ Tam i zpět' },
                        { id: 'THERE', label: '→ Jen tam' },
                        { id: 'BACK',  label: '← Jen zpět' },
                      ] as { id: TransportDirection; label: string }[]).map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setTransportDirection(id)}
                          className={`flex-1 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                            transportDirection === id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-ink-muted hover:border-primary/40'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Supervision: does the transport person also cover supervision? */}
                  {!allParticipantsAdult && (
                    <div>
                      <label className="label text-[10px]">Hlídání při aktivitě</label>
                      <div className="flex gap-1">
                        {([
                          { value: null,  label: '—  Není nutné', color: 'text-ink-muted' },
                          { value: true,  label: '✅ Zajistí',     color: 'text-emerald-600' },
                          { value: false, label: '❌ Nezajistí',  color: 'text-red-500' },
                        ] as { value: boolean | null; label: string; color: string }[]).map(({ value, label, color }) => (
                          <button
                            key={String(value)}
                            type="button"
                            onClick={() => setTransportCoversSupervision(value)}
                            className={`flex-1 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                              transportCoversSupervision === value
                                ? `border-primary bg-primary/10 text-primary`
                                : `border-border ${color} hover:border-primary/40`
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-border">
        <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm py-2">
          {t('common.cancel')}
        </button>
        <button type="submit" disabled={submitting} className="btn-primary flex-1 text-sm py-2">
          {submitting
            ? t('common.loading')
            : isKid
              ? t('calendar.proposeEvent')
              : isEdit
                ? t('common.save')
                : extraOccurrences.length > 0
                  ? `${t('common.save')} (${extraOccurrences.length + 1}×)`
                  : t('common.save')}
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

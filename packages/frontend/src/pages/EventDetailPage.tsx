import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Calendar, Users, Paperclip, ChevronLeft, Check, X, Car, Pencil, Loader2, Copy } from 'lucide-react';
import { useEvent, useApproveEvent, useRejectEvent, useCancelEvent, useCreateEvent } from '../hooks/useEvents.js';
import { useAuth } from '../hooks/useAuth.js';
import { formatDateTime } from '../lib/dates.js';
import { useToast } from '../components/ui/Toast.js';
import Avatar from '../components/ui/Avatar.js';
import Sheet from '../components/ui/Sheet.js';
import EventForm from '../components/events/EventForm.js';
import DatePicker from '../components/ui/DatePicker.js';
import { format } from 'date-fns';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: event, isLoading, error } = useEvent(id!);
  const approve = useApproveEvent();
  const reject = useRejectEvent();
  const cancel = useCancelEvent();
  const createEvent = useCreateEvent();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copyDate, setCopyDate] = useState('');
  const [copying, setCopying] = useState(false);

  if (isLoading) return (
    <div className="p-3 space-y-2">
      {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
    </div>
  );

  if (error || !event) return (
    <div className="p-8 text-center text-ink-muted">{t('errors.notFound')}</div>
  );

  const isAdmin = user?.role === 'PARENT';
  const color = event.eventType?.color ?? event.colorOverride ?? '#a3a3a3';

  const handleCopy = async () => {
    if (!copyDate || !event) return;
    setCopying(true);
    try {
      const origStart = new Date(event.start);
      const origEnd = new Date(event.end);
      const durationMs = origEnd.getTime() - origStart.getTime();
      const newStart = new Date(`${copyDate}T${format(origStart, 'HH:mm')}`);
      const newEnd = new Date(newStart.getTime() + durationMs);
      await createEvent.mutateAsync({
        title: event.title,
        description: event.description ?? undefined,
        eventTypeId: event.eventType?.id,
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
        allDay: event.allDay,
        location: event.location ?? undefined,
        participantIds: event.participants.map((p) => p.userId),
        transportUserId: event.transport?.userId ?? undefined,
        transportExternalName: event.transport?.externalName ?? undefined,
        transportNote: event.transport?.note ?? undefined,
      } as any);
      toast('✅ Událost zkopírována!', 'success');
      setShowCopy(false);
    } catch {
      toast(t('errors.generic'), 'error');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="pb-8">
      {/* ── Compact header ─────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-1.5 text-ink-muted hover:text-ink rounded-lg">
          <ChevronLeft size={20} />
        </button>
        {/* Colour strip + icon */}
        <div
          className="w-1 self-stretch rounded-full shrink-0"
          style={{ background: color }}
        />
        <span className="text-2xl leading-none">{event.eventType?.icon ?? '📌'}</span>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-extrabold text-ink leading-tight truncate">{event.title}</h1>
          {event.eventType && (
            <p className="text-[11px] text-ink-muted leading-none mt-0.5">{event.eventType.nameCs}</p>
          )}
        </div>
        {event.status !== 'APPROVED' && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
            event.status === 'PROPOSED' ? 'bg-warning/15 text-warning' : 'bg-danger/15 text-danger'
          }`}>
            {t(`event.status.${event.status}`)}
          </span>
        )}
      </div>

      {/* ── Detail card (all rows in one card with dividers) ────────── */}
      <div className="mx-3 rounded-xl border border-border bg-surface-raised overflow-hidden divide-y divide-border">

        {/* Date / time */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <Calendar size={15} className="text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink leading-snug">{formatDateTime(event.start)}</p>
            {event.end !== event.start && (
              <p className="text-xs text-ink-muted">→ {formatDateTime(event.end)}</p>
            )}
            {event.allDay && <p className="text-xs text-ink-muted">{t('calendar.allDay')}</p>}
          </div>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <MapPin size={15} className="text-primary shrink-0" />
            <p className="text-sm text-ink truncate">{event.location}</p>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="px-3 py-2.5">
            <p className="text-sm text-ink whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {/* Transport */}
        {event.transport && (
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <Car size={15} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wide">Doprava</p>
              {event.transport.externalName ? (
                <p className="text-sm font-semibold text-ink">🤝 {event.transport.externalName}</p>
              ) : event.transport.userName && event.transport.userRole === 'KID' ? (
                <p className="text-sm font-semibold text-ink">
                  🚶 {event.transport.userName} <span className="text-ink-muted font-normal text-xs">samo</span>
                </p>
              ) : event.transport.userName ? (
                <p className="text-sm font-semibold text-ink">🚗 {event.transport.userName}</p>
              ) : null}
              {event.transport.note && (
                <p className="text-xs text-ink-muted">{event.transport.note}</p>
              )}
            </div>
          </div>
        )}

        {/* Participants */}
        {event.participants.length > 0 && (
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <Users size={15} className="text-primary shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              {event.participants.map((p) => (
                <div key={p.userId} className="flex items-center gap-1 bg-surface-overlay rounded-full px-2 py-0.5">
                  <Avatar name={p.name} photoUrl={p.photoUrl} size="xs" />
                  <span className="text-xs font-medium text-ink">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        {event.attachments.length > 0 && (
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <Paperclip size={14} className="text-primary" />
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wide">{t('event.attachments')}</span>
            </div>
            <div className="space-y-1.5">
              {event.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.downloadUrl}
                  className="flex items-center gap-2.5 p-2 bg-surface-overlay rounded-lg"
                  target="_blank"
                  rel="noreferrer"
                >
                  {att.thumbnailUrl && (
                    <img src={att.thumbnailUrl} className="w-10 h-10 rounded object-cover shrink-0" alt="" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{att.fileName}</p>
                    <p className="text-[10px] text-ink-muted">{(att.size / 1024).toFixed(0)} KB</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Admin actions ───────────────────────────────────────────── */}
      {isAdmin && (
        <div className="mx-3 mt-3 space-y-2">

          {/* Propose approve/reject */}
          {event.status === 'PROPOSED' && (
            <div className="flex gap-2">
              <button
                disabled={approve.isPending || reject.isPending}
                onClick={() => approve.mutate(event.id, {
                  onSuccess: () => toast('Schváleno!', 'success'),
                  onError: () => toast('Chyba při schvalování', 'error'),
                })}
                className="flex-1 btn-primary flex items-center justify-center gap-1.5 py-2.5 disabled:opacity-60 text-sm"
              >
                {approve.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Schválit
              </button>
              <button
                disabled={approve.isPending || reject.isPending}
                onClick={() => reject.mutate(event.id, {
                  onSuccess: () => { toast('Zamítnuto', 'info'); navigate(-1); },
                  onError: () => toast('Chyba při zamítnutí', 'error'),
                })}
                className="flex-1 btn-secondary flex items-center justify-center gap-1.5 py-2.5 disabled:opacity-60 text-sm"
              >
                {reject.isPending ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                Zamítnout
              </button>
            </div>
          )}

          {/* Edit + Copy row */}
          {!event.isHoliday && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowEdit(true)}
                className="flex-1 flex items-center justify-center gap-1.5 border border-border text-sm font-semibold py-2.5 rounded-xl hover:bg-surface-overlay transition-colors text-ink"
              >
                <Pencil size={14} /> Upravit
              </button>
              <button
                onClick={() => { setCopyDate(format(new Date(event.start), 'yyyy-MM-dd')); setShowCopy(true); }}
                className="flex-1 flex items-center justify-center gap-1.5 border border-border text-sm font-semibold py-2.5 rounded-xl hover:bg-surface-overlay transition-colors text-ink"
              >
                <Copy size={14} /> Zkopírovat
              </button>
            </div>
          )}

          {/* Cancel */}
          {event.status === 'APPROVED' && !event.isHoliday && (
            !confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full text-danger border border-danger/30 text-sm font-semibold py-2.5 rounded-xl hover:bg-danger/5 transition-colors"
              >
                Zrušit událost
              </button>
            ) : (
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 space-y-2">
                <p className="text-sm font-medium text-center text-ink">Opravdu zrušit tuto událost?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 py-2 text-sm">Ne</button>
                  <button
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(event.id, {
                      onSuccess: () => { toast('Zrušeno', 'info'); navigate(-1); },
                      onError: () => toast('Chyba při rušení', 'error'),
                    })}
                    className="flex-1 bg-danger text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {cancel.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                    Ano, zrušit
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* ── Edit Sheet ──────────────────────────────────────────────── */}
      <Sheet open={showEdit} onClose={() => setShowEdit(false)} title="Upravit událost" fullScreen>
        <EventForm onClose={() => setShowEdit(false)} initialValues={event} />
      </Sheet>

      {/* ── Copy Sheet ──────────────────────────────────────────────── */}
      <Sheet open={showCopy} onClose={() => setShowCopy(false)} title="Zkopírovat na jiný den">
        <div className="p-3 space-y-3">
          <p className="text-sm text-ink-muted">
            Nová kopie <strong className="text-ink">{event.title}</strong> na zvolený den — stejný čas a trvání.
          </p>
          <DatePicker value={copyDate} onChange={setCopyDate} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowCopy(false)} className="btn-secondary flex-1 py-2.5 text-sm">
              Zrušit
            </button>
            <button
              type="button"
              disabled={!copyDate || copying}
              onClick={handleCopy}
              className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {copying ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
              Zkopírovat
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

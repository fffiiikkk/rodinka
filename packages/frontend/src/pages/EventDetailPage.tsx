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
import { format, differenceInMinutes, addMinutes } from 'date-fns';

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
    <div className="p-4 space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
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
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-ink-muted hover:text-ink mt-1">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xl">{event.eventType?.icon ?? '📌'}</span>
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ background: color }}
            />
          </div>
          <h1 className="text-2xl font-extrabold text-ink">{event.title}</h1>
          {event.eventType && (
            <p className="text-sm text-ink-muted">{event.eventType.nameCs}</p>
          )}
        </div>
      </div>

      {/* Status badge */}
      {event.status !== 'APPROVED' && (
        <div className="mx-4 mb-3">
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
            event.status === 'PROPOSED' ? 'bg-warning/15 text-warning' : 'bg-danger/15 text-danger'
          }`}>
            {t(`event.status.${event.status}`)}
          </span>
        </div>
      )}

      <div className="px-4 space-y-4">
        {/* Date/time */}
        <div className="card p-4 flex items-start gap-3">
          <Calendar size={20} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-ink">{formatDateTime(event.start)}</p>
            {event.end !== event.start && (
              <p className="text-sm text-ink-muted">→ {formatDateTime(event.end)}</p>
            )}
            {event.allDay && <p className="text-sm text-ink-muted">{t('calendar.allDay')}</p>}
          </div>
        </div>

        {/* Location */}
        {event.location && (
          <div className="card p-4 flex items-start gap-3">
            <MapPin size={20} className="text-primary shrink-0 mt-0.5" />
            <p className="text-ink">{event.location}</p>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="card p-4">
            <p className="text-ink whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {/* Transport */}
        {event.transport && (
          <div className="card p-4 flex items-start gap-3">
            <Car size={20} className="text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">Doprava</p>
              {event.transport.externalName ? (
                <p className="font-semibold text-ink">🤝 {event.transport.externalName}</p>
              ) : event.transport.userName && event.transport.userRole === 'KID' ? (
                <p className="font-semibold text-ink">🚶 {event.transport.userName} <span className="text-ink-muted font-normal text-sm">(jde/jede samo)</span></p>
              ) : event.transport.userName ? (
                <p className="font-semibold text-ink">🚗 {event.transport.userName}</p>
              ) : null}
              {event.transport.note && (
                <p className="text-sm text-ink-muted mt-0.5">{event.transport.note}</p>
              )}
            </div>
          </div>
        )}

        {/* Participants */}
        {event.participants.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-primary" />
              <h3 className="font-semibold text-ink">{t('event.participants')}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {event.participants.map((p) => (
                <div key={p.userId} className="flex items-center gap-1.5 bg-surface-overlay rounded-full px-2 py-1">
                  <Avatar name={p.name} photoUrl={p.photoUrl} size="xs" />
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        {event.attachments.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Paperclip size={18} className="text-primary" />
              <h3 className="font-semibold text-ink">{t('event.attachments')}</h3>
            </div>
            <div className="space-y-2">
              {event.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.downloadUrl}
                  className="flex items-center gap-3 p-2 bg-surface-overlay rounded-lg"
                  target="_blank"
                  rel="noreferrer"
                >
                  {att.thumbnailUrl && (
                    <img src={att.thumbnailUrl} className="w-12 h-12 rounded object-cover" alt="" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-ink">{att.fileName}</p>
                    <p className="text-xs text-ink-muted">{(att.size / 1024).toFixed(0)} KB</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Admin actions */}
        {isAdmin && (
          <div className="space-y-2">
            {event.status === 'PROPOSED' && (
              <div className="flex gap-3">
                <button
                  disabled={approve.isPending || reject.isPending}
                  onClick={() => approve.mutate(event.id, {
                    onSuccess: () => toast('Schváleno!', 'success'),
                    onError: () => toast('Chyba při schvalování', 'error'),
                  })}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-60"
                >
                  {approve.isPending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  Schválit
                </button>
                <button
                  disabled={approve.isPending || reject.isPending}
                  onClick={() => reject.mutate(event.id, {
                    onSuccess: () => { toast('Zamítnuto', 'info'); navigate(-1); },
                    onError: () => toast('Chyba při zamítnutí', 'error'),
                  })}
                  className="flex-1 btn-secondary flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-60"
                >
                  {reject.isPending ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                  Zamítnout
                </button>
              </div>
            )}

            {/* Edit button — always visible for admin on non-holiday events */}
            {!event.isHoliday && (
              <button
                onClick={() => setShowEdit(true)}
                className="w-full flex items-center justify-center gap-2 border border-border font-semibold py-3 rounded-xl hover:bg-surface-overlay transition-colors text-ink"
              >
                <Pencil size={16} /> Upravit událost
              </button>
            )}

            {/* Copy to another date */}
            {!event.isHoliday && (
              <button
                onClick={() => { setCopyDate(format(new Date(event.start), 'yyyy-MM-dd')); setShowCopy(true); }}
                className="w-full flex items-center justify-center gap-2 border border-border font-semibold py-3 rounded-xl hover:bg-surface-overlay transition-colors text-ink"
              >
                <Copy size={16} /> Zkopírovat na jiný den
              </button>
            )}

            {event.status === 'APPROVED' && !event.isHoliday && (
              !confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)}
                  className="w-full text-danger border border-danger/30 font-semibold py-3 rounded-xl hover:bg-danger/5 transition-colors">
                  Zrušit událost
                </button>
              ) : (
                <div className="card p-4 border-danger/30 space-y-2">
                  <p className="text-sm font-medium text-center">Opravdu zrušit tuto událost?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 min-h-[44px]">Ne</button>
                    <button
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(event.id, {
                        onSuccess: () => { toast('Zrušeno', 'info'); navigate(-1); },
                        onError: () => toast('Chyba při rušení', 'error'),
                      })}
                      className="flex-1 bg-danger text-white font-semibold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {cancel.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                      Ano, zrušit
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Edit Sheet */}
      <Sheet open={showEdit} onClose={() => setShowEdit(false)} title="Upravit událost" fullScreen>
        <EventForm
          onClose={() => setShowEdit(false)}
          initialValues={event}
        />
      </Sheet>

      {/* Copy to another date Sheet */}
      <Sheet open={showCopy} onClose={() => setShowCopy(false)} title="Zkopírovat na jiný den">
        <div className="p-4 space-y-4">
          <p className="text-sm text-ink-muted">
            Vytvoří novou kopii události <strong className="text-ink">{event.title}</strong> na zvolený den.
            Čas a trvání zůstanou stejné.
          </p>
          <div>
            <label className="label text-xs">Nový datum</label>
            <DatePicker
              value={copyDate}
              onChange={setCopyDate}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCopy(false)}
              className="btn-secondary flex-1 py-2.5"
            >
              Zrušit
            </button>
            <button
              type="button"
              disabled={!copyDate || copying}
              onClick={handleCopy}
              className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {copying ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
              Zkopírovat
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

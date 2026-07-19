import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Calendar, Users, Paperclip, ChevronLeft, Check, X, Car, Pencil, Loader2, Copy, RefreshCw, Video, ExternalLink } from 'lucide-react';
import { useEvent, useApproveEvent, useRejectEvent, useCancelEvent, useCreateEvent, useCancelOccurrence } from '../hooks/useEvents.js';
import { useAuth } from '../hooks/useAuth.js';
import { formatDateTime } from '../lib/dates.js';
import { useToast } from '../components/ui/Toast.js';
import Avatar from '../components/ui/Avatar.js';
import Sheet from '../components/ui/Sheet.js';
import EventForm from '../components/events/EventForm.js';
import DatePicker from '../components/ui/DatePicker.js';
import LocationMap from '../components/ui/LocationMap.js';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { formatTransportLabel } from '../lib/transportLabel.js';

function CoordinatesRow({ lat, lng }: { lat: number; lng: number }) {
  const { toast } = useToast();
  const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('📍 Souřadnice zkopírovány', 'success');
    } catch {
      toast('❌ Kopírování selhalo', 'error');
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2 px-1">
      <span className="text-[11px] font-mono text-ink-muted flex-1">{text}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1 text-[11px] text-primary hover:underline"
        title="Kopírovat souřadnice"
      >
        <Copy size={11} /> Kopírovat
      </button>
    </div>
  );
}

const MEETING_LABELS: Record<string, string> = {
  GOOGLE_MEET: 'Google Meet',
  TEAMS: 'Microsoft Teams',
  ZOOM: 'Zoom',
  OTHER: 'Online schůzka',
};
const MEETING_COLORS: Record<string, string> = {
  GOOGLE_MEET: '#00897b',
  TEAMS: '#6264a7',
  ZOOM: '#2d8cff',
  OTHER: '#64748b',
};

/** Dialog that asks whether to apply an action to one occurrence or the whole series */
function OccurrenceChoiceDialog({
  action,
  onOccurrence,
  onSeries,
  onCancel,
}: {
  action: 'edit' | 'delete';
  onOccurrence: () => void;
  onSeries: () => void;
  onCancel: () => void;
}) {
  const isEdit = action === 'edit';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-full max-w-sm bg-surface rounded-t-2xl shadow-2xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw size={18} className="text-primary" />
          <h3 className="font-bold text-ink text-base">Opakující se událost</h3>
        </div>
        <p className="text-sm text-ink-muted">
          {isEdit
            ? 'Chcete upravit pouze tuto instanci, nebo celou sérii?'
            : 'Chcete zrušit pouze tuto instanci, nebo celou sérii?'}
        </p>
        <div className="space-y-2 pt-1">
          <button
            onClick={onOccurrence}
            className="w-full py-3 rounded-xl border-2 border-primary bg-primary/8 text-primary font-semibold text-sm hover:bg-primary/15 transition-colors"
          >
            {isEdit ? '✏️ Jen tuto instanci' : '🗑️ Jen tuto instanci'}
          </button>
          <button
            onClick={onSeries}
            className="w-full py-3 rounded-xl border border-border text-ink font-semibold text-sm hover:bg-surface-overlay transition-colors"
          >
            {isEdit ? '📋 Celou sérii' : '❌ Celou sérii'}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 text-ink-muted text-sm hover:text-ink transition-colors"
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook that lazily geocodes a location text string and returns lat/lng.
 * Only runs when storedLat/storedLng are absent and location is non-empty.
 */
function useAutoGeocode(location: string | null | undefined, storedLat: number | null, storedLng: number | null) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    storedLat != null && storedLng != null ? { lat: storedLat, lng: storedLng } : null,
  );
  const [geocoding, setGeocoding] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    // Already have stored coords or already attempted
    if (coords || attempted.current || !location?.trim()) return;
    attempted.current = true;

    setGeocoding(true);
    const ctrl = new AbortController();
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`,
      {
        headers: { 'Accept-Language': 'cs,en', 'User-Agent': 'Rodinka/1.0 (family-calendar; krataf.dev)' },
        signal: ctrl.signal,
      },
    )
      .then((r) => r.json())
      .then((data: Array<{ lat: string; lon: string }>) => {
        if (data.length > 0) {
          setCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      })
      .catch(() => { /* silently ignore */ })
      .finally(() => setGeocoding(false));

    return () => ctrl.abort();
  }, [location, coords]);

  return { coords, geocoding };
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  /** yyyy-MM-dd of the specific occurrence we came from (if any) */
  const occurrenceDate = searchParams.get('occ') ?? null;
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: event, isLoading, error } = useEvent(id!);
  const approve = useApproveEvent();
  const reject = useRejectEvent();
  const cancel = useCancelEvent();
  const cancelOcc = useCancelOccurrence();
  const createEvent = useCreateEvent();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteOcc, setConfirmDeleteOcc] = useState(false);
  // 'choose' shows the series-vs-occurrence dialog; 'occurrence'/'series' go straight to action
  const [editDialog, setEditDialog] = useState<'choose' | 'occurrence' | 'series' | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<'choose' | null>(null);
  const [showCopy, setShowCopy] = useState(false);
  const [copyDate, setCopyDate] = useState('');
  const [copying, setCopying] = useState(false);

  const isRecurringSeries = !!event?.recurrenceRule;
  const showEdit = editDialog === 'series' || editDialog === 'occurrence';

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

  // Auto-geocode location text when stored coords are missing
  const { coords: mapCoords, geocoding: mapGeocoding } = useAutoGeocode(
    event.location,
    (event as any).locationLat ?? null,
    (event as any).locationLng ?? null,
  );

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
        transportDirection: (event.transport?.direction as any) ?? undefined,
        transportCoversSupervision: event.transport?.coversSupervision ?? undefined,
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
        {isRecurringSeries && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0 bg-primary/10 text-primary flex items-center gap-1">
            <RefreshCw size={10} /> Série
          </span>
        )}
        {(event as any).isExternalImport && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center gap-1">
            🔗 Externí
          </span>
        )}
        {(event as any).scheduleImportId && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center gap-1">
            🏫 Rozvrh
          </span>
        )}
        {!isRecurringSeries && event.status !== 'APPROVED' && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
            event.status === 'PROPOSED' ? 'bg-warning/15 text-warning' : 'bg-danger/15 text-danger'
          }`}>
            {t(`event.status.${event.status}`)}
          </span>
        )}
      </div>

      {/* ── Occurrence banner ──────────────────────────────────────── */}
      {isRecurringSeries && occurrenceDate && (
        <div className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20">
          <RefreshCw size={13} className="text-primary shrink-0" />
          <p className="text-xs text-primary font-medium">
            Zobrazujete instanci{' '}
            <strong>
              {format(new Date(occurrenceDate + 'T12:00:00'), 'd. MMMM yyyy', { locale: cs })}
            </strong>{' '}
            z opakující se série.
          </p>
        </div>
      )}

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
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2.5 mb-2">
              <MapPin size={15} className="text-primary shrink-0" />
              <p className="text-sm text-ink flex-1 truncate">{event.location}</p>
              {mapGeocoding && (
                <span className="text-[10px] text-ink-faint animate-pulse shrink-0">hledám…</span>
              )}
            </div>
            {mapCoords && (
              <>
                <LocationMap
                  lat={mapCoords.lat}
                  lng={mapCoords.lng}
                  label={event.location}
                />
                <CoordinatesRow
                  lat={mapCoords.lat}
                  lng={mapCoords.lng}
                />
              </>
            )}
            {!mapCoords && !mapGeocoding && (
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-0.5"
              >
                <MapPin size={11} /> Otevřít v mapách
              </a>
            )}
          </div>
        )}

        {/* Online meeting join button */}
        {(event as any).meetingUrl && (
          <div className="px-3 py-2.5">
            <a
              href={(event as any).meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{
                background: MEETING_COLORS[(event as any).meetingProvider] ?? '#64748b',
                color: '#ffffff',
              }}
            >
              <Video size={16} />
              Připojit se — {MEETING_LABELS[(event as any).meetingProvider] ?? 'Online schůzka'}
              <ExternalLink size={14} className="opacity-70" />
            </a>
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
              <p className="text-sm font-semibold text-ink">
                {formatTransportLabel(event.transport)}
              </p>
              {event.transport.note && !formatTransportLabel(event.transport)?.includes(event.transport.note) && (
                <p className="text-xs text-ink-muted">{event.transport.note}</p>
              )}
              {/* Direction badge */}
              {event.transport.direction && event.transport.direction !== 'BOTH' && (
                <span className="inline-block mt-0.5 text-[10px] font-semibold bg-warning/15 text-warning px-1.5 py-0.5 rounded-full">
                  {event.transport.direction === 'THERE' ? '→ Jen tam' : '← Jen zpět'}
                </span>
              )}
              {/* Supervision badge */}
              {event.transport.coversSupervision === true && (
                <span className="inline-block mt-0.5 ml-1 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                  ✅ hlídání zajistí
                </span>
              )}
              {event.transport.coversSupervision === false && (
                <span className="inline-block mt-0.5 ml-1 text-[10px] font-semibold bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                  ❌ hlídání nezajistí
                </span>
              )}
              {event.transport.coversSupervision === null && (
                <span className="inline-block mt-0.5 ml-1 text-[10px] font-semibold bg-surface-raised text-ink-faint px-1.5 py-0.5 rounded-full">
                  — hlídání není nutné
                </span>
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
                onClick={() => {
                  if (isRecurringSeries && occurrenceDate) setEditDialog('choose');
                  else setEditDialog('series');
                }}
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
            confirmDeleteOcc ? (
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 space-y-2">
                <p className="text-sm font-medium text-center text-ink">
                  Opravdu zrušit instanci{' '}
                  {occurrenceDate
                    ? format(new Date(occurrenceDate + 'T12:00:00'), 'd. MMMM yyyy', { locale: cs })
                    : ''}
                  ?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeleteOcc(false)} className="btn-secondary flex-1 py-2 text-sm">Ne</button>
                  <button
                    disabled={cancelOcc.isPending}
                    onClick={() => {
                      if (!occurrenceDate) return;
                      cancelOcc.mutate(
                        { parentId: event.id, date: occurrenceDate },
                        {
                          onSuccess: () => { toast('Instance zrušena', 'info'); navigate(-1); },
                          onError: () => toast('Chyba při rušení', 'error'),
                        },
                      );
                    }}
                    className="flex-1 bg-danger text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {cancelOcc.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                    Ano, zrušit instanci
                  </button>
                </div>
              </div>
            ) : !confirmDelete ? (
              <button
                onClick={() => {
                  if (isRecurringSeries && occurrenceDate) setDeleteDialog('choose');
                  else setConfirmDelete(true);
                }}
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
      <Sheet open={showEdit} onClose={() => setEditDialog(null)} title={editDialog === 'occurrence' ? 'Upravit tuto instanci' : 'Upravit událost'} fullScreen>
        {editDialog === 'occurrence' && occurrenceDate ? (
          /* Override start/end date to the occurrence date, save as exception */
          <EventForm
            onClose={() => setEditDialog(null)}
            initialValues={{
              ...event,
              // Shift the start/end to the occurrence date while keeping times
              start: `${occurrenceDate}T${event.start.slice(11)}`,
              end: `${occurrenceDate}T${event.end.slice(11)}`,
              recurrenceRule: null, // exception has no recurrence
            }}
            exceptionFor={{ parentId: event.id, occurrenceDate }}
            onExceptionCreated={(newId) => navigate(`/event/${newId}`)}
          />
        ) : (
          <EventForm onClose={() => setEditDialog(null)} initialValues={event} />
        )}
      </Sheet>

      {/* ── Occurrence-vs-series choice (edit) ─────────────────────── */}
      {editDialog === 'choose' && (
        <OccurrenceChoiceDialog
          action="edit"
          onOccurrence={() => setEditDialog('occurrence')}
          onSeries={() => setEditDialog('series')}
          onCancel={() => setEditDialog(null)}
        />
      )}

      {/* ── Occurrence-vs-series choice (delete) ───────────────────── */}
      {deleteDialog === 'choose' && (
        <OccurrenceChoiceDialog
          action="delete"
          onOccurrence={() => {
            setDeleteDialog(null);
            setConfirmDeleteOcc(true);
          }}
          onSeries={() => {
            setDeleteDialog(null);
            setConfirmDelete(true);
          }}
          onCancel={() => setDeleteDialog(null)}
        />
      )}

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

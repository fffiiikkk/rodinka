/**
 * AvailabilitySheet — three modes:
 *  "unavailable" — guardian marks days they CANNOT watch children
 *  "available"   — guardian marks days they ARE available (e.g. vacation week)
 *  "external"    — admin records an external helper
 */
import React, { useState } from 'react';
import { format, addDays } from 'date-fns';
import { UserX, UserCheck, CalendarCheck } from 'lucide-react';
import DatePicker from '../ui/DatePicker.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useCreateAvailability } from '../../hooks/useAvailability.js';
import { useToast } from '../ui/Toast.js';

export type AvailabilityMode = 'unavailable' | 'available' | 'external';

interface Props {
  onClose: () => void;
  defaultDate?: Date;
  initialMode?: AvailabilityMode;
}

const UNAVAIL_PRESETS = [
  { label: 'Pracovní cesta', emoji: '✈️' },
  { label: 'Dovolená',       emoji: '🏖️' },
  { label: 'Nemoc',          emoji: '🤒' },
  { label: 'Jiné',           emoji: '📝' },
];

const AVAIL_PRESETS = [
  { label: 'Dovolená doma',  emoji: '🏡' },
  { label: 'Volný týden',    emoji: '🌞' },
  { label: 'Práce z domova', emoji: '💻' },
  { label: 'Jiné',           emoji: '📝' },
];

const EXTERNAL_ROLE_PRESETS = [
  { label: 'Hlídač/ka',        emoji: '👶' },
  { label: 'Odvoz na trénink', emoji: '🚗' },
  { label: 'Kamarád rodiny',   emoji: '🤝' },
  { label: 'Jiné',             emoji: '📝' },
];

function todayStr() { return format(new Date(), 'yyyy-MM-dd'); }

const MODE_CONFIG = {
  unavailable: {
    label: 'Nedostupnost',
    Icon: UserX,
    color: 'bg-red-500',
    activeCls: 'bg-red-500 text-white',
    btnCls: 'bg-red-500 text-white hover:bg-red-600',
    submitLabel: 'Nastavit nedostupnost',
    toast: '✅ Nedostupnost nastavena',
    noteLabel: 'Důvod',
    notePlaceholder: 'nebo napiš vlastní důvod…',
  },
  available: {
    label: 'Dostupnost',
    Icon: CalendarCheck,
    color: 'bg-emerald-500',
    activeCls: 'bg-emerald-500 text-white',
    btnCls: 'bg-emerald-500 text-white hover:bg-emerald-600',
    submitLabel: 'Nastavit dostupnost',
    toast: '✅ Dostupnost nastavena',
    noteLabel: 'Poznámka',
    notePlaceholder: 'co plánuješ, kde budeš…',
  },
  external: {
    label: 'Výpomoc',
    Icon: UserCheck,
    color: 'bg-blue-500',
    activeCls: 'bg-blue-500 text-white',
    btnCls: 'bg-blue-500 text-white hover:bg-blue-600',
    submitLabel: 'Přidat výpomoc',
    toast: '',
    noteLabel: 'Poznámka',
    notePlaceholder: 'co bude dělat?',
  },
} as const;

export default function UnavailabilitySheet({ onClose, defaultDate, initialMode }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'PARENT';
  const create = useCreateAvailability();
  const { toast } = useToast();

  const [mode, setMode] = useState<AvailabilityMode>(initialMode ?? 'unavailable');
  const [dateFrom, setDateFrom] = useState(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : todayStr());
  const [dateTo,   setDateTo]   = useState(
    defaultDate ? format(addDays(defaultDate, 6), 'yyyy-MM-dd')
                : format(addDays(new Date(), 6), 'yyyy-MM-dd'),
  );
  const [note, setNote]                 = useState('');
  const [externalName, setExternalName] = useState('');
  const [externalRole, setExternalRole] = useState('');
  const [saving, setSaving]             = useState(false);

  const cfg = MODE_CONFIG[mode];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const from = new Date(`${dateFrom}T00:00:00`);
      const to   = new Date(`${dateTo}T23:59:59`);

      if (mode === 'external') {
        if (!externalName.trim()) { toast('Zadej jméno osoby', 'error'); setSaving(false); return; }
        await create.mutateAsync({
          dateFrom: from.toISOString(), dateTo: to.toISOString(),
          status: 'AVAILABLE', note: note || undefined,
          isExternal: true,
          externalName: externalName.trim(),
          externalRole: externalRole || undefined,
        });
        toast(`✅ ${externalName} přidán/a jako výpomoc`, 'success');
      } else {
        await create.mutateAsync({
          dateFrom: from.toISOString(), dateTo: to.toISOString(),
          status: mode === 'unavailable' ? 'UNAVAILABLE' : 'AVAILABLE',
          note: note || undefined,
        });
        toast(cfg.toast, 'success');
      }
      onClose();
    } catch { toast('Chyba při ukládání', 'error'); }
    finally { setSaving(false); }
  };

  // Modes available for tab switching (only when not locked to initialMode)
  const showTabs = !initialMode;
  const tabs: AvailabilityMode[] = isAdmin
    ? ['unavailable', 'available', 'external']
    : ['unavailable', 'available'];

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">

      {/* Mode tabs */}
      {showTabs && (
        <div className="flex rounded-xl overflow-hidden border border-border">
          {tabs.map((m) => {
            const c = MODE_CONFIG[m];
            const Icon = c.Icon;
            return (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setNote(''); }}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition-colors ${
                  mode === m ? c.activeCls : 'text-ink-muted hover:bg-surface-raised'
                }`}
              >
                <Icon size={16} />
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* External person fields */}
      {mode === 'external' && (
        <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <div>
            <label className="label">Jméno osoby *</label>
            <input
              className="input"
              placeholder="např. Pavel Novák"
              value={externalName}
              onChange={(e) => setExternalName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Role / typ výpomoci</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {EXTERNAL_ROLE_PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => setExternalRole(p.label)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    externalRole === p.label ? 'bg-blue-500 text-white border-blue-500' : 'border-border bg-surface-raised'
                  }`}
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
            <input className="input" placeholder="nebo napiš vlastní…"
              value={externalRole} onChange={(e) => setExternalRole(e.target.value)} />
          </div>
        </div>
      )}

      {/* Available: context banner */}
      {mode === 'available' && (
        <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200">
          <CalendarCheck size={18} className="shrink-0 mt-0.5" />
          <p>Oznámuješ, že <strong>jsi k dispozici</strong> pro hlídání dětí v tomto období — i když normálně ne.</p>
        </div>
      )}

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Od</label>
          <DatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); if (v > dateTo) setDateTo(v); }} />
        </div>
        <div>
          <label className="label">Do (včetně)</label>
          <DatePicker value={dateTo} min={dateFrom} onChange={setDateTo} />
        </div>
      </div>

      {/* Note / reason with presets */}
      <div>
        <label className="label">
          {cfg.noteLabel}
          <span className="text-ink-faint text-xs ml-1">(nepovinné)</span>
        </label>

        {mode === 'unavailable' && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {UNAVAIL_PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => setNote(p.label)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  note === p.label ? 'bg-red-500 text-white border-red-500' : 'border-border bg-surface-raised'
                }`}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
        )}

        {mode === 'available' && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {AVAIL_PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => setNote(p.label)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  note === p.label ? 'bg-emerald-500 text-white border-emerald-500' : 'border-border bg-surface-raised'
                }`}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
        )}

        <input
          className="input"
          placeholder={cfg.notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Zrušit</button>
        <button type="submit" disabled={saving} className={`flex-1 font-semibold py-2.5 rounded-xl transition-all ${cfg.btnCls}`}>
          {saving ? 'Ukládám…' : cfg.submitLabel}
        </button>
      </div>
    </form>
  );
}

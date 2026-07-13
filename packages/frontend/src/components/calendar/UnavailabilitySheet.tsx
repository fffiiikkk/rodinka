/**
 * UnavailabilitySheet — three modes:
 *  "unavailable" — guardian marks days they CANNOT watch children
 *  "available"   — guardian marks days they ARE available (e.g. vacation week)
 *  "external"    — admin records an external helper
 *
 * Supports:
 *  - editItem: pre-fill form to edit an existing record
 *  - adminUsers: list of users admin can create for (non-own record)
 */
import React, { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { UserX, UserCheck, CalendarCheck } from 'lucide-react';
import { UserPickerRow } from '../ui/UserPickerRow.js';
import DatePicker from '../ui/DatePicker.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useCreateAvailability, useUpdateAvailability } from '../../hooks/useAvailability.js';
import { useToast } from '../ui/Toast.js';
import type { Availability } from '@rodinkal/shared';

export type AvailabilityMode = 'unavailable' | 'available' | 'external';

interface AdminUser {
  id: string;
  name: string;
  nickname?: string | null;
  role?: string;
  dateOfBirth?: string | null;
  relationship?: string | null;
}

interface Props {
  onClose: () => void;
  defaultDate?: Date;
  initialMode?: AvailabilityMode;
  editItem?: Availability;          // edit mode when provided
  adminUsers?: AdminUser[];          // list of other users admin can select
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

function isoDateStr(isoString: string) {
  return isoString.slice(0, 10);
}

export default function UnavailabilitySheet({ onClose, defaultDate, initialMode, editItem, adminUsers }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'PARENT';
  const create = useCreateAvailability();
  const update = useUpdateAvailability();
  const { toast } = useToast();

  const isEdit = !!editItem;

  // Derive initial mode from editItem if present
  const derivedMode = editItem
    ? editItem.isExternal
      ? 'external'
      : editItem.status === 'UNAVAILABLE' ? 'unavailable' : 'available'
    : (initialMode ?? 'unavailable');

  const [mode, setMode] = useState<AvailabilityMode>(derivedMode);

  const [dateFrom, setDateFrom] = useState(
    editItem ? isoDateStr(editItem.dateFrom)
    : defaultDate ? format(defaultDate, 'yyyy-MM-dd')
    : todayStr()
  );
  const [dateTo, setDateTo] = useState(
    editItem ? isoDateStr(editItem.dateTo)
    : defaultDate ? format(addDays(defaultDate, 6), 'yyyy-MM-dd')
    : format(addDays(new Date(), 6), 'yyyy-MM-dd')
  );
  const [note, setNote]                 = useState(editItem?.note ?? '');
  const [externalName, setExternalName] = useState(editItem?.externalName ?? '');
  const [externalRole, setExternalRole] = useState(editItem?.externalRole ?? '');
  // Admin: one or more target users — default to current user
  const [targetUserIds, setTargetUserIds] = useState<string[]>(
    editItem?.userId ? [editItem.userId] : (user?.id ? [user.id] : []),
  );
  const [saving, setSaving] = useState(false);

  // Reset selection when sheet opens fresh (non-edit)
  useEffect(() => {
    if (!isEdit && user?.id) setTargetUserIds([user.id]);
  }, [isEdit, user?.id]);

  const toggleUser = (id: string) => {
    setTargetUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const cfg = MODE_CONFIG[mode];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const from = new Date(`${dateFrom}T00:00:00`);
      const to   = new Date(`${dateTo}T23:59:59`);

      if (isEdit && editItem) {
        await update.mutateAsync({
          id: editItem.id,
          data: {
            dateFrom: from.toISOString(),
            dateTo: to.toISOString(),
            status: mode === 'unavailable' ? 'UNAVAILABLE' : 'AVAILABLE',
            note: note || undefined,
            isExternal: mode === 'external' ? true : undefined,
            externalName: mode === 'external' ? externalName.trim() : undefined,
            externalRole: mode === 'external' ? externalRole : undefined,
          },
        });
        toast('✅ Záznam upraven', 'success');
      } else if (mode === 'external') {
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
        // Create one record per selected user (admin may pick multiple)
        const usersToCreate = isAdmin && targetUserIds.length > 0 ? targetUserIds : [user?.id ?? ''];
        await Promise.all(
          usersToCreate.map((uid) =>
            create.mutateAsync({
              dateFrom: from.toISOString(), dateTo: to.toISOString(),
              status: mode === 'unavailable' ? 'UNAVAILABLE' : 'AVAILABLE',
              note: note || undefined,
              ...(uid && uid !== user?.id ? { userId: uid } : {}),
            } as any),
          ),
        );
        const count = usersToCreate.length;
        toast(count > 1 ? `✅ Záznam vytvořen pro ${count} osoby` : cfg.toast, 'success');
      }
      onClose();
    } catch { toast('Chyba při ukládání', 'error'); }
    finally { setSaving(false); }
  };

  const showTabs = !initialMode && !isEdit;
  const tabs: AvailabilityMode[] = isAdmin
    ? ['unavailable', 'available', 'external']
    : ['unavailable', 'available'];

  // All selectable users for admin multi-picker (self first, then others)
  const allSelectableUsers: AdminUser[] = [
    ...(user ? [{ id: user.id, name: `Já (${user.name})` }] : []),
    ...(adminUsers ?? []),
  ];

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

      {/* Admin: multi-user picker (non-external modes only) */}
      {isAdmin && !isEdit && mode !== 'external' && allSelectableUsers.length > 1 && (
        <div>
          <label className="label">
            Pro koho
            {targetUserIds.length > 1 && (
              <span className="ml-1.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                {targetUserIds.length} osob
              </span>
            )}
          </label>
          <div className="space-y-0 rounded-xl border border-border overflow-hidden">
            {allSelectableUsers.map((u) => (
              <label
                key={u.id}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                  targetUserIds.includes(u.id) ? 'bg-primary/8' : 'hover:bg-surface-raised'
                }`}
              >
                <input
                  type="checkbox"
                  checked={targetUserIds.includes(u.id)}
                  onChange={() => toggleUser(u.id)}
                  className="w-4 h-4 accent-primary shrink-0"
                />
                <UserPickerRow u={{ ...u, role: u.role ?? 'PARENT' }} />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Edit mode: show whose record this is */}
      {isEdit && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-raised border border-border text-sm">
          <span className="text-ink-muted">Záznam pro:</span>
          <span className="font-semibold text-ink">{editItem?.userName ?? user?.name ?? ''}</span>
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
          <p>
            {isAdmin && targetUserIds.length > 1
              ? <>Dostupnost bude nastavena pro <strong>{targetUserIds.length} osoby</strong>.</>
              : isAdmin && targetUserIds.length === 1 && targetUserIds[0] !== user?.id
                ? <><strong>{allSelectableUsers.find((u) => u.id === targetUserIds[0])?.name}</strong> oznámí dostupnost pro hlídání v tomto období.</>
                : <>Oznámuješ, že <strong>jsi k dispozici</strong> pro hlídání dětí v tomto období — i když normálně ne.</>
            }
          </p>
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
          {saving ? 'Ukládám…' : isEdit ? 'Uložit změny' : cfg.submitLabel}
        </button>
      </div>
    </form>
  );
}

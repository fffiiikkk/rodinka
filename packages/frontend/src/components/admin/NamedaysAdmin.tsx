/**
 * NamedaysAdmin — admin panel for managing user nameday overrides.
 *
 * Shows all active users with their auto-detected nameday from the Czech
 * civil calendar. Users whose first name couldn't be matched are highlighted
 * in orange. The admin can set an explicit MM-DD override for any user.
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flower2, AlertTriangle, Check, X, Search, Pencil, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../ui/Toast.js';

// ─── types ────────────────────────────────────────────────────────────────────

interface NamedayStatus {
  id: string;
  name: string;
  firstName: string;
  autoMMDD: string | null;
  overrideMMDD: string | null;
  effectiveMMDD: string | null;
  nameDayLabel: string | null;
  matched: boolean;
  overridden: boolean;
}

// ─── constants ────────────────────────────────────────────────────────────────

const MONTHS_CS = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

const MONTHS_CS_GENITIVE = [
  'ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
];

function daysInMonth(month: number): number {
  // month: 1-based; use a leap year to be safe for February
  return new Date(2000, month, 0).getDate();
}

function formatMMDD(mmdd: string): string {
  const [mm, dd] = mmdd.split('-');
  const month = parseInt(mm!, 10);
  const day = parseInt(dd!, 10);
  return `${day}. ${MONTHS_CS_GENITIVE[month - 1]}`;
}

// ─── hooks ────────────────────────────────────────────────────────────────────

function useNamedays() {
  return useQuery({
    queryKey: ['admin-namedays'],
    queryFn: () => api.get<{ namedays: NamedayStatus[] }>('/users/namedays').then((r) => r.namedays),
  });
}

function useNamedayCalendar() {
  return useQuery({
    queryKey: ['nameday-calendar'],
    queryFn: () => api.get<{ calendar: Record<string, string> }>('/users/nameday-calendar').then((r) => r.calendar),
    staleTime: Infinity,
  });
}

function useSetNamedayOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, mmdd }: { userId: string; mmdd: string | null }) =>
      api.patch(`/users/${userId}`, { nameDayOverride: mmdd }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-namedays'] }),
  });
}

// ─── Row editor ───────────────────────────────────────────────────────────────

function NamedayEditor({
  user,
  calendar,
  onClose,
}: {
  user: NamedayStatus;
  calendar: Record<string, string>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const save = useSetNamedayOverride();

  const initMMDD = user.overrideMMDD ?? user.autoMMDD ?? '01-01';
  const [month, setMonth] = useState(parseInt(initMMDD.split('-')[0]!, 10));
  const [day, setDay] = useState(parseInt(initMMDD.split('-')[1]!, 10));

  const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const previewName = calendar[mmdd] ?? '—';

  const handleSave = async () => {
    await save.mutateAsync({ userId: user.id, mmdd });
    toast(`✅ Jmeniny ${user.name} nastaveny na ${formatMMDD(mmdd)}`, 'success');
    onClose();
  };

  const handleClear = async () => {
    await save.mutateAsync({ userId: user.id, mmdd: null });
    toast(`🗑️ Přepsání jmenin ${user.name} odstraněno`, 'info');
    onClose();
  };

  return (
    <div className="mt-2 p-3 rounded-xl bg-surface border border-primary/30 space-y-3">
      {/* Month + Day selects */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide mb-1">Měsíc</label>
          <select
            className="input w-full text-sm"
            value={month}
            onChange={(e) => {
              const m = parseInt(e.target.value, 10);
              setMonth(m);
              if (day > daysInMonth(m)) setDay(daysInMonth(m));
            }}
          >
            {MONTHS_CS.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide mb-1">Den</label>
          <select
            className="input w-full text-sm"
            value={day}
            onChange={(e) => setDay(parseInt(e.target.value, 10))}
          >
            {Array.from({ length: daysInMonth(month) }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}.</option>
            ))}
          </select>
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/8 border border-primary/20">
        <Flower2 size={14} className="text-primary shrink-0" />
        <span className="text-sm font-semibold text-ink">{formatMMDD(mmdd)}</span>
        <span className="text-xs text-ink-muted">— {previewName}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={save.isPending}
          className="flex-1 btn-primary py-2 text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Uložit
        </button>
        {user.overrideMMDD && (
          <button
            onClick={handleClear}
            disabled={save.isPending}
            className="px-3 py-2 rounded-xl border border-danger/30 text-danger text-sm font-semibold hover:bg-danger/5 transition-colors disabled:opacity-60"
            title="Odebrat přepsání (vrátit na auto-detekci)"
          >
            <Trash2 size={14} />
          </button>
        )}
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-xl border border-border text-ink-muted text-sm hover:bg-surface-overlay transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NamedaysAdmin() {
  const { data: namedays = [], isLoading } = useNamedays();
  const { data: calendar = {} } = useNamedayCalendar();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const unmatched = namedays.filter((u) => !u.matched && !u.overrideMMDD);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return namedays;
    return namedays.filter(
      (u) => u.name.toLowerCase().includes(q) || u.firstName.toLowerCase().includes(q),
    );
  }, [namedays, search]);

  // Sort: unmatched (no override) first, then overridden, then auto-matched
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const rankA = !a.matched && !a.overrideMMDD ? 0 : a.overrideMMDD ? 1 : 2;
    const rankB = !b.matched && !b.overrideMMDD ? 0 : b.overrideMMDD ? 1 : 2;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, 'cs');
  }), [filtered]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Flower2 size={20} className="text-primary" />
        <div>
          <h2 className="font-bold text-ink text-base">Správa jmenin</h2>
          <p className="text-xs text-ink-muted">Přepište datum jmenin, pokud není automaticky rozpoznáno.</p>
        </div>
      </div>

      {/* Summary banner for unmatched */}
      {unmatched.length > 0 && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-warning/10 border border-warning/30">
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warning">
              {unmatched.length} {unmatched.length === 1 ? 'jméno nebylo nalezeno' : 'jména nebyla nalezena'} v kalendáři
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              {unmatched.map((u) => u.firstName).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          className="input w-full pl-8 text-sm"
          placeholder="Hledat osobu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* User list */}
      <div className="space-y-2">
        {sorted.map((user) => {
          const isEditing = editingId === user.id;
          const isUnmatched = !user.matched && !user.overrideMMDD;
          const isOverridden = !!user.overrideMMDD;

          return (
            <div
              key={user.id}
              className={`rounded-xl border px-3 py-2.5 transition-colors ${
                isUnmatched
                  ? 'border-warning/40 bg-warning/5'
                  : isOverridden
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-surface-raised'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {/* Status icon */}
                {isUnmatched ? (
                  <AlertTriangle size={16} className="text-warning shrink-0" />
                ) : (
                  <Flower2 size={16} className="text-primary shrink-0" />
                )}

                {/* Name info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-ink">{user.name}</span>
                    <span className="text-[10px] text-ink-faint bg-surface-overlay px-1.5 py-0.5 rounded-full">
                      "{user.firstName}"
                    </span>
                    {isOverridden && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        přepsáno
                      </span>
                    )}
                  </div>

                  {user.effectiveMMDD ? (
                    <p className="text-xs text-ink-muted mt-0.5">
                      {formatMMDD(user.effectiveMMDD)}
                      {user.nameDayLabel && (
                        <span className="ml-1 opacity-70">({user.nameDayLabel})</span>
                      )}
                      {isOverridden && user.autoMMDD && (
                        <span className="ml-1 text-ink-faint">
                          — auto: {formatMMDD(user.autoMMDD)}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-warning font-medium mt-0.5">Jméno nenalezeno v kalendáři</p>
                  )}
                </div>

                {/* Edit button */}
                <button
                  onClick={() => setEditingId(isEditing ? null : user.id)}
                  className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                    isEditing
                      ? 'bg-primary/10 text-primary'
                      : 'text-ink-muted hover:text-ink hover:bg-surface-overlay'
                  }`}
                  title="Upravit datum jmenin"
                >
                  {isEditing ? <X size={15} /> : <Pencil size={15} />}
                </button>
              </div>

              {/* Inline editor */}
              {isEditing && (
                <NamedayEditor
                  user={user}
                  calendar={calendar}
                  onClose={() => setEditingId(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && search && (
        <p className="text-center text-sm text-ink-muted py-8">Žádná shoda pro „{search}"</p>
      )}
    </div>
  );
}

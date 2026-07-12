import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useToast } from '../ui/Toast.js';
import Sheet from '../ui/Sheet.js';
import { Plus, Edit, ToggleLeft, ToggleRight } from 'lucide-react';

// ─── Curated emoji icon set by category ─────────────────────────────────────
const ICON_CATEGORIES: { label: string; icons: string[] }[] = [
  {
    label: 'Sport',
    icons: ['⛸️','🏒','🥊','🏊','🤽','🏄','🏋️','🚴','🧘','🤸','🏃','🚶','⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥋','🤺','🏹','🎿','⛷️','🛷','🥌','🏇','🛹','🛼','🛶','🚣','🧗','🤼','🤾','🏌️','🏇','🪃','🎯'],
  },
  {
    label: 'Vzdělání',
    icons: ['📚','✏️','🖊️','📓','📖','🎓','🏫','📐','📏','🔬','🔭','💻','🖥️','📝','📋','📌','📍','🗂️','🗒️','📊','📈','📉','🧮','🧪','🧫','🧬','🔢','🔤','🔡','💡'],
  },
  {
    label: 'Zdraví a lékař',
    icons: ['🏥','💊','💉','🩺','🩹','🩻','🦷','🦴','👁️','🫀','🫁','🧠','🩸','🧬','🌡️','🔬','🚑','🧹','🧼','🫧','🪥'],
  },
  {
    label: 'Rodina a domov',
    icons: ['🏠','🏡','🛋️','🍳','🛒','🧹','🪴','🛏️','🛁','🚿','🪑','🖼️','🪞','🧺','🪣','🧴','🫧','🔑','🗝️','🚪','🏗️','👨‍👩‍👧‍👦','👪','👶','🧒','👧','👦'],
  },
  {
    label: 'Jídlo a pití',
    icons: ['🍕','🍔','🌮','🍜','🍣','🥗','🍱','🥩','🍗','🍖','🥞','🧇','🍩','🎂','🍰','🧁','🍦','🍨','🍫','🍭','☕','🍵','🧋','🥤','🍹','🥂','🍾','🧃'],
  },
  {
    label: 'Cestování a příroda',
    icons: ['✈️','🚂','🚗','🛳️','⛺','🏕️','🗺️','🧭','🏔️','🌋','🏖️','🏝️','🌄','🌅','🌇','🌆','🌃','🗼','🗽','🏰','🎡','🎢','🎠','⛩️','🕌','🛤️','🛣️','🌍','🌎','🌏','🧳'],
  },
  {
    label: 'Kultura a umění',
    icons: ['🎭','🎨','🖼️','🎬','🎤','🎸','🎹','🎺','🥁','🎻','🪗','🎵','🎶','🎙️','🎧','🎼','📽️','🎞️','📺','📻','🎮','🕹️','🃏','🎲','♟️','🎯','🎳'],
  },
  {
    label: 'Slavnosti a oslavy',
    icons: ['🎉','🎊','🥳','🎈','🎁','🎀','🎂','🕯️','🪄','✨','🎆','🎇','🧨','🪅','🎋','🎍','🎎','🎐','🎑','🪔','🎃','🎄','🥚','🐣','🌹','💐'],
  },
  {
    label: 'Práce a admin',
    icons: ['💼','📁','📂','🗃️','🗄️','📊','📈','📉','💹','💰','💳','🖨️','📠','📞','☎️','📧','📨','📩','📬','📭','🔧','🔨','⚙️','🪛','🔩','🪝','🗜️','🔗','📎','✂️'],
  },
  {
    label: 'Ostatní',
    icons: ['⭐','🌟','💫','✨','🔥','💥','❄️','🌈','⚡','🌊','🌪️','🌀','💤','❓','❗','♻️','🆘','🚨','⚠️','🚧','🔔','🔕','📢','📣','💬','💭','🗯️','👍','👎','❤️','💪','🙏'],
  },
];

const PRESET_COLORS = [
  '#EF4444','#F97316','#EAB308','#22C55E','#14B8A6','#3B82F6','#8B5CF6','#EC4899',
  '#DC2626','#EA580C','#CA8A04','#16A34A','#0D9488','#2563EB','#7C3AED','#DB2777',
  '#6B7280','#374151','#1E293B','#7F1D1D','#1A3A1A','#1A1A3A','#3A1A3A','#3A2A1A',
];

interface EventTypeRow {
  id: string;
  slug: string;
  nameCs: string;
  nameEn: string;
  icon: string;
  color: string;
  groupCs: string;
  groupEn: string;
  defaultDurationMinutes: number;
  defaultReminderMinutes: number;
  sortOrder: number;
  isActive: boolean;
}

type FormState = Omit<EventTypeRow, 'id' | 'isActive'>;

const emptyForm = (): FormState => ({
  slug: '',
  nameCs: '',
  nameEn: '',
  icon: '📅',
  color: '#3B82F6',
  groupCs: '',
  groupEn: '',
  defaultDurationMinutes: 60,
  defaultReminderMinutes: 60,
  sortOrder: 0,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function EventTypesAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EventTypeRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [iconTab, setIconTab] = useState(0);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ['event-types', 'all'],
    queryFn: () => api.get<{ types: EventTypeRow[] }>('/event-types/all').then((r) => r.types),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setIconTab(0);
    setSheetOpen(true);
  };

  const openEdit = (et: EventTypeRow) => {
    setEditing(et);
    setForm({
      slug: et.slug,
      nameCs: et.nameCs,
      nameEn: et.nameEn,
      icon: et.icon,
      color: et.color,
      groupCs: et.groupCs,
      groupEn: et.groupEn,
      defaultDurationMinutes: et.defaultDurationMinutes,
      defaultReminderMinutes: et.defaultReminderMinutes,
      sortOrder: et.sortOrder,
    });
    setIconTab(0);
    setSheetOpen(true);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.nameCs || !form.nameEn || !form.icon || !form.color) {
      toast('Vyplňte všechna povinná pole', 'error');
      return;
    }
    const slug = form.slug || slugify(form.nameCs);
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/event-types/${editing.id}`, { ...form, slug });
        toast('Typ upraven', 'success');
      } else {
        await api.post('/event-types', { ...form, slug });
        toast('Typ přidán', 'success');
      }
      qc.invalidateQueries({ queryKey: ['event-types'] });
      setSheetOpen(false);
    } catch {
      toast('Nepodařilo se uložit', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    await api.patch(`/event-types/${id}`, { isActive: !isActive });
    qc.invalidateQueries({ queryKey: ['event-types'] });
    toast(isActive ? 'Typ deaktivován' : 'Typ aktivován', 'success');
  };

  // Group types by groupCs
  const grouped = (data ?? []).reduce<Record<string, EventTypeRow[]>>((acc, et) => {
    const g = et.groupCs || 'Ostatní';
    (acc[g] ??= []).push(et);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-ink">Typy událostí</h2>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm">
          <Plus size={16} /> Přidat typ
        </button>
      </div>

      {Object.entries(grouped).map(([group, types]) => (
        <div key={group} className="space-y-1">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-wide px-1">{group}</p>
          {types.map((et) => (
            <div key={et.id} className={`card p-3 flex items-center gap-3 ${!et.isActive ? 'opacity-40' : ''}`}>
              <span className="text-2xl w-8 text-center">{et.icon}</span>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: et.color }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{et.nameCs}</p>
                <p className="text-xs text-ink-muted">{et.defaultDurationMinutes} min · připomínka {et.defaultReminderMinutes} min předem</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(et)} className="p-1.5 text-ink-muted hover:text-primary transition-colors" title="Upravit">
                  <Edit size={15} />
                </button>
                <button onClick={() => toggle(et.id, et.isActive)} className="p-1.5 text-ink-muted hover:text-primary transition-colors" title={et.isActive ? 'Deaktivovat' : 'Aktivovat'}>
                  {et.isActive ? <ToggleRight size={18} className="text-success" /> : <ToggleLeft size={18} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Create / Edit sheet */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editing ? `Upravit: ${editing.nameCs}` : 'Nový typ události'} fullScreen>
        <div className="p-4 space-y-4">

          {/* Icon preview + picker */}
          <div>
            <label className="label mb-2">Ikona</label>
            <div className="flex items-center gap-3 mb-3">
              <span
                className="text-4xl w-16 h-16 flex items-center justify-center rounded-xl border-2 border-primary shadow-sm"
                style={{ background: form.color + '22' }}
              >
                {form.icon}
              </span>
              <div className="text-sm text-ink-muted">Klikněte na emoji níže pro výběr</div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none mb-2">
              {ICON_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  onClick={() => setIconTab(i)}
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                    iconTab === i ? 'bg-primary text-white' : 'bg-surface-raised text-ink-muted hover:text-ink'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Emoji grid */}
            <div className="grid grid-cols-10 gap-1 max-h-36 overflow-y-auto bg-surface-raised rounded-xl p-2">
              {ICON_CATEGORIES[iconTab]?.icons.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => set('icon', emoji)}
                  className={`text-xl p-1 rounded-lg transition-colors ${
                    form.icon === emoji ? 'bg-primary shadow' : 'hover:bg-surface-overlay'
                  }`}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Custom emoji input */}
            <div className="mt-2">
              <input
                className="input text-sm"
                placeholder="Nebo vložte vlastní emoji / zkopírujte symbol…"
                value={form.icon}
                onChange={(e) => set('icon', e.target.value)}
                maxLength={8}
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="label mb-2">Barva</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set('color', c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    form.color === c ? 'border-ink scale-110' : 'border-transparent'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => set('color', e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border border-border"
              />
              <input
                className="input text-sm font-mono"
                value={form.color}
                onChange={(e) => set('color', e.target.value)}
                placeholder="#3B82F6"
                maxLength={7}
              />
            </div>
          </div>

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Název (česky) *</label>
              <input
                className="input"
                value={form.nameCs}
                onChange={(e) => {
                  set('nameCs', e.target.value);
                  if (!editing) set('slug', slugify(e.target.value));
                }}
                placeholder="Lední hokej"
              />
            </div>
            <div>
              <label className="label">Name (English) *</label>
              <input
                className="input"
                value={form.nameEn}
                onChange={(e) => set('nameEn', e.target.value)}
                placeholder="Ice hockey"
              />
            </div>
          </div>

          {/* Groups */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Skupina (česky)</label>
              <input
                className="input"
                value={form.groupCs}
                onChange={(e) => set('groupCs', e.target.value)}
                placeholder="Sport"
                list="group-cs-list"
              />
              <datalist id="group-cs-list">
                {[...new Set((data ?? []).map((e) => e.groupCs))].map((g) => <option key={g} value={g} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Group (English)</label>
              <input
                className="input"
                value={form.groupEn}
                onChange={(e) => set('groupEn', e.target.value)}
                placeholder="Sports"
                list="group-en-list"
              />
              <datalist id="group-en-list">
                {[...new Set((data ?? []).map((e) => e.groupEn))].map((g) => <option key={g} value={g} />)}
              </datalist>
            </div>
          </div>

          {/* Slug */}
          <div>
            <label className="label">Slug (unikátní ID)</label>
            <input
              className="input font-mono text-sm"
              value={form.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="lední-hokej"
            />
          </div>

          {/* Duration & reminder */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Výchozí délka (min)</label>
              <input
                type="number"
                className="input"
                min={5} max={1440}
                value={form.defaultDurationMinutes}
                onChange={(e) => set('defaultDurationMinutes', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Připomínka (min předem)</label>
              <input
                type="number"
                className="input"
                min={0} max={10080}
                value={form.defaultReminderMinutes}
                onChange={(e) => set('defaultReminderMinutes', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Sort order */}
          <div>
            <label className="label">Pořadí zobrazení</label>
            <input
              type="number"
              className="input"
              value={form.sortOrder}
              onChange={(e) => set('sortOrder', Number(e.target.value))}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 pb-safe">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1 py-3 font-semibold disabled:opacity-50"
            >
              {saving ? 'Ukládám…' : editing ? 'Uložit změny' : 'Přidat typ'}
            </button>
            <button onClick={() => setSheetOpen(false)} className="btn-ghost flex-1 py-3 font-semibold">
              Zrušit
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

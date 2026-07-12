import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useToast } from '../ui/Toast.js';
import RichTextEditor from '../ui/RichTextEditor.js';
import { format } from 'date-fns';
import { Trash2, Edit, Eye, EyeOff } from 'lucide-react';

interface MotdItem {
  id: string;
  textCs: string;
  textEn: string;
  validFrom: string;
  validTo: string;
  audience: string;
  isActive: boolean;
}

const AUDIENCE_OPTIONS = [
  { value: 'ALL', label: 'Všichni' },
  { value: 'ADULTS', label: 'Jen dospělí' },
  { value: 'KIDS', label: 'Jen děti' },
];

export default function MotdAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data } = useQuery({
    queryKey: ['motd', 'all'],
    queryFn: () => api.get<{ items: MotdItem[] }>('/motd').then((r) => r.items),
  });

  const [textCs, setTextCs] = useState('');
  const [textEn, setTextEn] = useState('');
  const [audience, setAudience] = useState('ALL');
  const [validFrom, setValidFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [validTo, setValidTo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return format(d, 'yyyy-MM-dd');
  });
  const [tab, setTab] = useState<'cs' | 'en'>('cs');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!textCs || !textEn) { toast('Vyplňte texty v obou jazycích', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/motd', {
        textCs, textEn, audience,
        validFrom: new Date(validFrom).toISOString(),
        validTo: new Date(validTo + 'T23:59:59').toISOString(),
      });
      qc.invalidateQueries({ queryKey: ['motd'] });
      setTextCs(''); setTextEn('');
      toast('Zpráva přidána', 'success');
    } catch {
      toast('Nepodařilo se uložit', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: MotdItem) => {
    await api.patch(`/motd/${item.id}`, { isActive: !item.isActive });
    qc.invalidateQueries({ queryKey: ['motd'] });
    toast(item.isActive ? 'Deaktivováno' : 'Aktivováno', 'info');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat zprávu?')) return;
    await api.delete(`/motd/${id}`);
    qc.invalidateQueries({ queryKey: ['motd'] });
    toast('Smazáno', 'info');
  };

  return (
    <div className="space-y-5">
      {/* Create form */}
      <div className="card p-4 space-y-4">
        <h3 className="font-bold text-ink">Nová zpráva dne</h3>

        {/* Language tabs */}
        <div className="flex gap-1 border-b border-border pb-3">
          <button
            onClick={() => setTab('cs')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${tab === 'cs' ? 'bg-primary text-white' : 'text-ink-muted hover:text-ink'}`}
          >
            🇨🇿 Česky
          </button>
          <button
            onClick={() => setTab('en')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${tab === 'en' ? 'bg-primary text-white' : 'text-ink-muted hover:text-ink'}`}
          >
            🇬🇧 English
          </button>
        </div>

        {tab === 'cs' ? (
          <div>
            <label className="label mb-2">Text zprávy (česky)</label>
            <RichTextEditor
              value={textCs}
              onChange={setTextCs}
              placeholder="Ahoj rodino! 👋 Napište zprávu dne…"
            />
          </div>
        ) : (
          <div>
            <label className="label mb-2">Message text (English)</label>
            <RichTextEditor
              value={textEn}
              onChange={setTextEn}
              placeholder="Hello family! 👋 Write your message of the day…"
            />
          </div>
        )}

        {/* Date range & audience */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Platí od</label>
            <input type="date" className="input" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Platí do</label>
            <input type="date" className="input" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Komu zobrazit</label>
          <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <button
          onClick={handleCreate}
          disabled={saving}
          className="btn-primary w-full py-2.5 font-semibold disabled:opacity-50"
        >
          {saving ? 'Ukládám…' : 'Přidat zprávu'}
        </button>
      </div>

      {/* Existing messages */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm text-ink-muted uppercase tracking-wide px-1">Existující zprávy</h3>
        {data?.map((item) => (
          <div key={item.id} className={`card p-3 space-y-2 ${!item.isActive ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div
                  className="motd-content text-sm line-clamp-2 text-ink"
                  dangerouslySetInnerHTML={{ __html: item.textCs }}
                />
                <p className="text-xs text-ink-muted mt-1">
                  {format(new Date(item.validFrom), 'd.M.')} – {format(new Date(item.validTo), 'd.M.yyyy')}
                  {' · '}
                  {AUDIENCE_OPTIONS.find((o) => o.value === item.audience)?.label}
                  {item.isActive && <span className="ml-1.5 text-success font-semibold">● Aktivní</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(item)}
                  className="p-1.5 text-ink-muted hover:text-primary transition-colors"
                  title={item.isActive ? 'Deaktivovat' : 'Aktivovat'}
                >
                  {item.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-ink-muted hover:text-danger transition-colors"
                  title="Smazat"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {data?.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-4">Žádné zprávy</p>
        )}
      </div>
    </div>
  );
}

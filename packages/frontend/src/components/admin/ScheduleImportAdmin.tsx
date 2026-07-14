import React, { useState, useRef } from 'react';
import {
  Download, Copy, Eye, Upload, Trash2, RefreshCw,
  CheckCircle2, AlertCircle, AlertTriangle, ChevronDown, ChevronUp, School,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useUsers } from '../../hooks/useUsers.js';
import { useToast } from '../ui/Toast.js';
import DatePicker from '../ui/DatePicker.js';

interface ParsedRow {
  rowIndex: number;
  title: string;
  eventTypeSlug: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  errors: string[];
  warnings: string[];
}

interface ScheduleImport {
  id: string;
  name: string;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
  targetUser: { id: string; name: string; nickname?: string | null; role: string };
  _count: { events: number };
}

const DAY_LABELS: Record<string, string> = {
  MO: 'Po', TU: 'Út', WE: 'St', TH: 'Čt', FR: 'Pá', SA: 'So', SU: 'Ne',
};

function StatusBadge({ row }: { row: ParsedRow }) {
  if (row.errors.length) {
    return (
      <span className="flex items-center gap-1 text-danger text-xs font-semibold">
        <AlertCircle size={12} />
        Chyba
      </span>
    );
  }
  if (row.warnings.length) {
    return (
      <span className="flex items-center gap-1 text-warning text-xs font-semibold">
        <AlertTriangle size={12} />
        Varování
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-success text-xs font-semibold">
      <CheckCircle2 size={12} />
      OK
    </span>
  );
}

export default function ScheduleImportAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: users = [] } = useUsers();
  const fileRef = useRef<HTMLInputElement>(null);

  const [targetUserId, setTargetUserId] = useState('');
  const [name, setName] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [csvText, setCsvText] = useState('');
  const [previewRows, setPreviewRows] = useState<ParsedRow[] | null>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  const { data: importsData } = useQuery<{ imports: ScheduleImport[] }>({
    queryKey: ['schedule-imports'],
    queryFn: () => api.get('/schedule-import'),
    staleTime: 30_000,
  });
  const imports = importsData?.imports ?? [];

  const preview = useMutation({
    mutationFn: (text: string) =>
      api.post<{ rows: ParsedRow[] }>('/schedule-import/preview', { csvText: text }),
    onSuccess: (data) => setPreviewRows(data.rows),
    onError: () => toast('❌ Náhled selhal', 'error'),
  });

  const commit = useMutation({
    mutationFn: (rows: ParsedRow[]) => {
      const body = { name, targetUserId, validFrom, validTo: validTo || undefined, rows };
      return replaceId
        ? api.put<{ importId: string; created: number }>(`/schedule-import/${replaceId}`, body)
        : api.post<{ importId: string; created: number }>('/schedule-import/commit', body);
    },
    onSuccess: (data) => {
      toast(`✅ Importováno ${data.created} událostí`, 'success');
      qc.invalidateQueries({ queryKey: ['schedule-imports'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      resetForm();
    },
    onError: () => toast('❌ Import selhal', 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/schedule-import/${id}`),
    onSuccess: () => {
      toast('🗑️ Rozvrh smazán', 'info');
      qc.invalidateQueries({ queryKey: ['schedule-imports'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });

  function resetForm() {
    setTargetUserId('');
    setName('');
    setValidFrom('');
    setValidTo('');
    setCsvText('');
    setPreviewRows(null);
    setReplaceId(null);
  }

  async function handleDownloadTemplate() {
    const res = await fetch('/api/schedule-import/template.csv', { credentials: 'include' });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rozvrh-sablona.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopyTemplate() {
    const res = await fetch('/api/schedule-import/template.csv', { credentials: 'include' });
    const text = await res.text();
    // Strip BOM if present
    const clean = text.startsWith('\uFEFF') ? text.slice(1) : text;
    await navigator.clipboard.writeText(clean);
    toast('📋 Šablona zkopírována', 'info');
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const clean = text.startsWith('\uFEFF') ? text.slice(1) : text;
      setCsvText(clean);
      setPreviewRows(null);
    };
    reader.readAsText(file, 'utf-8');
  }

  function openReplace(imp: ScheduleImport) {
    setReplaceId(imp.id);
    setName(imp.name);
    setTargetUserId(imp.targetUser.id);
    setValidFrom(imp.validFrom.slice(0, 10));
    setValidTo(imp.validTo?.slice(0, 10) ?? '');
    setCsvText('');
    setPreviewRows(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const hasErrors = previewRows?.some((r) => r.errors.length > 0) ?? false;
  const canCommit = previewRows && previewRows.length > 0 && !hasErrors && targetUserId && name && validFrom;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <School size={20} className="text-primary" />
        <h2 className="text-lg font-bold text-ink">Import školního rozvrhu</h2>
        {replaceId && (
          <span className="ml-auto text-xs bg-warning/10 text-warning font-semibold px-2 py-1 rounded-lg">
            Nahrazení existujícího rozvrhu
          </span>
        )}
      </div>

      {/* Form */}
      <div className="card p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="label">Název rozvrhu</label>
          <input
            className="input"
            placeholder="Škola 2026/2027"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Target user */}
        <div>
          <label className="label">Žák / uživatel</label>
          <select
            className="input"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
          >
            <option value="">— Vyberte uživatele —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nickname ? `${u.nickname} (${u.name})` : u.name} · {u.role}
              </option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Platí od</label>
            <DatePicker
              value={validFrom ?? ''}
              onChange={(d) => setValidFrom(d)}
            />
          </div>
          <div>
            <label className="label">Platí do (volitelné)</label>
            <DatePicker
              value={validTo ?? ''}
              onChange={(d) => setValidTo(d)}
            />
          </div>
        </div>

        {/* CSV area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">CSV dat</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Download size={12} /> Stáhnout šablonu
              </button>
              <button
                type="button"
                onClick={handleCopyTemplate}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Copy size={12} /> Kopírovat šablonu
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Upload size={12} /> Nahrát soubor
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
            </div>
          </div>
          <textarea
            className="input font-mono text-xs h-40 resize-y"
            placeholder="title,eventType,dayOfWeek,startTime,endTime,location,description&#10;Matematika,predmet-matematika,Po,08:00,08:45,Třída 5.A,"
            value={csvText}
            onChange={(e) => { setCsvText(e.target.value); setPreviewRows(null); }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => preview.mutate(csvText)}
            disabled={!csvText.trim() || preview.isPending}
            className="btn-secondary flex items-center gap-1.5 disabled:opacity-50"
          >
            <Eye size={16} /> Náhled
          </button>
          <button
            type="button"
            onClick={() => canCommit && commit.mutate(previewRows!)}
            disabled={!canCommit || commit.isPending}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            <Upload size={16} /> {replaceId ? 'Nahradit' : 'Importovat'}
          </button>
          {replaceId && (
            <button type="button" onClick={resetForm} className="btn-secondary">
              Zrušit
            </button>
          )}
        </div>
      </div>

      {/* Preview table */}
      {previewRows && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-ink">
              Náhled — {previewRows.length} řádků
              {hasErrors && <span className="ml-2 text-danger text-sm">({previewRows.filter((r) => r.errors.length).length} chyb)</span>}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-ink-muted">
                  <th className="pb-2 pr-3 text-left">#</th>
                  <th className="pb-2 pr-3 text-left">Název</th>
                  <th className="pb-2 pr-3 text-left">Den</th>
                  <th className="pb-2 pr-3 text-left">Od</th>
                  <th className="pb-2 pr-3 text-left">Do</th>
                  <th className="pb-2 pr-3 text-left">Místo</th>
                  <th className="pb-2 text-left">Stav</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <React.Fragment key={row.rowIndex}>
                    <tr
                      className={`border-b border-border/50 cursor-pointer ${
                        row.errors.length ? 'bg-danger/5' : row.warnings.length ? 'bg-warning/5' : ''
                      }`}
                      onClick={() => {
                        if (!row.errors.length && !row.warnings.length) return;
                        setExpandedErrors((s) => {
                          const n = new Set(s);
                          n.has(row.rowIndex) ? n.delete(row.rowIndex) : n.add(row.rowIndex);
                          return n;
                        });
                      }}
                    >
                      <td className="py-1.5 pr-3 text-ink-muted">{row.rowIndex}</td>
                      <td className="py-1.5 pr-3 font-medium text-ink">{row.title}</td>
                      <td className="py-1.5 pr-3">{DAY_LABELS[row.dayOfWeek] ?? row.dayOfWeek}</td>
                      <td className="py-1.5 pr-3">{row.startTime}</td>
                      <td className="py-1.5 pr-3">{row.endTime}</td>
                      <td className="py-1.5 pr-3 text-ink-muted truncate max-w-[100px]">{row.location || '—'}</td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1">
                          <StatusBadge row={row} />
                          {(row.errors.length > 0 || row.warnings.length > 0) && (
                            expandedErrors.has(row.rowIndex)
                              ? <ChevronUp size={12} className="text-ink-muted" />
                              : <ChevronDown size={12} className="text-ink-muted" />
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedErrors.has(row.rowIndex) && (
                      <tr>
                        <td colSpan={7} className="pb-2 pt-0">
                          <div className="ml-4 space-y-1">
                            {row.errors.map((e, i) => (
                              <p key={i} className="text-xs text-danger">❌ {e}</p>
                            ))}
                            {row.warnings.map((w, i) => (
                              <p key={i} className="text-xs text-warning">⚠️ {w}</p>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {hasErrors && (
            <p className="mt-3 text-sm text-danger font-medium">
              ⛔ Opravte červené řádky před importem.
            </p>
          )}
        </div>
      )}

      {/* Existing imports */}
      {imports.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-ink">Existující rozvrhy</h3>
          {imports.map((imp) => (
            <div key={imp.id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm truncate">{imp.name}</p>
                <p className="text-xs text-ink-muted">
                  {imp.targetUser.nickname ?? imp.targetUser.name} ·{' '}
                  {new Date(imp.validFrom).toLocaleDateString('cs-CZ')}
                  {imp.validTo ? ` – ${new Date(imp.validTo).toLocaleDateString('cs-CZ')}` : ' (bez konce)'} ·{' '}
                  {imp._count.events} událostí
                </p>
              </div>
              <button
                type="button"
                onClick={() => openReplace(imp)}
                className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                title="Nahradit"
              >
                <RefreshCw size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Smazat rozvrh "${imp.name}" a všechny jeho události?`)) {
                    remove.mutate(imp.id);
                  }
                }}
                className="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors"
                title="Smazat"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * FridgeBoard — family "fridge notes" board displayed on the Dashboard.
 * Any family member can post a sticky note. Author/admin can edit, delete, or pin.
 */
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  Pin, PinOff, Pencil, Trash2, Plus, X, Upload, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import Sheet from '../ui/Sheet.js';
import RichTextEditor from '../ui/RichTextEditor.js';
import Avatar from '../ui/Avatar.js';

interface FridgeNoteAuthor {
  id: string;
  name: string;
  nickname?: string | null;
  photoPath?: string | null;
  role: string;
}

interface FridgeNoteAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
}

interface FridgeNote {
  id: string;
  contentHtml: string;
  color: string | null;
  isPinned: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: FridgeNoteAuthor;
  attachments: FridgeNoteAttachment[];
}

const NOTE_COLORS = [
  { label: 'Žlutá', value: '#fef9c3', border: '#fbbf24' },
  { label: 'Zelená', value: '#dcfce7', border: '#4ade80' },
  { label: 'Modrá', value: '#dbeafe', border: '#60a5fa' },
  { label: 'Růžová', value: '#fce7f3', border: '#f472b6' },
  { label: 'Oranžová', value: '#ffedd5', border: '#fb923c' },
  { label: 'Bílá', value: null, border: null },
];

function useNotes() {
  return useQuery<{ notes: FridgeNote[] }>({
    queryKey: ['fridge-notes'],
    queryFn: () => api.get('/fridge-notes'),
    staleTime: 30_000,
  });
}

function timeAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: cs });
}

// ─── Single note card ──────────────────────────────────────────────────────

function NoteCard({
  note,
  onEdit,
}: { note: FridgeNote; onEdit: (note: FridgeNote) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);

  const isOwner = user?.id === note.author.id;
  const isAdmin = user?.role === 'PARENT';
  const canManage = isOwner || isAdmin;

  const bg = note.color ?? '#ffffff';
  const border = NOTE_COLORS.find((c) => c.value === note.color)?.border ?? '#e5e7eb';

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/fridge-notes/${note.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fridge-notes'] });
      toast('🗑️ Vzkaz smazán', 'info');
    },
  });

  const pinMutation = useMutation({
    mutationFn: () => api.patch(`/fridge-notes/${note.id}`, { isPinned: !note.isPinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fridge-notes'] }),
  });

  return (
    <div
      className="relative rounded-2xl shadow-md border-2 p-4 flex flex-col gap-2 transition-all hover:shadow-lg"
      style={{ background: bg, borderColor: border }}
    >
      {/* Pin ribbon */}
      {note.isPinned && (
        <div
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm"
          style={{ background: border ?? '#94a3b8' }}
        >
          <Pin size={13} className="text-white" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2">
        <Avatar name={note.author.name} size="xs" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-800 leading-tight truncate">
            {note.author.nickname ?? note.author.name}
          </p>
          <p className="text-[10px] text-gray-500">{timeAgo(note.createdAt)}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="p-1 rounded hover:bg-black/5 text-gray-400"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Content */}
      {expanded && (
        <div
          className="prose prose-sm max-w-none text-gray-800 break-words overflow-hidden"
          dangerouslySetInnerHTML={{ __html: note.contentHtml }}
        />
      )}

      {/* Attachments (images) */}
      {expanded && note.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {note.attachments.map((att) => (
            att.mimeType.startsWith('image/') ? (
              <img
                key={att.id}
                src={`/api/files/fridge-notes/${att.storageKey.split('/').pop()}`}
                alt={att.fileName}
                className="rounded-lg max-h-40 object-cover"
              />
            ) : (
              <a
                key={att.id}
                href={`/api/files/fridge-notes/${att.storageKey.split('/').pop()}`}
                className="text-xs text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                📎 {att.fileName}
              </a>
            )
          ))}
        </div>
      )}

      {/* Actions */}
      {canManage && (
        <div className="flex items-center gap-1 pt-1 border-t border-black/5 mt-auto">
          <button
            type="button"
            onClick={() => pinMutation.mutate()}
            className="p-1.5 rounded hover:bg-black/8 text-gray-500 transition-colors"
            title={note.isPinned ? 'Odepnout' : 'Připnout'}
          >
            {note.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button
            type="button"
            onClick={() => onEdit(note)}
            className="p-1.5 rounded hover:bg-black/8 text-gray-500 transition-colors"
            title="Upravit"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Smazat vzkaz?')) deleteMutation.mutate();
            }}
            className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-500 transition-colors"
            title="Smazat"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Compose / edit sheet ──────────────────────────────────────────────────

function ComposeSheet({
  open,
  onClose,
  editNote,
}: {
  open: boolean;
  onClose: () => void;
  editNote?: FridgeNote | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [html, setHtml] = useState(editNote?.contentHtml ?? '');
  const [color, setColor] = useState<string | null>(editNote?.color ?? null);
  const [newNoteId, setNewNoteId] = useState<string | null>(null);

  // Reset when the sheet opens/closes
  React.useEffect(() => {
    if (open) {
      setHtml(editNote?.contentHtml ?? '');
      setColor(editNote?.color ?? null);
      setNewNoteId(null);
    }
  }, [open, editNote]);

  const create = useMutation({
    mutationFn: () => api.post<{ note: FridgeNote }>('/fridge-notes', {
      contentHtml: html, color, // default expiry set server-side
    }),
    onSuccess: (data) => {
      setNewNoteId(data.note.id);
      qc.invalidateQueries({ queryKey: ['fridge-notes'] });
      toast('📝 Vzkaz přidán!', 'success');
    },
  });

  const update = useMutation({
    mutationFn: () => api.patch<{ note: FridgeNote }>(`/fridge-notes/${editNote!.id}`, {
      contentHtml: html, color,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fridge-notes'] });
      toast('✅ Vzkaz uložen', 'success');
      onClose();
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: (file: File) => {
      const id = editNote?.id ?? newNoteId;
      if (!id) throw new Error('No note ID');
      const fd = new FormData();
      fd.append('file', file);
      return fetch(`/api/fridge-notes/${id}/attachments`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      }).then((r) => r.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fridge-notes'] }),
    onError: () => toast('❌ Nahrání selhalo', 'error'),
  });

  const noteId = editNote?.id ?? newNoteId;
  const canAttach = !!noteId;

  const handleSave = () => {
    if (!html.trim() || html === '<p></p>') { toast('Zpráva nemůže být prázdná', 'warning'); return; }
    if (editNote) update.mutate();
    else create.mutate();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editNote ? 'Upravit vzkaz' : 'Nový vzkaz'}>
      <div className="space-y-4 p-4">
        {/* Color picker */}
        <div>
          <label className="label">Barva lístečku</label>
          <div className="flex gap-2 flex-wrap">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.value ?? 'white'}
                type="button"
                onClick={() => setColor(c.value)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  color === c.value ? 'ring-2 ring-primary ring-offset-1' : ''
                }`}
                style={{
                  background: c.value ?? '#ffffff',
                  borderColor: c.border ?? '#e5e7eb',
                }}
                title={c.label}
              />
            ))}
          </div>
        </div>

        {/* Rich text editor */}
        <div>
          <label className="label">Zpráva</label>
          <RichTextEditor
            value={html}
            onChange={setHtml}
            placeholder="Napište zprávu pro rodinu…"
            showGiphy
          />
        </div>

        {/* Attachment upload (only after note is saved and has an ID) */}
        {canAttach && (
          <div>
            <label className="label">Přílohy</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Upload size={14} /> Nahrát soubor
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAttachment.mutate(f);
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={create.isPending || update.isPending}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {editNote ? 'Uložit' : (create.isPending ? 'Ukládám…' : 'Přidat vzkaz')}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            <X size={16} />
          </button>
        </div>

        {/* Hint to attach after saving */}
        {!canAttach && (
          <p className="text-xs text-ink-muted">
            💡 Přílohy lze přidat po uložení vzkazku.
          </p>
        )}
      </div>
    </Sheet>
  );
}

// ─── FridgeBoard (main export) ─────────────────────────────────────────────

export default function FridgeBoard() {
  const { data, isLoading } = useNotes();
  const [composeOpen, setComposeOpen] = useState(false);
  const [editNote, setEditNote] = useState<FridgeNote | null>(null);

  const notes = data?.notes ?? [];

  if (isLoading) {
    return <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">📌</span>
          <h2 className="font-bold text-ink">Vzkazy na ledničce</h2>
          {notes.length > 0 && (
            <span className="text-xs bg-surface-raised text-ink-muted rounded-full px-2 py-0.5">{notes.length}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setEditNote(null); setComposeOpen(true); }}
          className="btn-primary text-sm flex items-center gap-1.5 py-1.5 px-3"
        >
          <Plus size={14} /> Napsat vzkaz
        </button>
      </div>

      {/* Notes grid */}
      {notes.length === 0 ? (
        <div className="text-center py-8 text-ink-muted">
          <p className="text-3xl mb-2">📝</p>
          <p className="text-sm">Žádné vzkazy. Napište první!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={(n) => { setEditNote(n); setComposeOpen(true); }}
            />
          ))}
        </div>
      )}

      {/* Compose / edit sheet */}
      <ComposeSheet
        open={composeOpen}
        onClose={() => { setComposeOpen(false); setEditNote(null); }}
        editNote={editNote}
      />
    </div>
  );
}

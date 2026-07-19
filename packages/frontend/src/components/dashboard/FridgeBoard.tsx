/**
 * FridgeBoard — family "fridge notes" board displayed on the Dashboard.
 * Any family member can post a sticky note, react with emoji, or reply.
 * Author/admin can edit, delete, or pin.
 */
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  Pin, PinOff, Pencil, Trash2, Plus, X, Upload,
  ChevronDown, ChevronUp, MessageCircle, Send,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../ui/Toast.js';
import Sheet from '../ui/Sheet.js';
import RichTextEditor from '../ui/RichTextEditor.js';
import Avatar from '../ui/Avatar.js';

interface NoteAuthor {
  id: string;
  name: string;
  nickname?: string | null;
  photoPath?: string | null;
  role: string;
}

interface NoteReaction {
  id: string;
  emoji: string;
  userId: string;
}

interface NoteReply {
  id: string;
  content: string;
  createdAt: string;
  author: NoteAuthor;
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
  author: NoteAuthor;
  attachments: FridgeNoteAttachment[];
  reactions: NoteReaction[];
  replies: NoteReply[];
}

const NOTE_COLORS = [
  { label: 'Žlutá',   value: '#fef9c3', border: '#fbbf24' },
  { label: 'Zelená',  value: '#dcfce7', border: '#4ade80' },
  { label: 'Modrá',   value: '#dbeafe', border: '#60a5fa' },
  { label: 'Růžová',  value: '#fce7f3', border: '#f472b6' },
  { label: 'Oranžová',value: '#ffedd5', border: '#fb923c' },
  { label: 'Bílá',    value: null,      border: null },
];

const QUICK_EMOJI = ['👍', '❤️', '😄', '😮', '😢', '🎉', '🙏', '👀'];

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

// ─── Reaction bar ──────────────────────────────────────────────────────────

function ReactionBar({ note }: { note: FridgeNote }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showPalette, setShowPalette] = useState(false);
  const myId = user?.id ?? '';

  const toggle = useMutation({
    mutationFn: (emoji: string) =>
      api.post(`/fridge-notes/${note.id}/reactions`, { emoji }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fridge-notes'] });
      setShowPalette(false);
    },
  });

  // Group reactions by emoji → { emoji, count, isMine }
  const grouped = note.reactions.reduce<Record<string, { count: number; isMine: boolean }>>(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { count: 0, isMine: false };
      acc[r.emoji]!.count += 1;
      if (r.userId === myId) acc[r.emoji]!.isMine = true;
      return acc;
    },
    {},
  );

  return (
    <div className="flex flex-wrap items-center gap-1 pt-1.5">
      {Object.entries(grouped).map(([emoji, { count, isMine }]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => toggle.mutate(emoji)}
          className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
            isMine
              ? 'bg-primary/15 border-primary/40 text-primary'
              : 'bg-black/5 border-transparent text-gray-600 hover:bg-black/10'
          }`}
          title={isMine ? 'Odebrat reakci' : 'Reagovat'}
        >
          <span>{emoji}</span>
          {count > 1 && <span className="ml-0.5">{count}</span>}
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPalette((v) => !v)}
          className="flex items-center px-1.5 py-0.5 rounded-full text-xs text-gray-400 hover:text-gray-600 hover:bg-black/8 border border-transparent hover:border-black/10 transition-colors"
          title="Přidat reakci"
        >
          + 😊
        </button>
        {showPalette && (
          <div className="absolute bottom-8 left-0 z-20 bg-white shadow-raised rounded-xl p-2 flex gap-1.5 border border-border">
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => toggle.mutate(e)}
                className="text-lg hover:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Replies thread ────────────────────────────────────────────────────────

function RepliesThread({ note }: { note: FridgeNote }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const count = note.replies.length;

  const addReply = useMutation({
    mutationFn: () => api.post(`/fridge-notes/${note.id}/replies`, { content: draft }),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['fridge-notes'] });
    },
    onError: () => toast('❌ Nepodařilo se odeslat', 'error'),
  });

  const deleteReply = useMutation({
    mutationFn: (replyId: string) => api.delete(`/fridge-notes/replies/${replyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fridge-notes'] }),
  });

  return (
    <div className="border-t border-black/8 pt-2 mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        <MessageCircle size={12} />
        {count === 0 ? 'Odpovědět' : `${count} odpověď${count > 4 ? 'í' : count > 1 ? 'i' : ''}`}
        {count > 0 && (open ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {note.replies.map((r) => (
            <div key={r.id} className="flex items-start gap-2 group">
              <Avatar name={r.author.name} size="xs" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-gray-700 leading-tight">
                  {r.author.nickname ?? r.author.name}
                  <span className="ml-1.5 font-normal text-gray-400">{timeAgo(r.createdAt)}</span>
                </p>
                <p className="text-xs text-gray-700 break-words">{r.content}</p>
              </div>
              {(r.author.id === user?.id || user?.role === 'PARENT') && (
                <button
                  type="button"
                  onClick={() => deleteReply.mutate(r.id)}
                  className="p-0.5 rounded hover:bg-red-100 text-red-400 transition-all shrink-0"
                  title="Smazat"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}

          {/* Reply input */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && draft.trim()) {
                  e.preventDefault();
                  addReply.mutate();
                }
              }}
              placeholder="Odpovědět…"
              className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={() => draft.trim() && addReply.mutate()}
              disabled={!draft.trim() || addReply.isPending}
              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

      {/* Reactions */}
      {expanded && <ReactionBar note={note} />}

      {/* Admin/owner actions */}
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

      {/* Replies */}
      {expanded && <RepliesThread note={note} />}
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

  React.useEffect(() => {
    if (open) {
      setHtml(editNote?.contentHtml ?? '');
      setColor(editNote?.color ?? null);
      setNewNoteId(null);
    }
  }, [open, editNote]);

  const create = useMutation({
    mutationFn: () => api.post<{ note: FridgeNote }>('/fridge-notes', {
      contentHtml: html, color,
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

        {/* Attachment upload (only after note is saved) */}
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
    <div className="card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
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
        <div className="text-center py-6 text-ink-muted">
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

      <ComposeSheet
        open={composeOpen}
        onClose={() => { setComposeOpen(false); setEditNote(null); }}
        editNote={editNote}
      />
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3,
  Link as LinkIcon, Image as ImageIcon, Youtube as YoutubeIcon,
  Undo, Redo, Quote, Minus, Smile, Gift,
} from 'lucide-react';
import { api } from '../../lib/api.js';

// ─── Curated emoji palette ──────────────────────────────────────────────────
const EMOJI_PALETTE = [
  '😊','😄','😂','🥰','😍','🤩','👍','👋','❤️','🎉',
  '🎂','🎁','🌟','⭐','✨','🔥','🏆','💪','🙌','👏',
  '🤔','😎','🥳','😅','🤗','🫶','👀','📅','📌','💬',
  '🚗','🚶','🏫','🏠','🌍','⚽','🏊','🎾','🎯','🎪',
  '🍕','🍰','☕','🧃','🥗','🍎','🌈','☀️','🌙','❄️',
  '✅','❌','⚠️','ℹ️','📢','💡','🔔','📱','💻','🗓️',
];

// ─── Giphy result type ──────────────────────────────────────────────────────
interface GiphyItem {
  id: string;
  images: { fixed_width_small: { url: string }; fixed_width: { url: string } };
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** If true, show the Giphy button (requires GIPHY_API_KEY configured on server) */
  showGiphy?: boolean;
}

export default function RichTextEditor({ value, onChange, placeholder, showGiphy = false }: Props) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  // Emoji popover
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Giphy popover
  const [showGiphyPanel, setShowGiphyPanel] = useState(false);
  const [giphyQuery, setGiphyQuery] = useState('');
  const [giphyResults, setGiphyResults] = useState<GiphyItem[]>([]);
  const [giphyLoading, setGiphyLoading] = useState(false);
  const giphyRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.configure({ allowBase64: true, inline: false }),
      Youtube.configure({ controls: true, nocookie: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Napište zprávu…' }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
      if (giphyRef.current && !giphyRef.current.contains(e.target as Node)) setShowGiphyPanel(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function searchGiphy(q: string) {
    if (!q.trim()) { setGiphyResults([]); return; }
    setGiphyLoading(true);
    try {
      const data = await api.get<{ results: GiphyItem[] }>(`/giphy/search?q=${encodeURIComponent(q)}&limit=20`);
      setGiphyResults(data.results ?? []);
    } catch {
      setGiphyResults([]);
    } finally {
      setGiphyLoading(false);
    }
  }

  if (!editor) return null;

  const ToolBtn = ({
    onClick, active, title, children,
  }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-primary text-white' : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
      }`}
    >
      {children}
    </button>
  );

  const applyLink = () => {
    if (linkUrl) editor.chain().focus().setLink({ href: linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}` }).run();
    setLinkUrl('');
    setShowLinkInput(false);
  };

  const insertYoutube = () => {
    if (youtubeUrl) editor.chain().focus().setYoutubeVideo({ src: youtubeUrl }).run();
    setYoutubeUrl('');
    setShowYoutubeInput(false);
  };

  const insertImage = () => {
    if (imageUrl) editor.chain().focus().setImage({ src: imageUrl }).run();
    setImageUrl('');
    setShowImageInput(false);
  };

  const insertEmoji = (emoji: string) => {
    editor.chain().focus().insertContent(emoji).run();
    setShowEmoji(false);
  };

  const insertGif = (gifUrl: string) => {
    editor.chain().focus().setImage({ src: gifUrl }).run();
    setShowGiphyPanel(false);
    setGiphyResults([]);
    setGiphyQuery('');
  };

  return (
    <div className="border border-border rounded-xl overflow-visible bg-surface">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-surface-raised rounded-t-xl">
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Zpět"><Undo size={15} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Znovu"><Redo size={15} /></ToolBtn>
        <span className="w-px h-5 bg-border mx-1" />

        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Nadpis 2"><Heading2 size={15} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Nadpis 3"><Heading3 size={15} /></ToolBtn>
        <span className="w-px h-5 bg-border mx-1" />

        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Tučně"><Bold size={15} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Kurzíva"><Italic size={15} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citát"><Quote size={15} /></ToolBtn>
        <span className="w-px h-5 bg-border mx-1" />

        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Seznam"><List size={15} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Číslovaný seznam"><ListOrdered size={15} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Oddělovač"><Minus size={15} /></ToolBtn>
        <span className="w-px h-5 bg-border mx-1" />

        {/* Link */}
        <ToolBtn onClick={() => setShowLinkInput((v) => !v)} active={editor.isActive('link') || showLinkInput} title="Odkaz"><LinkIcon size={15} /></ToolBtn>

        {/* Image URL */}
        <ToolBtn onClick={() => setShowImageInput((v) => !v)} active={showImageInput} title="Obrázek (URL)"><ImageIcon size={15} /></ToolBtn>

        {/* YouTube */}
        <ToolBtn onClick={() => setShowYoutubeInput((v) => !v)} active={showYoutubeInput} title="YouTube video"><YoutubeIcon size={15} /></ToolBtn>
        <span className="w-px h-5 bg-border mx-1" />

        {/* Emoji picker */}
        <div className="relative" ref={emojiRef}>
          <ToolBtn onClick={() => { setShowEmoji((v) => !v); setShowGiphyPanel(false); }} active={showEmoji} title="Emoji">
            <Smile size={15} />
          </ToolBtn>
          {showEmoji && (
            <div className="absolute bottom-full left-0 mb-1 z-50 bg-surface border border-border rounded-xl shadow-xl p-2 w-64">
              <div className="grid grid-cols-10 gap-0.5">
                {EMOJI_PALETTE.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    className="text-xl p-1 rounded hover:bg-surface-raised transition-colors leading-none"
                    title={e}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Giphy search */}
        {showGiphy && (
          <div className="relative" ref={giphyRef}>
            <ToolBtn
              onClick={() => { setShowGiphyPanel((v) => !v); setShowEmoji(false); }}
              active={showGiphyPanel}
              title="Vyhledat GIF (Giphy)"
            >
              <Gift size={15} />
            </ToolBtn>
            {showGiphyPanel && (
              <div className="absolute bottom-full left-0 mb-1 z-50 bg-surface border border-border rounded-xl shadow-xl p-3 w-72">
                <div className="flex gap-2 mb-2">
                  <input
                    autoFocus
                    className="flex-1 input text-sm py-1.5"
                    placeholder="Hledat GIF…"
                    value={giphyQuery}
                    onChange={(e) => setGiphyQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') searchGiphy(giphyQuery); }}
                  />
                  <button
                    type="button"
                    onClick={() => searchGiphy(giphyQuery)}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Hledat
                  </button>
                </div>
                {giphyLoading && <p className="text-xs text-ink-muted text-center py-2">Načítám…</p>}
                {!giphyLoading && giphyResults.length > 0 && (
                  <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto">
                    {giphyResults.map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        onClick={() => insertGif(gif.images.fixed_width.url)}
                        className="rounded overflow-hidden hover:ring-2 ring-primary transition-all"
                      >
                        <img
                          src={gif.images.fixed_width_small.url}
                          alt="gif"
                          className="w-full h-14 object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
                {!giphyLoading && giphyResults.length === 0 && giphyQuery && (
                  <p className="text-xs text-ink-muted text-center py-2">Žádné výsledky</p>
                )}
                <p className="text-[10px] text-ink-faint text-center mt-2">Powered by GIPHY</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline inputs */}
      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-raised text-sm">
          <LinkIcon size={14} className="text-ink-muted shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-ink placeholder-ink-faint"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
          />
          <button onClick={applyLink} className="text-xs font-semibold text-primary">Vložit</button>
          <button onClick={() => { editor.chain().focus().unsetLink().run(); setShowLinkInput(false); }} className="text-xs text-danger">Odebrat</button>
        </div>
      )}
      {showImageInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-raised text-sm">
          <ImageIcon size={14} className="text-ink-muted shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-ink placeholder-ink-faint"
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') insertImage(); if (e.key === 'Escape') setShowImageInput(false); }}
          />
          <button onClick={insertImage} className="text-xs font-semibold text-primary">Vložit</button>
        </div>
      )}
      {showYoutubeInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-raised text-sm">
          <YoutubeIcon size={14} className="text-ink-muted shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-ink placeholder-ink-faint"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') insertYoutube(); if (e.key === 'Escape') setShowYoutubeInput(false); }}
          />
          <button onClick={insertYoutube} className="text-xs font-semibold text-primary">Vložit</button>
        </div>
      )}

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="rich-editor min-h-40 px-4 py-3 text-sm text-ink focus-within:outline-none"
      />
    </div>
  );
}

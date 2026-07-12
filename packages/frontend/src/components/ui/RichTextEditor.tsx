import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3,
  Link as LinkIcon, Image as ImageIcon, Youtube as YoutubeIcon,
  Undo, Redo, Quote, Minus,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({ allowBase64: true, inline: false }),
      Youtube.configure({ controls: true, nocookie: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Napište zprávu…' }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

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
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}` }).run();
    }
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

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-surface-raised">
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

'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import type { RichNode } from './postStyle';
import { docToPlainText } from './RichTextRenderer';

/**
 * The Journal editor.
 *
 * TipTap was already a dependency (the community composer uses it), so this
 * adds no new package. It emits the ProseMirror DOCUMENT, not HTML: the
 * document is what gets stored and what RichTextRenderer walks through a
 * whitelist, which is what keeps a post body from becoming an XSS vector for
 * every reader.
 *
 * It also emits the plain text alongside, because the post's `text` column is
 * what search, feed previews, notifications and the server's hashtag
 * extractor all read.
 */

interface RichTextEditorProps {
  initialDoc?: RichNode;
  placeholder?: string;
  onChange: (value: { doc: RichNode; text: string }) => void;
  /** Inverts the toolbar for a dark card. */
  onDark?: boolean;
  className?: string;
}

function ToolButton({
  onClick,
  active,
  disabled,
  label,
  children,
  onDark,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
  onDark?: boolean;
}) {
  return (
    <button
      type="button"
      // The editor loses its selection on blur, and a button steals focus on
      // mousedown — before the click ever fires. Preventing the default there
      // is what makes "select a word, press Bold" work at all.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${
        active
          ? onDark
            ? 'bg-white/25 text-white'
            : 'bg-primary-tint text-primary-ink'
          : onDark
            ? 'text-white/70 hover:bg-white/15 hover:text-white'
            : 'text-brand-text/60 hover:bg-brand-secondary hover:text-brand-text'
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onDark }: { editor: Editor; onDark?: boolean }) {
  const setLink = () => {
    const previous = (editor.getAttributes('link').href as string) ?? '';
    const input = window.prompt('Link address', previous);
    if (input === null) return;
    const value = input.trim();
    if (!value) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    // Bare domains are the common case; assume https rather than refusing.
    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-0.5 border-b pb-2 ${
        onDark ? 'border-white/20' : 'border-brand-divider'
      }`}
    >
      <ToolButton onDark={onDark} label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>
      <ToolButton onDark={onDark} label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>
      <ToolButton onDark={onDark} label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>

      <span className={`mx-1 h-5 w-px ${onDark ? 'bg-white/20' : 'bg-brand-divider'}`} />

      <ToolButton onDark={onDark} label="Heading" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>
      <ToolButton onDark={onDark} label="Subheading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>

      <span className={`mx-1 h-5 w-px ${onDark ? 'bg-white/20' : 'bg-brand-divider'}`} />

      <ToolButton onDark={onDark} label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>
      <ToolButton onDark={onDark} label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>
      <ToolButton onDark={onDark} label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>
      <ToolButton onDark={onDark} label="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>
      <ToolButton onDark={onDark} label="Link" active={editor.isActive('link')} onClick={setLink}>
        <Link2 className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>

      <span className="flex-1" />

      <ToolButton onDark={onDark} label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>
      <ToolButton onDark={onDark} label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-4 w-4" strokeWidth={2.25} />
      </ToolButton>
    </div>
  );
}

export default function RichTextEditor({
  initialDoc,
  placeholder = 'Write your entry…',
  onChange,
  onDark,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    // Next renders this on the server too, and TipTap warns that SSR and the
    // first client render can disagree; rendering it only on the client is
    // what TipTap itself recommends for a controlled editor.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https'] }),
      Placeholder.configure({ placeholder }),
    ],
    // RichNode is deliberately looser than TipTap's JSONContent: it models a
    // document that ARRIVED FROM THE SERVER, where every field is optional
    // because nothing guarantees a well-formed one. TipTap parses defensively
    // and drops what it does not recognise, so handing it the loose shape is
    // safe. The cast marks the boundary between untrusted data and editor
    // input; it is not a claim that the document is valid.
    content: (initialDoc as JSONContent | undefined) ?? undefined,
    editorProps: {
      attributes: {
        class: 'outline-hidden min-h-[180px] leading-relaxed',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const doc = ed.getJSON() as RichNode;
      onChange({ doc, text: docToPlainText(doc) });
    },
  });

  // The placeholder depends on props and the extension is configured once.
  useEffect(() => {
    if (!editor) return;
    return () => { editor.destroy(); };
  }, [editor]);

  if (!editor) {
    return <div className={`min-h-[220px] ${className ?? ''}`} aria-busy="true" />;
  }

  return (
    <div className={className}>
      <Toolbar editor={editor} onDark={onDark} />
      <div className={`mt-3 text-[15px] ${onDark ? 'text-white' : 'text-brand-text'}`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

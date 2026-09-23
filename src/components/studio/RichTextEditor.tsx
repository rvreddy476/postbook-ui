'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Code,
  Code2,
  Highlighter,
  Italic,
  Link2,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import type { RichNode } from './postStyle';
import { docToPlainText } from './RichTextRenderer';

/**
 * The composer's editor.
 *
 * Laid out after the reference the founder shared: one quiet strip of small
 * monochrome controls — undo/redo, a block-type menu, the character marks,
 * alignment, code — above the writing surface. Nothing here is coloured;
 * colour in a toolbar competes with the words, which are the point.
 *
 * It emits the ProseMirror DOCUMENT, never HTML. The document is what gets
 * stored and what RichTextRenderer walks through a whitelist, which is what
 * keeps a post body from becoming an XSS vector for every reader. It emits
 * the plain text alongside, because the post's `text` column is what search,
 * feed previews, notifications and the server's hashtag extractor all read.
 */

interface RichTextEditorProps {
  initialDoc?: RichNode;
  placeholder?: string;
  onChange: (value: { doc: RichNode; text: string }) => void;
  className?: string;
  /** Rendered at the right end of the toolbar (the composer puts Post there). */
  toolbarEnd?: React.ReactNode;
}

function Tool({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // The editor loses its selection on blur and a button steals focus on
      // mousedown, before the click ever fires. Preventing the default there
      // is what makes "select a word, press Bold" work at all.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-25 ${
        active
          ? 'bg-brand-text/10 text-brand-text'
          : 'text-brand-text/55 hover:bg-brand-text/[0.06] hover:text-brand-text'
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-brand-divider" />;

/** The block-type menu — "Text" in the reference. */
const BLOCKS = [
  { id: 'paragraph', label: 'Text' },
  { id: 'h1', label: 'Heading 1' },
  { id: 'h2', label: 'Heading 2' },
  { id: 'h3', label: 'Heading 3' },
  { id: 'bulletList', label: 'Bulleted list' },
  { id: 'orderedList', label: 'Numbered list' },
  { id: 'blockquote', label: 'Quote' },
] as const;

function BlockMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const current =
    editor.isActive('heading', { level: 1 }) ? 'h1'
    : editor.isActive('heading', { level: 2 }) ? 'h2'
    : editor.isActive('heading', { level: 3 }) ? 'h3'
    : editor.isActive('bulletList') ? 'bulletList'
    : editor.isActive('orderedList') ? 'orderedList'
    : editor.isActive('blockquote') ? 'blockquote'
    : 'paragraph';

  const apply = (id: string) => {
    const chain = editor.chain().focus();
    // Leaving a list needs the list toggled off, not the paragraph set, or
    // the item stays a list item with paragraph content inside it.
    if (editor.isActive('bulletList') && id !== 'bulletList') chain.toggleBulletList();
    if (editor.isActive('orderedList') && id !== 'orderedList') chain.toggleOrderedList();
    switch (id) {
      case 'h1': chain.setHeading({ level: 1 }); break;
      case 'h2': chain.setHeading({ level: 2 }); break;
      case 'h3': chain.setHeading({ level: 3 }); break;
      case 'bulletList': chain.toggleBulletList(); break;
      case 'orderedList': chain.toggleOrderedList(); break;
      case 'blockquote': chain.toggleBlockquote(); break;
      default: chain.setParagraph(); break;
    }
    chain.run();
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-brand-text/70 transition-colors hover:bg-brand-text/[0.06] hover:text-brand-text"
      >
        {BLOCKS.find((b) => b.id === current)?.label ?? 'Text'}
        <ChevronDown className="h-3 w-3" strokeWidth={2} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-brand-divider bg-brand-card py-1 shadow-xl"
        >
          {BLOCKS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={current === b.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(b.id)}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] transition-colors ${
                current === b.id ? 'text-primary-ink' : 'text-brand-text hover:bg-brand-secondary'
              }`}
            >
              {b.label}
              {current === b.id && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, toolbarEnd }: { editor: Editor; toolbarEnd?: React.ReactNode }) {
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

  const aligns = [
    { value: 'left', Icon: AlignLeft, label: 'Align left' },
    { value: 'center', Icon: AlignCenter, label: 'Align centre' },
    { value: 'right', Icon: AlignRight, label: 'Align right' },
    { value: 'justify', Icon: AlignJustify, label: 'Justify' },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-brand-divider px-2 py-1.5">
      <Tool label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-4 w-4" strokeWidth={1.75} />
      </Tool>
      <Tool label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-4 w-4" strokeWidth={1.75} />
      </Tool>

      <Divider />
      <BlockMenu editor={editor} />
      <Divider />

      <Tool label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" strokeWidth={2} />
      </Tool>
      <Tool label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" strokeWidth={2} />
      </Tool>
      <Tool label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" strokeWidth={2} />
      </Tool>
      <Tool label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" strokeWidth={2} />
      </Tool>
      <Tool label="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-4 w-4" strokeWidth={1.75} />
      </Tool>
      <Tool label="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter className="h-4 w-4" strokeWidth={1.75} />
      </Tool>
      <Tool label="Link" active={editor.isActive('link')} onClick={setLink}>
        <Link2 className="h-4 w-4" strokeWidth={1.75} />
      </Tool>

      <Divider />

      {aligns.map(({ value, Icon, label }) => (
        <Tool
          key={value}
          label={label}
          active={editor.isActive({ textAlign: value })}
          onClick={() => editor.chain().focus().setTextAlign(value).run()}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </Tool>
      ))}

      <Divider />

      <Tool label="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 className="h-4 w-4" strokeWidth={1.75} />
      </Tool>

      {toolbarEnd && (
        <>
          <span className="flex-1" />
          {toolbarEnd}
        </>
      )}
    </div>
  );
}

export default function RichTextEditor({
  initialDoc,
  placeholder = 'Start writing…',
  onChange,
  className,
  toolbarEnd,
}: RichTextEditorProps) {
  const editor = useEditor({
    // Next renders this on the server too, and TipTap warns that SSR and the
    // first client render can disagree; client-only is what TipTap itself
    // recommends for a controlled editor.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https'] }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
    ],
    // RichNode is deliberately looser than TipTap's JSONContent: it models a
    // document that ARRIVED FROM THE SERVER, where every field is optional
    // because nothing guarantees a well-formed one. TipTap parses defensively
    // and drops what it does not recognise, so handing it the loose shape is
    // safe. The cast marks the boundary between untrusted data and editor
    // input; it is not a claim that the document is valid.
    content: (initialDoc as JSONContent | undefined) ?? undefined,
    editorProps: {
      attributes: { class: 'outline-hidden min-h-[160px] leading-relaxed' },
    },
    onUpdate: ({ editor: ed }) => {
      const doc = ed.getJSON() as RichNode;
      onChange({ doc, text: docToPlainText(doc) });
    },
  });

  useEffect(() => {
    if (!editor) return;
    return () => { editor.destroy(); };
  }, [editor]);

  if (!editor) {
    return <div className={`min-h-[220px] ${className ?? ''}`} aria-busy="true" />;
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-brand-divider bg-brand-card ${className ?? ''}`}>
      <Toolbar editor={editor} toolbarEnd={toolbarEnd} />
      <div className="px-4 py-3 text-[15px] text-brand-text">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

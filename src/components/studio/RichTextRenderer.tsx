import React from 'react';
import type { RichNode } from './postStyle';

/**
 * Renders a stored TipTap document.
 *
 * SAFETY IS THE POINT OF THIS FILE. A post body is written by somebody else,
 * so rendering it with dangerouslySetInnerHTML would hand every reader's
 * session to whoever wrote the post — and nothing stops a modified client
 * putting raw HTML into `rich_text`, which post-service stores verbatim as
 * arbitrary JSON.
 *
 * So the document is walked and rebuilt out of React elements from a fixed
 * whitelist of node and mark types. A node type that is not listed renders
 * its children as plain text; a mark that is not listed is dropped. Nothing
 * from the document ever becomes an attribute, a tag name or a style — the
 * single exception is a link's href, which is checked against http/https and
 * dropped otherwise, so `javascript:` cannot survive.
 *
 * (The app has two older places — QA answers and community posts — that do
 * render server HTML directly. They are a separate problem and are not made
 * worse by this file; they are worth closing on their own.)
 */

const SAFE_MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'code', 'link', 'superscript', 'subscript']);

const safeHref = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  // Relative links stay in the product; anything else must be http(s).
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

function applyMarks(text: string, marks: RichNode['marks'], key: React.Key): React.ReactNode {
  if (!marks || marks.length === 0) return text;
  let node: React.ReactNode = text;
  for (const mark of marks) {
    const type = mark?.type;
    if (!type || !SAFE_MARKS.has(type)) continue;
    switch (type) {
      case 'bold': node = <strong>{node}</strong>; break;
      case 'italic': node = <em>{node}</em>; break;
      case 'underline': node = <u>{node}</u>; break;
      case 'strike': node = <s>{node}</s>; break;
      case 'code': node = <code className="rounded bg-brand-text/10 px-1 py-0.5 text-[0.9em]">{node}</code>; break;
      case 'superscript': node = <sup>{node}</sup>; break;
      case 'subscript': node = <sub>{node}</sub>; break;
      case 'link': {
        const href = safeHref(mark.attrs?.href);
        node = href ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
            {node}
          </a>
        ) : (
          node
        );
        break;
      }
    }
  }
  return <React.Fragment key={key}>{node}</React.Fragment>;
}

function renderNodes(nodes: RichNode[] | undefined): React.ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => renderNode(node, i));
}

function renderNode(node: RichNode, key: React.Key): React.ReactNode {
  if (!node || typeof node !== 'object') return null;

  if (node.type === 'text') {
    return applyMarks(typeof node.text === 'string' ? node.text : '', node.marks, key);
  }

  switch (node.type) {
    case 'doc':
      return <React.Fragment key={key}>{renderNodes(node.content)}</React.Fragment>;
    case 'paragraph':
      return <p key={key} className="mb-3 last:mb-0">{renderNodes(node.content)}</p>;
    case 'heading': {
      // Only the levels the toolbar offers; anything else is a paragraph.
      const level = Number(node.attrs?.level);
      const cls = level === 1 ? 'text-[1.5em] font-bold' : 'text-[1.2em] font-semibold';
      const Tag = (level === 1 ? 'h2' : 'h3') as 'h2' | 'h3';
      return <Tag key={key} className={`mt-4 mb-2 first:mt-0 ${cls}`}>{renderNodes(node.content)}</Tag>;
    }
    case 'bulletList':
      return <ul key={key} className="mb-3 list-disc pl-5 last:mb-0">{renderNodes(node.content)}</ul>;
    case 'orderedList':
      return <ol key={key} className="mb-3 list-decimal pl-5 last:mb-0">{renderNodes(node.content)}</ol>;
    case 'listItem':
      return <li key={key} className="mb-1">{renderNodes(node.content)}</li>;
    case 'blockquote':
      return (
        <blockquote key={key} className="mb-3 border-l-[3px] border-current/30 pl-3 italic opacity-90 last:mb-0">
          {renderNodes(node.content)}
        </blockquote>
      );
    case 'codeBlock':
      return (
        <pre key={key} className="mb-3 overflow-x-auto rounded-lg bg-brand-text/10 p-3 text-[0.9em] last:mb-0">
          <code>{renderNodes(node.content)}</code>
        </pre>
      );
    case 'horizontalRule':
      return <hr key={key} className="my-4 border-current/20" />;
    case 'hardBreak':
      return <br key={key} />;
    default:
      // Unknown node: keep the words, drop the construct.
      return <React.Fragment key={key}>{renderNodes(node.content)}</React.Fragment>;
  }
}

export default function RichTextRenderer({
  doc,
  className,
}: {
  doc: RichNode | undefined;
  className?: string;
}) {
  if (!doc) return null;
  return <div className={className}>{renderNode(doc, 'root')}</div>;
}

/**
 * The document as plain text.
 *
 * The post's `text` column stays the plain version: it is what search
 * indexes, what a feed preview truncates, what a notification quotes and what
 * the hashtag extractor on the server reads. A rich post that wrote only the
 * document would be invisible to all four.
 */
export function docToPlainText(doc: RichNode | undefined): string {
  if (!doc) return '';
  // Blocks are separated by a newline. Without this every paragraph ran into
  // the next one, so a two-paragraph entry stored its plain text as one
  // word-joined string — and that string is what search indexes and what a
  // feed preview truncates.
  const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock']);
  const out: string[] = [];
  const walk = (node: RichNode) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'text' && typeof node.text === 'string') {
      out.push(node.text);
      return;
    }
    if (node.type === 'hardBreak') {
      out.push('\n');
      return;
    }
    node.content?.forEach(walk);
    if (BLOCKS.has(node.type ?? '')) out.push('\n');
  };
  walk(doc);
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

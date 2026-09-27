"use client";

import { Plus, X } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { newChapterRow, type ChapterDraft } from "../chaptersModel";
import { parseClock } from "../hubModel";
import "../hub.css";

/*
  The chapters editor: m:ss + title rows, Add and Remove. Controlled —
  the owner holds the rows and decides when to save (the hub edit sheet
  posts on its Save button; the upload studio posts after publish).
  Styled by hub.css (tokens only), so it looks the same in both places.
*/

export interface ChaptersEditorProps {
  rows: readonly ChapterDraft[];
  onChange: (rows: ChapterDraft[]) => void;
  /** Shown when there are no rows. */
  emptyHint?: string;
  /** Row keys to mark invalid on top of an unparsable time (the upload's stricter rule). */
  invalidKeys?: ReadonlySet<number>;
  /** Under the rows: the hub's Save button, or the upload's issues. */
  footer?: ReactNode;
}

export function ChaptersEditor({ rows, onChange, emptyHint, invalidKeys, footer }: ChaptersEditorProps) {
  const nextKey = useRef(1000);
  const update = (key: number, patch: Partial<ChapterDraft>) => onChange(rows.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  return (
    <div className="hub-elem" data-editor="chapters">
      <div className="hub-elem-head">
        <span>Chapters</span>
        <button type="button" className="hub-btn hub-btn-sm" onClick={() => onChange([...rows, newChapterRow(rows, nextKey.current++)])}>
          <Plus /> Add
        </button>
      </div>
      {rows.length === 0 && emptyHint ? <span className="hub-hint">{emptyHint}</span> : null}
      {rows.map((r, i) => (
        <div key={r.key} className="hub-elem-row">
          <input
            className="hub-input hub-input-sm"
            value={r.clock}
            placeholder="m:ss"
            aria-label={`Chapter ${i + 1} start`}
            onChange={(e) => update(r.key, { clock: e.target.value })}
            aria-invalid={parseClock(r.clock) === null || !!invalidKeys?.has(r.key)}
          />
          <input className="hub-input hub-input-sm" value={r.title} placeholder="Title" aria-label={`Chapter ${i + 1} title`} onChange={(e) => update(r.key, { title: e.target.value })} />
          <button type="button" className="hub-icon-btn" aria-label="Remove chapter" onClick={() => onChange(rows.filter((x) => x.key !== r.key))}>
            <X />
          </button>
        </div>
      ))}
      {footer}
    </div>
  );
}

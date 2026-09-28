"use client";

import { Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import { boxOf, boxStyle, isCircleKind, MAX_ELEMENT_W, MIN_ELEMENT_W, type EndScreenPosition } from "../../endScreenGeometry";
import {
  CARD_TYPE_LABEL,
  CARD_TYPE_OPTIONS,
  CARDS_KIDS_TEXT,
  END_SCREEN_BLOCK_TEXT,
  END_SCREEN_TEMPLATES,
  END_SCREEN_TYPE_LABEL,
  END_SCREEN_TYPE_OPTIONS,
  END_WINDOW_MS,
  LINK_TITLE_MAX,
  VIDEO_MODE_LABEL,
  VIDEO_MODE_OPTIONS,
  clickRateText,
  dragTo,
  elementLabel,
  newElement,
  nudge,
  secondsBeforeEnd,
  withTiming,
  withType,
  withVideoMode,
  withWidth,
  type EditorProblem,
  type EditorTargets,
  type EndScreenBlock,
} from "../endScreenEditor";
import {
  HUB_CARD_MAX,
  HUB_END_SCREEN_MAX,
  type HubCard,
  type HubChannelOption,
  type HubCollectionOption,
  type HubEndScreen,
  type HubLibraryRow,
} from "../hubApi";
import { formatMs, parseClock } from "../hubModel";
import { useChannelTargetSearch } from "../hooks/useHub";

/*
  The Elements tab's end-screen and cards editors (presentational: the
  sheet owns the rows, the reads and the saves).

  End screen: a 16:9 preview of the thumbnail where each element is a box
  you drag (pointer) or nudge (arrow keys), snapped to a 5 % grid and kept
  inside the frame; a strip under it shows each element's window in the
  last 20 seconds; the list below sets the type, the video mode, the
  target, the width and the timing, and shows the click rate. Templates
  lay out a whole screen. Problems are checked here the way the server
  checks them, so Save only goes out when it should pass.
*/

export interface EndScreenEditorProps {
  postId: string;
  thumbnailUrl: string;
  durationMs: number;
  block: EndScreenBlock | null;
  rows: HubEndScreen[];
  onChange: (rows: HubEndScreen[]) => void;
  /** Your other long videos (public or unlisted). */
  videos: readonly HubLibraryRow[];
  collections: readonly HubCollectionOption[];
  problems: readonly EditorProblem[];
  serverError: string | null;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}

export function EndScreenEditor({ postId, thumbnailUrl, durationMs, block, rows, onChange, videos, collections, problems, serverError, dirty, saving, onSave }: EndScreenEditorProps) {
  const [selected, setSelected] = useState(0);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const dragRef = useRef<{ index: number; from: EndScreenPosition; x: number; y: number; w: number; h: number } | null>(null);
  const targets: EditorTargets = { videoIds: videos.map((v) => v.id), collectionIds: collections.map((c) => c.id) };

  if (block) {
    return (
      <div className="hub-elem hub-es" data-end-screen-editor>
        <div className="hub-elem-head">
          <span>End screen</span>
        </div>
        <div className="hub-note" role="status" data-end-screen-block={block}>
          {END_SCREEN_BLOCK_TEXT[block]}
        </div>
      </div>
    );
  }

  const set = (i: number, next: HubEndScreen) => onChange(rows.map((r, j) => (j === i ? next : r)));
  const remove = (i: number) => {
    onChange(rows.filter((_, j) => j !== i));
    setSelected((s) => Math.max(0, s >= i ? s - 1 : s));
  };
  const add = () => {
    if (rows.length >= HUB_END_SCREEN_MAX) return;
    onChange([...rows, newElement("video", durationMs, rows, targets)]);
    setSelected(rows.length);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, i: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const r = frame.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { index: i, from: rows[i].position, x: e.clientX, y: e.clientY, w: r.width, h: r.height };
    setSelected(i);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const cur = rowsRef.current[d.index];
    if (!cur) return;
    const next = dragTo(cur, d.from, (e.clientX - d.x) / d.w, (e.clientY - d.y) / d.h);
    if (next.position.x !== cur.position.x || next.position.y !== cur.position.y) onChange(rowsRef.current.map((r, j) => (j === d.index ? next : r)));
  };
  const endDrag = () => {
    dragRef.current = null;
  };
  const onBoxKey = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = nudge(rows[i], e.key, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    set(i, next);
  };

  const windowStart = Math.max(0, durationMs - END_WINDOW_MS);
  const span = Math.max(1, durationMs - windowStart);
  const problemFor = (i: number) => problems.filter((p) => p.index === i);

  return (
    <div className="hub-elem hub-es" data-end-screen-editor>
      <div className="hub-elem-head">
        <span>End screen</span>
        <span className="hub-es-count">
          {rows.length}/{HUB_END_SCREEN_MAX}
        </span>
      </div>

      <div className="hub-es-templates" role="group" aria-label="Templates">
        {END_SCREEN_TEMPLATES.map((t) => (
          <button key={t.id} type="button" className="hub-es-btn" data-template={t.id} onClick={() => { onChange(t.build(durationMs, targets)); setSelected(0); }}>
            {t.label}
          </button>
        ))}
      </div>

      <div ref={frameRef} className="hub-es-frame" data-es-frame>
        {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="hub-es-poster" /> : null}
        {rows.map((r, i) => (
          <button
            key={r.id ?? `new-${i}`}
            type="button"
            className="hub-es-box"
            data-kind={isCircleKind(r.type) ? "circle" : "tile"}
            data-selected={selected === i ? "" : undefined}
            data-invalid={problemFor(i).length > 0 ? "" : undefined}
            style={boxStyle(boxOf(r.type, r.position))}
            aria-label={`${elementLabel(r, i)}. Drag, or use the arrow keys, to move it.`}
            aria-pressed={selected === i}
            onPointerDown={(e) => onPointerDown(e, i)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={(e) => onBoxKey(e, i)}
            onClick={() => setSelected(i)}
          >
            <span>{elementLabel(r, i)}</span>
          </button>
        ))}
        {rows.length === 0 ? <span className="hub-es-empty">Pick a template or add an element.</span> : null}
      </div>

      <div className="hub-es-timeline" aria-label="When each element shows (the last 20 seconds)">
        {rows.map((r, i) => {
          const left = Math.max(0, Math.min(100, ((r.start_ms - windowStart) / span) * 100));
          const right = Math.max(left, Math.min(100, ((r.end_ms - windowStart) / span) * 100));
          return (
            <div key={r.id ?? `t-${i}`} className="hub-es-track" data-selected={selected === i ? "" : undefined}>
              <span className="hub-es-track-label">{i + 1}</span>
              <span className="hub-es-track-rail">
                <span className="hub-es-track-bar" style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }} />
              </span>
            </div>
          );
        })}
        <div className="hub-es-scale" aria-hidden="true">
          <span>−20 s</span>
          <span>−10 s</span>
          <span>End {formatMs(durationMs)}</span>
        </div>
      </div>

      <ol className="hub-es-list">
        {rows.map((r, i) => (
          <li key={r.id ?? `row-${i}`} className="hub-es-row" data-selected={selected === i ? "" : undefined} onFocusCapture={() => setSelected(i)}>
            <div className="hub-es-row-head">
              <strong>{elementLabel(r, i)}</strong>
              {clickRateText(r.stats) ? <span className="hub-es-rate">{clickRateText(r.stats)}</span> : null}
              <button type="button" className="hub-es-icon" aria-label={`Remove element ${i + 1}`} onClick={() => remove(i)}>
                <X />
              </button>
            </div>
            <div className="hub-es-grid">
              <label className="hub-es-field">
                <span>Type</span>
                <select className="hub-es-control" value={r.type} onChange={(e) => set(i, withType(r, e.target.value as HubEndScreen["type"], targets))}>
                  {END_SCREEN_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {END_SCREEN_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              {r.type === "video" ? (
                <label className="hub-es-field">
                  <span>Which video</span>
                  <select className="hub-es-control" value={r.video_mode} onChange={(e) => set(i, withVideoMode(r, e.target.value as HubEndScreen["video_mode"], targets))}>
                    {VIDEO_MODE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {VIDEO_MODE_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <EndScreenTarget row={r} postId={postId} videos={videos} collections={collections} onChange={(next) => set(i, next)} />
              <label className="hub-es-field">
                <span>Width {Math.round(r.position.w * 100)}%</span>
                <input
                  type="range"
                  className="hub-es-range"
                  min={Math.round(MIN_ELEMENT_W * 100)}
                  max={Math.round(MAX_ELEMENT_W * 100)}
                  step={1}
                  value={Math.round(r.position.w * 100)}
                  onChange={(e) => set(i, withWidth(r, Number(e.target.value)))}
                />
              </label>
              <label className="hub-es-field">
                <span>Starts (s before end)</span>
                <input type="number" className="hub-es-control" min={5} max={20} step={0.5} value={secondsBeforeEnd(r.start_ms, durationMs)} onChange={(e) => set(i, withTiming(r, durationMs, "start", Number(e.target.value)))} />
              </label>
              <label className="hub-es-field">
                <span>Ends (s before end)</span>
                <input type="number" className="hub-es-control" min={0} max={15} step={0.5} value={secondsBeforeEnd(r.end_ms, durationMs)} onChange={(e) => set(i, withTiming(r, durationMs, "end", Number(e.target.value)))} />
              </label>
            </div>
            {problemFor(i).length > 0 ? (
              <ul className="hub-es-problems" role="alert">
                {problemFor(i).map((p) => (
                  <li key={p.message}>{p.message}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>

      {problems.some((p) => p.index === null) || serverError ? (
        <div className="hub-error" role="alert">
          {problems
            .filter((p) => p.index === null)
            .map((p) => (
              <div key={p.message}>{p.message}</div>
            ))}
          {serverError ? <div>{serverError}</div> : null}
        </div>
      ) : null}

      <div className="hub-es-foot">
        <button type="button" className="hub-es-btn" onClick={add} disabled={rows.length >= HUB_END_SCREEN_MAX}>
          <Plus aria-hidden="true" /> Add element
        </button>
        <button type="button" className="hub-es-btn is-primary" onClick={onSave} disabled={!dirty || saving || problems.length > 0} data-save-end-screen>
          {saving ? "Saving…" : rows.length === 0 ? "Save (no end screen)" : "Save end screen"}
        </button>
      </div>
    </div>
  );
}

/* ── target pickers ─────────────────────────────────────── */

function EndScreenTarget({ row, postId, videos, collections, onChange }: { row: HubEndScreen; postId: string; videos: readonly HubLibraryRow[]; collections: readonly HubCollectionOption[]; onChange: (next: HubEndScreen) => void }) {
  if (row.type === "video") {
    if (row.video_mode !== "specific") return <p className="hub-es-help">{row.video_mode === "latest" ? "Your newest public video, picked for each viewer." : "Your most-viewed public video."}</p>;
    return <VideoPicker value={row.target_id} label={row.target_label} postId={postId} videos={videos} onPick={(id) => onChange({ ...row, target_id: id, target_label: null })} />;
  }
  if (row.type === "playlist") {
    return <CollectionPicker value={row.target_id} label={row.target_label} collections={collections} onPick={(id) => onChange({ ...row, target_id: id, target_label: null })} />;
  }
  if (row.type === "channel") {
    return <ChannelPicker value={row.target_id} label={row.target_label} onPick={(c) => onChange({ ...row, target_id: c.user_id, target_label: c.name })} />;
  }
  if (row.type === "external_link") {
    return (
      <>
        <label className="hub-es-field is-wide">
          <span>Link (https://)</span>
          <input className="hub-es-control" type="url" inputMode="url" value={row.target_url ?? ""} placeholder="https://" onChange={(e) => onChange({ ...row, target_url: e.target.value || null })} />
        </label>
        <label className="hub-es-field is-wide">
          <span>Title (optional)</span>
          <input className="hub-es-control" value={row.title ?? ""} maxLength={LINK_TITLE_MAX} onChange={(e) => onChange({ ...row, title: e.target.value || null })} />
        </label>
      </>
    );
  }
  return <p className="hub-es-help">Your channel. Viewers subscribe right from the end screen.</p>;
}

function VideoPicker({ value, label, postId, videos, onPick }: { value: string | null; label: string | null; postId: string; videos: readonly HubLibraryRow[]; onPick: (id: string | null) => void }) {
  const options = videos.filter((v) => v.id !== postId);
  return (
    <label className="hub-es-field is-wide">
      <span>Video</span>
      <select className="hub-es-control" value={value ?? ""} onChange={(e) => onPick(e.target.value || null)}>
        <option value="">Choose a video</option>
        {options.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title}
          </option>
        ))}
        {value && !options.some((v) => v.id === value) ? <option value={value}>{label || "A video not loaded here"}</option> : null}
      </select>
    </label>
  );
}

function CollectionPicker({ value, label, collections, onPick }: { value: string | null; label: string | null; collections: readonly HubCollectionOption[]; onPick: (id: string | null) => void }) {
  return (
    <label className="hub-es-field is-wide">
      <span>Collection</span>
      <select className="hub-es-control" value={value ?? ""} onChange={(e) => onPick(e.target.value || null)}>
        <option value="">{collections.length ? "Choose a collection" : "No public collections yet"}</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
        {value && !collections.some((c) => c.id === value) ? <option value={value}>{label || "A collection not listed here"}</option> : null}
      </select>
    </label>
  );
}

function ChannelPicker({ value, label, onPick }: { value: string | null; label: string | null; onPick: (c: HubChannelOption) => void }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQ(text), 300);
    return () => clearTimeout(id);
  }, [text]);
  const search = useChannelTargetSearch(q);
  const results = search.data ?? [];
  return (
    <div className="hub-es-field is-wide">
      <span>Channel{value ? `: ${label || "picked"}` : ""}</span>
      <div className="hub-es-search">
        <Search aria-hidden="true" />
        <input className="hub-es-control" value={text} placeholder="Search channels" aria-label="Search channels" onChange={(e) => setText(e.target.value)} />
      </div>
      {q.trim().length >= 2 ? (
        <ul className="hub-es-results" role="listbox" aria-label="Channels">
          {search.isFetching && results.length === 0 ? <li className="hub-es-help">Searching…</li> : null}
          {!search.isFetching && results.length === 0 ? <li className="hub-es-help">No channels match.</li> : null}
          {results.map((c) => (
            <li key={c.user_id}>
              <button
                type="button"
                role="option"
                aria-selected={value === c.user_id}
                className="hub-es-result"
                onClick={() => {
                  onPick(c);
                  setText("");
                  setQ("");
                }}
              >
                <span className="hub-es-avatar">{c.avatar_url ? <img src={c.avatar_url} alt="" /> : (c.name[0] ?? "?").toUpperCase()}</span>
                <span className="hub-es-result-text">
                  <span>{c.name}</span>
                  {c.handle ? <small>@{c.handle}</small> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ── cards ──────────────────────────────────────────────── */

export interface CardsEditorProps {
  postId: string;
  durationMs: number;
  blocked: boolean;
  rows: HubCard[];
  onChange: (rows: HubCard[]) => void;
  videos: readonly HubLibraryRow[];
  collections: readonly HubCollectionOption[];
  problems: readonly EditorProblem[];
  serverError: string | null;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}

export function CardsEditor({ postId, durationMs, blocked, rows, onChange, videos, collections, problems, serverError, dirty, saving, onSave }: CardsEditorProps) {
  if (blocked) {
    return (
      <div className="hub-elem hub-es" data-cards-editor>
        <div className="hub-elem-head">
          <span>Cards</span>
        </div>
        <div className="hub-note" role="status" data-cards-block>
          {CARDS_KIDS_TEXT}
        </div>
      </div>
    );
  }

  const set = (i: number, patch: Partial<HubCard>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => {
    if (rows.length >= HUB_CARD_MAX) return;
    const v = videos.find((x) => x.id !== postId);
    onChange([...rows, { type: "video", target_id: v?.id ?? null, target_url: null, title: v?.title ?? "", teaser_text: null, appear_at_ms: Math.min(durationMs, 30_000), stats: null, target_label: null }]);
  };
  const problemFor = (i: number) => problems.filter((p) => p.index === i);

  return (
    <div className="hub-elem hub-es" data-cards-editor>
      <div className="hub-elem-head">
        <span>Cards</span>
        <span className="hub-es-count">
          {rows.length}/{HUB_CARD_MAX}
        </span>
      </div>
      {rows.length === 0 ? <p className="hub-es-help">A small card that appears at a moment in the video, pointing at another video, a collection or a link.</p> : null}
      <ol className="hub-es-list">
        {rows.map((c, i) => (
          <li key={c.id ?? `card-${i}`} className="hub-es-row">
            <div className="hub-es-row-head">
              <strong>
                {i + 1}. {CARD_TYPE_LABEL[c.type]}
              </strong>
              {clickRateText(c.stats) ? <span className="hub-es-rate">{clickRateText(c.stats)}</span> : null}
              <button type="button" className="hub-es-icon" aria-label={`Remove card ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <X />
              </button>
            </div>
            <div className="hub-es-grid">
              <label className="hub-es-field">
                <span>Type</span>
                <select className="hub-es-control" value={c.type} onChange={(e) => set(i, { type: e.target.value as HubCard["type"], target_id: null, target_url: null, target_label: null })}>
                  {CARD_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {CARD_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hub-es-field">
                <span>Appears at (m:ss)</span>
                <ClockInput ms={c.appear_at_ms} max={durationMs} onCommit={(ms) => set(i, { appear_at_ms: ms })} />
              </label>
              {c.type === "video" ? (
                <VideoPicker value={c.target_id} label={c.target_label ?? null} postId={postId} videos={videos} onPick={(id) => set(i, { target_id: id, target_label: null, title: c.title || videos.find((v) => v.id === id)?.title || "" })} />
              ) : c.type === "playlist" ? (
                <CollectionPicker value={c.target_id} label={c.target_label ?? null} collections={collections} onPick={(id) => set(i, { target_id: id, target_label: null, title: c.title || collections.find((x) => x.id === id)?.title || "" })} />
              ) : c.type === "external_link" ? (
                <label className="hub-es-field is-wide">
                  <span>Link (https://)</span>
                  <input className="hub-es-control" type="url" inputMode="url" value={c.target_url ?? ""} placeholder="https://" onChange={(e) => set(i, { target_url: e.target.value || null })} />
                </label>
              ) : (
                <label className="hub-es-field is-wide">
                  <span>Poll id</span>
                  <input className="hub-es-control" value={c.target_id ?? ""} onChange={(e) => set(i, { target_id: e.target.value || null })} />
                </label>
              )}
              <label className="hub-es-field is-wide">
                <span>Title</span>
                <input className="hub-es-control" value={c.title} maxLength={100} aria-invalid={c.title.trim() === ""} onChange={(e) => set(i, { title: e.target.value })} />
              </label>
              <label className="hub-es-field is-wide">
                <span>Teaser (optional)</span>
                <input className="hub-es-control" value={c.teaser_text ?? ""} maxLength={60} placeholder="Shown for 5 seconds at that moment" onChange={(e) => set(i, { teaser_text: e.target.value || null })} />
              </label>
            </div>
            {problemFor(i).length > 0 ? (
              <ul className="hub-es-problems" role="alert">
                {problemFor(i).map((p) => (
                  <li key={p.message}>{p.message}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      {problems.some((p) => p.index === null) || serverError ? (
        <div className="hub-error" role="alert">
          {problems
            .filter((p) => p.index === null)
            .map((p) => (
              <div key={p.message}>{p.message}</div>
            ))}
          {serverError ? <div>{serverError}</div> : null}
        </div>
      ) : null}
      <div className="hub-es-foot">
        <button type="button" className="hub-es-btn" onClick={add} disabled={rows.length >= HUB_CARD_MAX}>
          <Plus aria-hidden="true" /> Add card
        </button>
        <button type="button" className="hub-es-btn is-primary" onClick={onSave} disabled={!dirty || saving || problems.length > 0} data-save-cards>
          {saving ? "Saving…" : "Save cards"}
        </button>
      </div>
    </div>
  );
}

/** m:ss typed freely; committed on blur or Enter (a half-typed time never jumps the value). */
function ClockInput({ ms, max, onCommit }: { ms: number; max: number; onCommit: (ms: number) => void }) {
  const [text, setText] = useState(formatMs(ms));
  useEffect(() => setText(formatMs(ms)), [ms]);
  const commit = () => {
    const parsed = parseClock(text);
    if (parsed === null) {
      setText(formatMs(ms));
      return;
    }
    const next = max > 0 ? Math.min(parsed, max) : parsed;
    onCommit(next);
    setText(formatMs(next));
  };
  return (
    <input
      className="hub-es-control"
      value={text}
      inputMode="numeric"
      placeholder="m:ss"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}

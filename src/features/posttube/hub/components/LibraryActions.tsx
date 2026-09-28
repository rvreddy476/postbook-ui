"use client";

import Link from "next/link";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  Download,
  Eye,
  FolderPlus,
  Link2,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { downloadHref, watchHref, type HubBulkPatch, type HubCategory, type HubLibraryRow, type HubTagsMode, type HubVisibility } from "../hubApi";
import {
  BULK_FIELDS,
  LIBRARY_FILTER_FIELDS,
  TAGS_MODE_LABEL,
  VISIBILITY_LABEL,
  activeFilterChips,
  buildBulkPatch,
  clearFilterKey,
  parseViewsInput,
  type BulkFailure,
  type BulkFieldKey,
  type LibraryFilter,
  type LibraryFilterKey,
  type TriState,
} from "../hubModel";
import { PUBLISH_LANGUAGES } from "../publishDefaults";
import { VisibilityIcon, useAnchoredMenu, useDismiss } from "./Pills";

/*
  The Library table's action surfaces, presentational (no queries), so the
  tests render them with renderToStaticMarkup:
    RowHoverActions  Edit · Insights · Conversations · View · ⋯ (Copy link, Keep a copy, Delete forever)
    BulkBar          "N selected (Select all M)" · Edit ▾ · Add to collection ▾ · More actions ▾
    FilterMenu       Filter ▾ → one field at a time, Apply
    FilterChips      one chip per active filter, ✕ clears it
    VisibilityPanel  Private / Unlisted / Public, Schedule, Share privately, Cancel / Save
  Every menu that is a list of actions is in ascending alphabetical order,
  with a destructive item last under a divider.
*/

/* ── A button that opens a fixed panel under it ─────────── */

function DropButton({
  label,
  icon,
  children,
  align = "left",
  width = 240,
  height = 320,
  defaultOpen = false,
  disabled = false,
  panelLabel,
}: {
  label: ReactNode;
  icon?: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: number;
  height?: number;
  defaultOpen?: boolean;
  disabled?: boolean;
  panelLabel: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const close = () => setOpen(false);
  const ref = useDismiss(open, close, { form: true });
  const { buttonRef, style } = useAnchoredMenu(open, align, { width, height });
  return (
    <div className="hub-vis" ref={ref}>
      <button ref={buttonRef} type="button" className="hub-btn hub-btn-sm" aria-haspopup="true" aria-expanded={open} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        {icon}
        {label}
        <ChevronDown aria-hidden="true" style={{ opacity: 0.6 }} />
      </button>
      {open ? (
        <div className="hub-pop" style={{ ...style, width }} role="dialog" aria-label={panelLabel}>
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}

/* ── Row hover actions ──────────────────────────────────── */

export interface RowHoverActionsProps {
  row: HubLibraryRow;
  onEdit: (row: HubLibraryRow) => void;
  onCopyLink: (row: HubLibraryRow) => void;
  onDelete: (row: HubLibraryRow) => void;
  /** Render the ⋯ menu open (tests). */
  defaultMenuOpen?: boolean;
}

/**
  The icons under a row's title: hidden until the row is hovered or
  anything in it has focus (hub.css), always shown on touch widths. The
  owner can always keep a copy of their own file, so Keep a copy only
  needs a video asset.
*/
export function RowHoverActions({ row, onEdit, onCopyLink, onDelete, defaultMenuOpen = false }: RowHoverActionsProps) {
  const [open, setOpen] = useState(defaultMenuOpen);
  const close = () => setOpen(false);
  const ref = useDismiss(open, close);
  const { buttonRef, style } = useAnchoredMenu(open, "left", { width: 180, height: 140 });
  return (
    <div className={`hub-row-actions${open ? " is-open" : ""}`} role="group" aria-label={`Actions for ${row.title}`}>
      <button type="button" className="hub-icon-btn" aria-label="Edit" title="Edit" data-row-action="edit" onClick={() => onEdit(row)}>
        <Pencil />
      </button>
      <Link href={`/posttube/hub/insights/${row.id}`} className="hub-icon-btn" aria-label="Insights" title="Insights" data-row-action="insights">
        <BarChart3 />
      </Link>
      <Link href={`/posttube/hub/conversations?post=${row.id}`} className="hub-icon-btn" aria-label="Conversations" title="Conversations" data-row-action="conversations">
        <MessageSquareText />
      </Link>
      <Link href={watchHref(row)} className="hub-icon-btn" aria-label="View" title="View" data-row-action="view">
        <Eye />
      </Link>
      <div className="hub-vis" ref={ref}>
        <button ref={buttonRef} type="button" className="hub-icon-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`More for ${row.title}`} title="More" data-row-action="more" onClick={() => setOpen((o) => !o)}>
          <MoreHorizontal />
        </button>
        {open ? (
          <div className="hub-menu" style={style} role="menu">
            <button type="button" role="menuitem" className="hub-menu-item" onClick={() => { close(); onCopyLink(row); }}>
              <Link2 /> Copy link
            </button>
            {row.media_id ? (
              // GET /v1/media/:id/download — a 307 to the signed file; the owner is always allowed.
              <a role="menuitem" className="hub-menu-item" href={downloadHref(row.media_id)} target="_blank" rel="noopener noreferrer" onClick={close}>
                <Download /> Keep a copy
              </a>
            ) : null}
            <div className="hub-menu-sep" role="separator" />
            <button type="button" role="menuitem" className="hub-menu-item is-danger" onClick={() => { close(); onDelete(row); }}>
              <Trash2 /> Delete forever
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Bulk bar ───────────────────────────────────────────── */

export interface BulkCollection {
  id: string;
  title: string;
}

export interface BulkBarProps {
  count: number;
  /** Rows the current filter shows (what Select all ticks). */
  total: number;
  /** Every shown row is ticked (defaults to count ≥ total). */
  allSelected?: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  pending?: boolean;
  topics: HubCategory[];
  /** null = still loading. */
  collections: BulkCollection[] | null;
  onApplyEdit: (patch: HubBulkPatch, fieldLabel: string) => void;
  onAddToCollection: (collection: BulkCollection) => void;
  /** How many ticked rows have a file to keep. */
  downloadable: number;
  onDownload: () => void;
  onDeleteForever: () => void;
  failures?: BulkFailure[];
  onDismissFailures?: () => void;
  /** Tests: render a menu open, or the Edit panel on one field. */
  defaultOpen?: "edit" | "collection" | "more";
  defaultField?: BulkFieldKey;
}

export function BulkBar({
  count,
  total,
  allSelected,
  onSelectAll,
  onClear,
  pending = false,
  topics,
  collections,
  onApplyEdit,
  onAddToCollection,
  downloadable,
  onDownload,
  onDeleteForever,
  failures = [],
  onDismissFailures,
  defaultOpen,
  defaultField,
}: BulkBarProps) {
  const sortedCollections = collections ? [...collections].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" })) : null;
  return (
    <>
      <div className="hub-bulk" role="region" aria-label="Bulk actions">
        <strong>{count} selected</strong>
        {!(allSelected ?? count >= total) ? (
          <button type="button" className="hub-link hub-link-btn" onClick={onSelectAll} title={`Select all ${total} shown`}>
            (Select all)
          </button>
        ) : null}
        <DropButton label="Edit" icon={<Pencil />} panelLabel="Edit the selected videos" width={280} height={360} defaultOpen={defaultOpen === "edit"} disabled={pending}>
          {(close) => <BulkEditPanel topics={topics} defaultField={defaultField} onApply={(patch, label) => { close(); onApplyEdit(patch, label); }} />}
        </DropButton>
        <DropButton label="Add to collection" icon={<FolderPlus />} panelLabel="Add to a collection" width={240} height={300} defaultOpen={defaultOpen === "collection"} disabled={pending}>
          {(close) =>
            sortedCollections === null ? (
              <div className="hub-pop-body">
                <span className="hub-hint">Loading collections…</span>
              </div>
            ) : sortedCollections.length === 0 ? (
              <div className="hub-pop-body">
                <span className="hub-hint">You have no collections yet.</span>
                <Link href="/posttube/playlists" className="hub-link">
                  Open collections
                </Link>
              </div>
            ) : (
              <div className="hub-pop-list" role="menu">
                {sortedCollections.map((c) => (
                  <button key={c.id} type="button" role="menuitem" className="hub-menu-item" onClick={() => { close(); onAddToCollection(c); }}>
                    <FolderPlus /> {c.title}
                  </button>
                ))}
              </div>
            )
          }
        </DropButton>
        <DropButton label="More actions" icon={<MoreHorizontal />} panelLabel="More actions" width={200} height={120} defaultOpen={defaultOpen === "more"} disabled={pending}>
          {(close) => (
            <div role="menu">
              <button type="button" role="menuitem" className="hub-menu-item" disabled={downloadable === 0} onClick={() => { close(); onDownload(); }}>
                <Download /> Keep a copy{downloadable > 0 && downloadable < count ? ` (${downloadable})` : ""}
              </button>
              <div className="hub-menu-sep" role="separator" />
              <button type="button" role="menuitem" className="hub-menu-item is-danger" onClick={() => { close(); onDeleteForever(); }}>
                <Trash2 /> Delete forever
              </button>
            </div>
          )}
        </DropButton>
        {pending ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
        <button type="button" className="hub-btn hub-btn-sm" style={{ marginLeft: "auto" }} onClick={onClear}>
          Clear
        </button>
      </div>
      {failures.length > 0 ? (
        <div className="hub-error hub-bulk-failures" role="alert">
          <div className="hub-row" style={{ justifyContent: "space-between" }}>
            <strong>{failures.length === 1 ? "1 video was not changed" : `${failures.length} videos were not changed`}</strong>
            {onDismissFailures ? (
              <button type="button" className="hub-icon-btn" aria-label="Dismiss" onClick={onDismissFailures}>
                <X />
              </button>
            ) : null}
          </div>
          <ul>
            {failures.map((f) => (
              <li key={f.id}>
                <span className="hub-bulk-failure-title">{f.title}</span>: {f.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/** Pick one contract C field, choose its value, Apply. */
export function BulkEditPanel({ topics, onApply, defaultField }: { topics: HubCategory[]; onApply: (patch: HubBulkPatch, fieldLabel: string) => void; defaultField?: BulkFieldKey }) {
  const [fieldKey, setFieldKey] = useState<BulkFieldKey | null>(defaultField ?? null);
  const [value, setValue] = useState("");
  const [tagsMode, setTagsMode] = useState<HubTagsMode>("add");
  const [touched, setTouched] = useState(false);
  const field = BULK_FIELDS.find((f) => f.key === fieldKey) ?? null;

  if (!field) {
    return (
      <div className="hub-pop-list" role="menu" aria-label="Pick a setting">
        {BULK_FIELDS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="menuitem"
            className="hub-menu-item"
            data-bulk-field={f.key}
            onClick={() => {
              setFieldKey(f.key);
              setValue("");
              setTagsMode("add");
              setTouched(false);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
    );
  }

  // A date must be picked; a topic or language must be chosen on purpose ("Not set" clears it, so never by default).
  const patch = (field.kind === "date" && !value) || ((field.kind === "topic" || field.kind === "language") && !touched) ? null : buildBulkPatch(field.key, value, tagsMode);
  const name = `bulk-${field.key}`;
  return (
    <div className="hub-pop-body">
      <button type="button" className="hub-menu-item" onClick={() => setFieldKey(null)}>
        <ChevronLeft /> {field.label}
      </button>
      {field.kind === "bool" || field.kind === "choice" ? (
        <div className="hub-radios" role="radiogroup" aria-label={field.label}>
          {(field.options ?? []).map((o) => (
            <label key={o.value} className="hub-radio">
              <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => setValue(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      ) : field.kind === "date" ? (
        <input type="date" className="hub-input" aria-label={field.label} value={value} onChange={(e) => setValue(e.target.value)} />
      ) : field.kind === "topic" ? (
        <select className="hub-select" aria-label="Topic" value={touched ? value : "__pick"} onChange={(e) => { setTouched(true); setValue(e.target.value); }}>
          <option value="__pick" disabled>
            Pick a topic
          </option>
          <option value="">Not set</option>
          {topics.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.label}
            </option>
          ))}
        </select>
      ) : field.kind === "language" ? (
        <select className="hub-select" aria-label="Language" value={touched ? value : "__pick"} onChange={(e) => { setTouched(true); setValue(e.target.value); }}>
          <option value="__pick" disabled>
            Pick a language
          </option>
          {PUBLISH_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      ) : (
        <>
          <div className="hub-pill-group" role="radiogroup" aria-label="How to apply the tags">
            {(["add", "replace", "remove"] as const).map((m) => (
              <button key={m} type="button" role="radio" className="hub-pill" aria-checked={tagsMode === m} aria-pressed={tagsMode === m} onClick={() => setTagsMode(m)}>
                {TAGS_MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <input className="hub-input" aria-label="Tags" placeholder="comma separated" value={value} onChange={(e) => setValue(e.target.value)} />
          <span className="hub-hint">
            {tagsMode === "add" ? "Added to each video's tags." : tagsMode === "replace" ? "Each video's tags become exactly these." : "Taken off each video that has them."}
          </span>
        </>
      )}
      <div className="hub-pop-foot">
        <button type="button" className="hub-btn hub-btn-primary" disabled={!patch} onClick={() => patch && onApply(patch, field.label)}>
          Apply
        </button>
      </div>
    </div>
  );
}

/* ── Filters ────────────────────────────────────────────── */

export function FilterMenu({ filter, onChange, defaultOpen = false, defaultKey }: { filter: LibraryFilter; onChange: (next: LibraryFilter) => void; defaultOpen?: boolean; defaultKey?: LibraryFilterKey }) {
  return (
    <DropButton label="Filter" icon={<SlidersHorizontal />} panelLabel="Filter the table" width={260} height={300} defaultOpen={defaultOpen}>
      {(close) => <FilterPanel filter={filter} defaultKey={defaultKey} onApply={(next) => { close(); onChange(next); }} />}
    </DropButton>
  );
}

function FilterPanel({ filter, onApply, defaultKey }: { filter: LibraryFilter; onApply: (next: LibraryFilter) => void; defaultKey?: LibraryFilterKey }) {
  const [key, setKey] = useState<LibraryFilterKey | null>(defaultKey ?? null);
  const [text, setText] = useState("");
  const [vis, setVis] = useState<LibraryFilter["visibility"]>(filter.visibility);
  const [tri, setTri] = useState<TriState>("any");
  const [minText, setMinText] = useState(filter.viewsMin != null ? String(filter.viewsMin) : "");
  const [maxText, setMaxText] = useState(filter.viewsMax != null ? String(filter.viewsMax) : "");

  const choose = (k: LibraryFilterKey) => {
    setKey(k);
    if (k === "title") setText(filter.title);
    if (k === "description") setText(filter.description ?? "");
    if (k === "madeForKids") setTri(filter.madeForKids ?? "any");
    if (k === "ageRestricted") setTri(filter.ageRestricted ?? "any");
  };

  if (!key) {
    return (
      <div className="hub-pop-list" role="menu" aria-label="Filter by">
        {LIBRARY_FILTER_FIELDS.map((f) => (
          <button key={f.key} type="button" role="menuitem" className="hub-menu-item" data-filter-field={f.key} onClick={() => choose(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
    );
  }

  const label = LIBRARY_FILTER_FIELDS.find((f) => f.key === key)?.label ?? "";
  const min = parseViewsInput(minText);
  const max = parseViewsInput(maxText);
  const viewsBad = (minText.trim() !== "" && min === null) || (maxText.trim() !== "" && max === null) || (min !== null && max !== null && min > max);

  const apply = () => {
    switch (key) {
      case "title":
        return onApply({ ...filter, title: text });
      case "description":
        return onApply({ ...filter, description: text });
      case "visibility":
        return onApply({ ...filter, visibility: vis });
      case "madeForKids":
        return onApply({ ...filter, madeForKids: tri });
      case "ageRestricted":
        return onApply({ ...filter, ageRestricted: tri });
      case "views":
        return onApply({ ...filter, viewsMin: min, viewsMax: max });
    }
  };

  return (
    <div className="hub-pop-body">
      <button type="button" className="hub-menu-item" onClick={() => setKey(null)}>
        <ChevronLeft /> {label}
      </button>
      {key === "title" || key === "description" ? (
        <input className="hub-input" aria-label={label} placeholder={key === "title" ? "Title contains" : "Description contains"} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} />
      ) : key === "visibility" ? (
        <div className="hub-radios" role="radiogroup" aria-label="Visibility">
          {(["all", "private", "public", "scheduled", "unlisted"] as const).map((v) => (
            <label key={v} className="hub-radio">
              <input type="radio" name="filter-vis" checked={vis === v} onChange={() => setVis(v)} />
              <span>{v === "all" ? "Any" : VISIBILITY_LABEL[v as HubVisibility]}</span>
            </label>
          ))}
        </div>
      ) : key === "madeForKids" || key === "ageRestricted" ? (
        <div className="hub-radios" role="radiogroup" aria-label={label}>
          {(["any", "yes", "no"] as const).map((v) => (
            <label key={v} className="hub-radio">
              <input type="radio" name={`filter-${key}`} checked={tri === v} onChange={() => setTri(v)} />
              <span>{v === "any" ? "Any" : v === "yes" ? "Yes" : "No"}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="hub-grid hub-grid-2" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <input className="hub-input" inputMode="numeric" aria-label="Views at least" placeholder="Min" value={minText} onChange={(e) => setMinText(e.target.value)} />
          <input className="hub-input" inputMode="numeric" aria-label="Views at most" placeholder="Max" value={maxText} onChange={(e) => setMaxText(e.target.value)} />
        </div>
      )}
      {key === "views" && viewsBad ? <span className="hub-hint is-error">Whole numbers, and the minimum no bigger than the maximum.</span> : null}
      <div className="hub-pop-foot">
        <button type="button" className="hub-btn hub-btn-primary" disabled={key === "views" && viewsBad} onClick={apply}>
          Apply
        </button>
      </div>
    </div>
  );
}

export function FilterChips({ filter, onChange }: { filter: LibraryFilter; onChange: (next: LibraryFilter) => void }) {
  const chips = activeFilterChips(filter);
  if (chips.length === 0) return null;
  return (
    <div className="hub-chips" aria-label="Active filters">
      {chips.map((c) => (
        <span key={c.key} className="hub-chip" data-chip={c.key}>
          <span className="hub-chip-label">{c.label}</span>
          <button type="button" aria-label={`Remove filter ${c.label}`} onClick={() => onChange(clearFilterKey(filter, c.key))}>
            <X />
          </button>
        </span>
      ))}
      {chips.length > 1 ? (
        <button type="button" className="hub-link hub-link-btn" onClick={() => onChange(chips.reduce((f, c) => clearFilterKey(f, c.key), filter))}>
          Clear all
        </button>
      ) : null}
    </div>
  );
}

/* ── Visibility popover body ────────────────────────────── */

export interface VisibilityPanelProps {
  choice: HubVisibility;
  onChoice: (v: HubVisibility) => void;
  /** `datetime-local` value. */
  scheduleLocal: string;
  onScheduleLocal: (v: string) => void;
  /** Shown under the controls (bad time, server error). */
  error?: string | null;
  canSave: boolean;
  pending?: boolean;
  onSharePrivately?: () => void;
  onCancel: () => void;
  onSave: () => void;
}

const VIS_HINT: Record<Exclude<HubVisibility, "scheduled">, string> = {
  private: "Only you, and people you share it with.",
  unlisted: "Anyone with the link can watch.",
  public: "Everyone can watch and find it.",
};

export function VisibilityPanel({ choice, onChoice, scheduleLocal, onScheduleLocal, error, canSave, pending = false, onSharePrivately, onCancel, onSave }: VisibilityPanelProps) {
  return (
    <div className="hub-pop-body hub-vis-panel">
      <fieldset className="hub-fieldset">
        <legend className="hub-label">Save or publish</legend>
        <div className="hub-radios" role="radiogroup" aria-label="Visibility">
          {(["private", "unlisted", "public"] as const).map((v) => (
            <label key={v} className="hub-radio hub-radio-rich" data-vis-choice={v}>
              <input type="radio" name="hub-vis-choice" checked={choice === v} onChange={() => onChoice(v)} />
              <VisibilityIcon visibility={v} />
              <span>
                <span className="hub-radio-title">{VISIBILITY_LABEL[v]}</span>
                <span className="hub-hint">{VIS_HINT[v]}</span>
              </span>
            </label>
          ))}
        </div>
        {choice === "private" && onSharePrivately ? (
          <button type="button" className="hub-btn" data-share-privately onClick={onSharePrivately}>
            <UserPlus /> Share privately
          </button>
        ) : null}
      </fieldset>
      <fieldset className="hub-fieldset">
        <legend className="hub-label">Schedule</legend>
        <label className="hub-radio hub-radio-rich" data-vis-choice="scheduled">
          <input type="radio" name="hub-vis-choice" checked={choice === "scheduled"} onChange={() => onChoice("scheduled")} />
          <VisibilityIcon visibility="scheduled" />
          <span>
            <span className="hub-radio-title">Schedule</span>
            <span className="hub-hint">Goes public at the time you pick.</span>
          </span>
        </label>
        {choice === "scheduled" ? <input type="datetime-local" className="hub-input" aria-label="Publish at" value={scheduleLocal} onChange={(e) => onScheduleLocal(e.target.value)} /> : null}
      </fieldset>
      {error ? (
        <span className="hub-hint is-error" role="alert">
          {error}
        </span>
      ) : null}
      <div className="hub-pop-foot">
        <button type="button" className="hub-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="hub-btn hub-btn-primary" disabled={!canSave || pending} onClick={onSave}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

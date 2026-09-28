"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";

import { formatCount, formatDuration } from "@/features/posttube/model";
import { isShortType, watchHref, type HubLibraryRow } from "../hubApi";
import { formatDateTime, rowDate, type LibrarySortKey, type SortDir } from "../hubModel";
import { useContentInsights, useInView } from "../hooks/useHub";
import { Sparkline } from "./Charts";
import { RowHoverActions } from "./LibraryActions";
import { FlagPills } from "./Pills";
import { VisibilityCell } from "./VisibilityCell";

/* ── Row sparkline: fetched only once the row is on screen ── */

function RowSparkline({ postId }: { postId: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const q = useContentInsights(postId, "28d", seen);
  const values = q.data?.views_by_day.map((p) => p.views) ?? [];
  return (
    <span ref={ref} title={q.data ? "Views per day, last 28 days" : undefined}>
      <Sparkline values={values} />
    </span>
  );
}

/* ── Table ──────────────────────────────────────────────── */

export interface RowActions {
  onEdit: (row: HubLibraryRow) => void;
  onCopyLink: (row: HubLibraryRow) => void;
  onDelete: (row: HubLibraryRow) => void;
}

export interface LibraryTableProps {
  rows: HubLibraryRow[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
  sortKey: LibrarySortKey;
  sortDir: SortDir;
  onSort: (key: LibrarySortKey) => void;
  actions: RowActions;
  /** The signed-in creator, kept off their own private-share list. */
  ownerId: string | null;
}

function SortHead({ label, k, sortKey, sortDir, onSort, className }: { label: string; k: LibrarySortKey; sortKey: LibrarySortKey; sortDir: SortDir; onSort: (k: LibrarySortKey) => void; className?: string }) {
  const active = sortKey === k;
  return (
    <th className={className} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)}>
        {label}
        {active ? sortDir === "asc" ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" /> : null}
      </button>
    </th>
  );
}

function rowMeta(row: HubLibraryRow): string {
  const desc = (row.description || row.text).split(/\r?\n/)[0];
  if (desc) return desc;
  if (row.processing_status && row.processing_status !== "ready" && row.processing_status !== "published") return row.processing_status;
  return "No description";
}

export function LibraryTable({ rows, selected, onToggle, onToggleAll, sortKey, sortDir, onSort, actions, ownerId }: LibraryTableProps) {
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOn = rows.some((r) => selected.has(r.id));
  return (
    <div className="hub-table-wrap">
      <table className="hub-table">
        <thead>
          <tr>
            <th style={{ width: 28 }}>
              <input
                type="checkbox"
                className="hub-check"
                aria-label="Select all on this page"
                checked={allOn}
                ref={(el) => {
                  if (el) el.indeterminate = someOn && !allOn;
                }}
                onChange={(e) => onToggleAll(rows.map((r) => r.id), e.target.checked)}
              />
            </th>
            <SortHead label="Video" k="title" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th>Flags</th>
            <th>Visibility</th>
            <SortHead label="Published" k="published" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHead label="Views" k="views" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="num" />
            <SortHead label="Comments" k="comments" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="num" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSel = selected.has(row.id);
            const short = isShortType(row.content_type);
            return (
              <tr key={row.id} className={isSel ? "is-selected" : undefined}>
                <td>
                  <input type="checkbox" className="hub-check" aria-label={`Select ${row.title}`} checked={isSel} onChange={() => onToggle(row.id)} />
                </td>
                <td>
                  <div className="hub-row-title">
                    <span className={`hub-thumb ${short ? "hub-thumb-short" : ""}`}>
                      {row.thumbnail_url ? <img src={row.thumbnail_url} alt="" loading="lazy" /> : null}
                      {row.duration_seconds > 0 ? <span className="hub-thumb-dur">{formatDuration(row.duration_seconds)}</span> : null}
                    </span>
                    <span className="hub-row-text">
                      <Link href={watchHref(row)} title={row.title}>
                        {row.title}
                      </Link>
                      <div className="hub-row-meta">{rowMeta(row)}</div>
                      <RowHoverActions row={row} onEdit={actions.onEdit} onCopyLink={actions.onCopyLink} onDelete={actions.onDelete} />
                    </span>
                  </div>
                </td>
                <td>
                  <FlagPills flags={row.flags} />
                  {row.age_restricted ? <span className="hub-tag hub-tag-warning" style={{ marginLeft: 3 }}>18+</span> : null}
                </td>
                <td>
                  <VisibilityCell row={row} ownerId={ownerId} />
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {formatDateTime(rowDate(row)) || "—"}
                  {row.visibility === "scheduled" && row.scheduled_at ? <div className="hub-row-meta">goes live {formatDateTime(row.scheduled_at)}</div> : null}
                </td>
                <td className="num">
                  {formatCount(row.view_count)}
                  <RowSparkline postId={row.id} />
                </td>
                <td className="num">{formatCount(row.comment_count)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

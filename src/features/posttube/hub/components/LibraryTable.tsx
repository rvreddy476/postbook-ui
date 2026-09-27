"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, BarChart3, Download, MessageSquareText, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { useState } from "react";

import { formatCount, formatDuration } from "@/features/posttube/model";
import { downloadHref, isShortType, watchHref, type HubLibraryRow, type HubVisibility } from "../hubApi";
import { formatDateTime, rowDate, type LibrarySortKey, type SortDir } from "../hubModel";
import { useContentInsights, useInView, useSetVisibility } from "../hooks/useHub";
import { Sparkline } from "./Charts";
import { FlagPills, VisibilityPill, useAnchoredMenu, useDismiss } from "./Pills";

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

/* ── Row menu ───────────────────────────────────────────── */

export interface RowActions {
  onEdit: (row: HubLibraryRow) => void;
  onShare: (row: HubLibraryRow) => void;
  onDelete: (row: HubLibraryRow) => void;
}

function RowMenu({ row, actions }: { row: HubLibraryRow; actions: RowActions }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const { buttonRef, style } = useAnchoredMenu(open, "right");
  const close = () => setOpen(false);
  return (
    <div className="hub-vis" ref={ref} style={{ position: "relative" }}>
      <button ref={buttonRef} type="button" className="hub-icon-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`More for ${row.title}`} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal />
      </button>
      {open ? (
        <div className="hub-menu" style={style} role="menu">
          <button type="button" role="menuitem" className="hub-menu-item" onClick={() => { close(); actions.onEdit(row); }}>
            <Pencil /> Edit
          </button>
          <Link href={`/posttube/hub/insights/${row.id}`} role="menuitem" className="hub-menu-item" onClick={close}>
            <BarChart3 /> Insights
          </Link>
          <Link href={`/posttube/hub/conversations?post=${row.id}`} role="menuitem" className="hub-menu-item" onClick={close}>
            <MessageSquareText /> Conversations
          </Link>
          <button type="button" role="menuitem" className="hub-menu-item" onClick={() => { close(); actions.onShare(row); }}>
            <Share2 /> Share
          </button>
          {row.media_id ? (
            // GET /v1/media/:id/download — a 307 to the signed file; the owner is always allowed,
            // `allow_download` only gates viewers.
            <a role="menuitem" className="hub-menu-item" href={downloadHref(row.media_id)} title={row.allow_download ? "Download the original (viewers can too)" : "Download the original (viewers cannot; turn on Keep in Edit)"} onClick={close}>
              <Download /> Keep
            </a>
          ) : null}
          <div className="hub-menu-sep" />
          <button type="button" role="menuitem" className="hub-menu-item is-danger" onClick={() => { close(); actions.onDelete(row); }}>
            <Trash2 /> Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ── Table ──────────────────────────────────────────────── */

export interface LibraryTableProps {
  rows: HubLibraryRow[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
  sortKey: LibrarySortKey;
  sortDir: SortDir;
  onSort: (key: LibrarySortKey) => void;
  actions: RowActions;
  onSchedule: (row: HubLibraryRow) => void;
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

export function LibraryTable({ rows, selected, onToggle, onToggleAll, sortKey, sortDir, onSort, actions, onSchedule }: LibraryTableProps) {
  const setVisibility = useSetVisibility();
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
            <th style={{ width: 36 }}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSel = selected.has(row.id);
            const short = isShortType(row.content_type);
            const pending = setVisibility.isPending && setVisibility.variables?.postId === row.id;
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
                    <span style={{ minWidth: 0 }}>
                      <Link href={watchHref(row)} title={row.title}>
                        {row.title}
                      </Link>
                      <div className="hub-row-meta">{row.text ? row.text.split(/\r?\n/)[0] : row.processing_status && row.processing_status !== "ready" && row.processing_status !== "published" ? row.processing_status : "No description"}</div>
                    </span>
                  </div>
                </td>
                <td>
                  <FlagPills flags={row.flags} />
                </td>
                <td>
                  <VisibilityPill
                    value={row.visibility}
                    pending={pending}
                    onChange={(v: Exclude<HubVisibility, "scheduled">) => setVisibility.mutate({ postId: row.id, visibility: v })}
                    onSchedule={() => onSchedule(row)}
                  />
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
                <td>
                  <RowMenu row={row} actions={actions} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

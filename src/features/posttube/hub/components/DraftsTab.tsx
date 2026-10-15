"use client";

import Link from "next/link";
import { ChevronDown, ExternalLink, FileText, Trash2 } from "lucide-react";
import { useState } from "react";

import { useGlobalToast } from "@/contexts/ToastContext";
import { ConfirmDialog } from "@/features/posttube/components/ConfirmDialog";
import { coverHref, hubErrorCode, type HubDraft } from "../hubApi";
import { formatDateTime, readableHubError } from "../hubModel";
import { useDeleteDraft, useHubDraft, useHubDrafts } from "../hooks/useHub";
import { HubEmpty, HubError, HubSkeleton } from "./HubEmpty";

/*
  Library → Drafts: the creator's saved drafts (GET /v1/reels/drafts).
  Open shows the draft's saved details inline (GET /v1/reels/drafts/:id);
  a draft that was already published opens its video in the library edit
  sheet instead. Delete is the draft route's soft delete.
  The upload studio cannot load a saved draft yet, so there is no resume.
*/

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  blocked: "Held",
  published: "Published",
};

const STATUS_TONE: Record<string, string> = {
  draft: "muted",
  scheduled: "info",
  blocked: "warning",
  published: "success",
};

export function draftStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : "Draft");
}

/** A draft waiting on its schedule keeps status "draft" on the wire; it reads as Scheduled. */
export function draftStatus(d: Pick<HubDraft, "status" | "schedule_at">): string {
  return d.status === "draft" && d.schedule_at ? "scheduled" : d.status;
}

/** Where Open goes for a published draft: its video, in the library edit sheet. */
export function publishedDraftHref(d: Pick<HubDraft, "published_post_id">): string | null {
  return d.published_post_id ? `/posttube/hub/library?edit=${encodeURIComponent(d.published_post_id)}` : null;
}

export interface DraftsTableProps {
  rows: HubDraft[];
  openId: string | null;
  onOpen: (d: HubDraft) => void;
  onDelete: (d: HubDraft) => void;
  /** The opened draft's detail (fresh from GET /v1/reels/drafts/:id); falls back to the list row. */
  detail?: { data?: HubDraft | null; pending?: boolean; error?: boolean };
}

/** Pure presentation, so the tests render it without a query client. */
export function DraftsTable({ rows, openId, onOpen, onDelete, detail }: DraftsTableProps) {
  return (
    <div className="hub-table-wrap">
      <table className="hub-table" style={{ minWidth: 560 }}>
        <thead>
          <tr>
            <th>Draft</th>
            <th>Status</th>
            <th>Last saved</th>
            <th className="num">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => {
            const href = publishedDraftHref(d);
            const open = openId === d.id;
            const status = draftStatus(d);
            return [
              <tr key={d.id} className={open ? "is-selected" : undefined}>
                <td>
                  <div className="hub-row-title">
                    <span className="hub-thumb">{d.cover_media_id ? <img src={coverHref(d.cover_media_id)} alt="" loading="lazy" /> : null}</span>
                    <span className="hub-row-text">
                      <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }} title={d.title}>
                        {d.title}
                      </span>
                      <div className="hub-row-meta">{d.caption.split(/\r?\n/)[0] || "No description"}</div>
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`hub-tag hub-tag-${STATUS_TONE[status] ?? "muted"}`}>{draftStatusLabel(status)}</span>
                  {status === "scheduled" && d.schedule_at ? <div className="hub-row-meta">goes live {formatDateTime(d.schedule_at)}</div> : null}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(d.updated_at) || "—"}</td>
                <td className="num">
                  <span className="hub-row" style={{ justifyContent: "flex-end", gap: 4 }}>
                    {href ? (
                      <Link href={href} className="hub-btn hub-btn-sm">
                        <ExternalLink aria-hidden="true" /> Open
                      </Link>
                    ) : (
                      <button type="button" className="hub-btn hub-btn-sm" aria-expanded={open} aria-controls={`hub-draft-${d.id}`} onClick={() => onOpen(d)}>
                        <ChevronDown aria-hidden="true" /> {open ? "Close" : "Open"}
                      </button>
                    )}
                    <button type="button" className="hub-btn hub-btn-sm hub-btn-danger" aria-label={`Delete draft ${d.title}`} onClick={() => onDelete(d)}>
                      <Trash2 aria-hidden="true" /> Delete
                    </button>
                  </span>
                </td>
              </tr>,
              open ? (
                <tr key={`${d.id}-detail`} id={`hub-draft-${d.id}`}>
                  <td colSpan={4}>
                    <DraftDetail row={d} detail={detail} />
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function DraftDetail({ row, detail }: { row: HubDraft; detail?: DraftsTableProps["detail"] }) {
  if (detail?.pending) return <HubSkeleton rows={2} height={20} />;
  const d = detail?.data ?? row;
  return (
    <div className="hub-card-pad" style={{ display: "grid", gap: 6 }}>
      {detail?.error ? <div className="hub-hint is-error">The latest copy of this draft could not load; showing the saved list entry.</div> : null}
      <div style={{ fontWeight: 600 }}>{d.title}</div>
      <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{d.caption || <span className="hub-hint">No description</span>}</div>
      <div className="hub-hint">
        {[d.visibility ? `Visibility: ${d.visibility}` : "", d.created_at ? `Started ${formatDateTime(d.created_at)}` : "", d.media_id ? "Video attached" : "No video attached"].filter(Boolean).join(" · ")}
      </div>
      {d.status === "blocked" ? <div className="hub-note">This draft&apos;s scheduled publish was held and did not go out.</div> : null}
      <div className="hub-note">Saved drafts can&apos;t be reopened in the upload studio yet.</div>
    </div>
  );
}

export function DraftsTab() {
  const toast = useGlobalToast();
  const drafts = useHubDrafts();
  const del = useDeleteDraft();
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<HubDraft | null>(null);
  const detail = useHubDraft(openId);

  const confirmDelete = () => {
    if (!deleting) return;
    const d = deleting;
    del.mutate(
      { draftId: d.id },
      {
        onSuccess: () => {
          setDeleting(null);
          if (openId === d.id) setOpenId(null);
          toast({ type: "success", title: "Draft deleted" });
        },
        onError: (err) => toast({ type: "error", title: "Could not delete the draft", description: readableHubError(hubErrorCode(err)) }),
      },
    );
  };

  if (drafts.isPending) return <HubSkeleton rows={4} height={44} />;
  if (drafts.isError) return <HubError />;
  if (drafts.rows.length === 0) {
    return (
      <div className="hub-card">
        <HubEmpty icon={<FileText aria-hidden="true" />} title="No drafts" body="Videos you save as a draft before publishing appear here." />
      </div>
    );
  }

  return (
    <>
      <DraftsTable
        rows={drafts.rows}
        openId={openId}
        onOpen={(d) => setOpenId((cur) => (cur === d.id ? null : d.id))}
        onDelete={setDeleting}
        detail={{ data: detail.data, pending: detail.isPending && !!openId, error: detail.isError }}
      />
      {drafts.hasNextPage ? (
        <div className="hub-more">
          <button type="button" className="hub-btn" onClick={() => drafts.fetchNextPage()} disabled={drafts.isFetchingNextPage}>
            {drafts.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
      <ConfirmDialog
        open={!!deleting}
        title="Delete this draft?"
        body={
          deleting ? (
            <>
              <strong>{deleting.title}</strong> is removed from your drafts.
              {deleting.status === "published" ? " The video it became stays published." : draftStatus(deleting) === "scheduled" ? " Its scheduled publish is cancelled." : ""}
            </>
          ) : null
        }
        confirmLabel="Delete draft"
        danger
        pending={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

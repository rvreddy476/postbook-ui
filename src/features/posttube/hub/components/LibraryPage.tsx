"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, Upload } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import ShareDialog from "@/components/ShareDialog";
import { useGlobalToast } from "@/contexts/ToastContext";
import { ConfirmDialog } from "@/features/posttube/components/ConfirmDialog";
import { useCreatorPlaylists } from "@/hooks/usePosttubeExtras";
import { playlistIsPublic } from "@/features/posttube/data/posttubeApi";
import { useAuthUser } from "@/store/auth";
import { HUB_VISIBILITIES, watchHref, type HubLibraryKind, type HubLibraryRow, type HubVisibility } from "../hubApi";
import { LIBRARY_FILTER_DEFAULT, VISIBILITY_LABEL, filterLibraryRows, liveRows, sortLibraryRows, toggleSelection, type LibraryFilter, type LibrarySortKey, type SortDir } from "../hubModel";
import { useBulkVisibility, useDeleteHubUpload, useHubCounts, useHubLibrary } from "../hooks/useHub";
import { EditSheet, type SheetTab } from "./EditSheet";
import { HubHead } from "./HubFrame";
import { HubError, HubSkeleton, LibraryEmpty } from "./HubEmpty";
import { LibraryTable } from "./LibraryTable";
import { PillGroup } from "./Pills";

type LibraryTab = "videos" | "shorts" | "live" | "collections";

const TABS: { id: LibraryTab; label: string }[] = [
  { id: "videos", label: "Videos" },
  { id: "shorts", label: "Shorts" },
  { id: "live", label: "Live" },
  { id: "collections", label: "Collections" },
];

function readTab(v: string | null): LibraryTab {
  return v === "shorts" || v === "live" || v === "collections" ? v : "videos";
}

/**
  /posttube/hub/library?tab=videos|shorts|live|collections&edit=<postId>&sheet=details|elements|captions
  The sheet is a URL state so a reload keeps it and the row menu links to it.
*/
export function LibraryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = readTab(params.get("tab"));
  const editId = params.get("edit");
  const sheetTab = (params.get("sheet") as SheetTab | null) ?? "details";
  const scheduleFirst = params.get("schedule") === "1";

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const kind: HubLibraryKind = tab === "shorts" ? "flicks" : "videos";
  const library = useHubLibrary(kind);
  const videosForTargets = useHubLibrary("videos");
  const counts = useHubCounts();

  const openEdit = useCallback((row: HubLibraryRow, sheet: SheetTab = "details", schedule = false) => setParams({ edit: row.id, sheet, schedule: schedule ? "1" : null }), [setParams]);
  const closeEdit = useCallback(() => setParams({ edit: null, sheet: null, schedule: null }), [setParams]);

  return (
    <>
      <HubHead
        title="Library"
        sub={counts.data ? `${counts.data.videos} videos · ${counts.data.flicks} shorts` : "Everything you have published, in one table."}
        actions={
          <Link href="/posttube/upload" className="hub-btn hub-btn-primary">
            <Upload /> Upload
          </Link>
        }
      />
      <div className="hub-toolbar">
        <PillGroup label="Content" value={tab} options={TABS} onChange={(t) => setParams({ tab: t === "videos" ? null : t })} />
      </div>

      {tab === "collections" ? (
        <CollectionsTab />
      ) : (
        <RowsTab tab={tab} library={library} onEdit={openEdit} onSchedule={(row) => openEdit(row, "details", true)} />
      )}

      <EditSheet postId={editId} initialTab={sheetTab} scheduleFirst={scheduleFirst} candidates={videosForTargets.rows} onClose={closeEdit} />
    </>
  );
}

/* ── Videos / Shorts / Live ─────────────────────────────── */

function RowsTab({
  tab,
  library,
  onEdit,
  onSchedule,
}: {
  tab: Exclude<LibraryTab, "collections">;
  library: ReturnType<typeof useHubLibrary>;
  onEdit: (row: HubLibraryRow) => void;
  onSchedule: (row: HubLibraryRow) => void;
}) {
  const toast = useGlobalToast();
  const [filter, setFilter] = useState<LibraryFilter>(LIBRARY_FILTER_DEFAULT);
  const [sortKey, setSortKey] = useState<LibrarySortKey>("published");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareRow, setShareRow] = useState<HubLibraryRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<HubLibraryRow | null>(null);
  const bulk = useBulkVisibility();
  const del = useDeleteHubUpload();

  const baseRows = useMemo(() => {
    if (tab !== "live") return library.rows;
    return liveRows(library.rows) ?? [];
  }, [library.rows, tab]);
  const liveUnknown = tab === "live" && liveRows(library.rows) === null;

  const rows = useMemo(() => sortLibraryRows(filterLibraryRows(baseRows, filter), sortKey, sortDir), [baseRows, filter, sortKey, sortDir]);

  const onSort = (key: LibrarySortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "title" ? "asc" : "desc");
    }
  };

  const applyBulk = (visibility: Exclude<HubVisibility, "scheduled">) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    bulk.mutate(
      { postIds: ids, visibility },
      {
        onSuccess: (outcomes) => {
          const failed = outcomes.filter((o) => !o.ok);
          setSelected(new Set(failed.map((o) => o.post_id)));
          if (failed.length === 0) toast({ type: "success", title: `${ids.length} set to ${VISIBILITY_LABEL[visibility]}` });
          else toast({ type: "warning", title: `${ids.length - failed.length} updated, ${failed.length} failed`, description: failed[0]?.error });
        },
        onError: () => toast({ type: "error", title: "Bulk change failed" }),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteRow) return;
    const row = deleteRow;
    del.mutate(
      { postId: row.id },
      {
        onSuccess: () => {
          setDeleteRow(null);
          setSelected((s) => {
            const n = new Set(s);
            n.delete(row.id);
            return n;
          });
          toast({ type: "success", title: "Deleted" });
        },
        onError: () => toast({ type: "error", title: "Could not delete" }),
      },
    );
  };

  const shareUrl = shareRow && typeof window !== "undefined" ? `${window.location.origin}${watchHref(shareRow)}` : undefined;

  return (
    <>
      <div className="hub-toolbar">
        <div className="hub-row" style={{ position: "relative" }}>
          <Search size={12} aria-hidden="true" style={{ position: "absolute", left: 8, opacity: 0.6 }} />
          <input className="hub-input" style={{ paddingLeft: 24 }} placeholder="Filter by title" value={filter.title} onChange={(e) => setFilter((f) => ({ ...f, title: e.target.value }))} aria-label="Filter by title" />
        </div>
        <select className="hub-select" value={filter.visibility} aria-label="Filter by visibility" onChange={(e) => setFilter((f) => ({ ...f, visibility: e.target.value as LibraryFilter["visibility"] }))}>
          <option value="all">Any visibility</option>
          {HUB_VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {VISIBILITY_LABEL[v]}
            </option>
          ))}
        </select>
        <span className="hub-hint" style={{ marginLeft: "auto" }}>
          {rows.length} of {baseRows.length} loaded
        </span>
      </div>

      {selected.size > 0 ? (
        <div className="hub-bulk" role="region" aria-label="Bulk actions">
          <strong>{selected.size} selected</strong>
          <span className="hub-hint">Set visibility:</span>
          {(["public", "unlisted", "private"] as const).map((v) => (
            <button key={v} type="button" className="hub-btn hub-btn-sm" disabled={bulk.isPending} onClick={() => applyBulk(v)}>
              {VISIBILITY_LABEL[v]}
            </button>
          ))}
          {bulk.isPending ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
          <button type="button" className="hub-btn hub-btn-sm" style={{ marginLeft: "auto" }} onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      {liveUnknown ? <div className="hub-note" style={{ marginBottom: 8 }}>Live recordings are listed once the uploads feed marks them (`source = live`). Until then this tab is empty; recordings still appear under Videos.</div> : null}

      {library.isPending ? (
        <HubSkeleton rows={6} height={44} />
      ) : library.isError ? (
        <HubError />
      ) : baseRows.length === 0 ? (
        <div className="hub-card">
          <LibraryEmpty kind={tab === "shorts" ? "flicks" : tab === "live" ? "live" : "videos"} />
        </div>
      ) : rows.length === 0 ? (
        <div className="hub-card">
          <div className="hub-empty">
            <div className="hub-empty-title">Nothing matches</div>
            <div className="hub-empty-body">Clear the title or visibility filter, or load more pages below.</div>
          </div>
        </div>
      ) : (
        <LibraryTable
          rows={rows}
          selected={selected}
          onToggle={(id) => setSelected((s) => toggleSelection(s, id))}
          onToggleAll={(ids, on) =>
            setSelected((s) => {
              const n = new Set(s);
              for (const id of ids) if (on) n.add(id);
              else n.delete(id);
              return n;
            })
          }
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          onSchedule={onSchedule}
          actions={{ onEdit, onShare: setShareRow, onDelete: setDeleteRow }}
        />
      )}

      {library.hasNextPage ? (
        <div className="hub-more">
          <button type="button" className="hub-btn" onClick={() => library.fetchNextPage()} disabled={library.isFetchingNextPage}>
            {library.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      {shareRow ? <ShareDialog postId={shareRow.id} isOpen onClose={() => setShareRow(null)} shareUrl={shareUrl} /> : null}
      <ConfirmDialog
        open={!!deleteRow}
        title="Delete this video?"
        body={
          deleteRow ? (
            <>
              <strong>{deleteRow.title}</strong> is removed for everyone, with its views and conversations. This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteRow(null)}
      />
    </>
  );
}

/* ── Collections (read-only reuse of the playlists hook) ─── */

function CollectionsTab() {
  const user = useAuthUser();
  const playlists = useCreatorPlaylists(user?.id);
  const items = playlists.data ?? [];
  if (playlists.isPending && user) return <HubSkeleton rows={4} height={36} />;
  if (playlists.isError) return <HubError />;
  if (items.length === 0)
    return (
      <div className="hub-card">
        <LibraryEmpty kind="collections" />
      </div>
    );
  return (
    <div className="hub-table-wrap">
      <table className="hub-table" style={{ minWidth: 480 }}>
        <thead>
          <tr>
            <th>Collection</th>
            <th>Visibility</th>
            <th className="num">Items</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/posttube/playlists/${p.id}`} className="hub-link">
                  {p.title}
                </Link>
                {p.description ? <div className="hub-row-meta">{p.description}</div> : null}
              </td>
              <td>
                <span className={`hub-tag ${playlistIsPublic(p) ? "hub-tag-success" : "hub-tag-muted"}`}>{playlistIsPublic(p) ? "Public" : p.visibility === "unlisted" ? "Unlisted" : "Private"}</span>
              </td>
              <td className="num">{p.item_count ?? "—"}</td>
              <td>{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hub-note" style={{ margin: 8 }}>
        Collections are edited on their own page. <Link href="/posttube/playlists" className="hub-link">Open collections</Link>
      </div>
    </div>
  );
}

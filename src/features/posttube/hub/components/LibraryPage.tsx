"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Upload } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useGlobalToast } from "@/contexts/ToastContext";
import { ConfirmDialog } from "@/features/posttube/components/ConfirmDialog";
import { useCreatorPlaylists } from "@/hooks/usePosttubeExtras";
import { playlistIsPublic } from "@/features/posttube/data/posttubeApi";
import { useAuthUser } from "@/store/auth";
import { absoluteWatchUrl, downloadHref, hubErrorCode, type HubBulkPatch, type HubLibraryKind, type HubLibraryRow } from "../hubApi";
import {
  LIBRARY_FILTER_DEFAULT,
  bulkFailures,
  filterLibraryRows,
  liveRows,
  readableHubError,
  sortLibraryRows,
  toggleSelection,
  type BulkFailure,
  type LibraryFilter,
  type LibrarySortKey,
  type SortDir,
} from "../hubModel";
import { useAddToCollection, useBulkDelete, useBulkEdit, useDeleteHubUpload, useHubCategories, useHubCounts, useHubLibrary } from "../hooks/useHub";
import { EditSheet, type SheetTab } from "./EditSheet";
import { HubHead } from "./HubFrame";
import { HubError, HubSkeleton, LibraryEmpty } from "./HubEmpty";
import { BulkBar, FilterChips, FilterMenu, type BulkCollection } from "./LibraryActions";
import { LibraryTable } from "./LibraryTable";
import { PillGroup } from "./Pills";

/**
  Keep a copy for several videos: one hidden frame per file. The download
  route answers a 307 to a signed attachment, so each frame saves its file
  without opening a tab (browsers block all but the first scripted
  window.open).
*/
function startDownloads(urls: string[]) {
  if (typeof document === "undefined") return;
  urls.forEach((url, i) => {
    window.setTimeout(() => {
      const frame = document.createElement("iframe");
      frame.style.display = "none";
      frame.src = url;
      document.body.appendChild(frame);
      window.setTimeout(() => frame.remove(), 60_000);
    }, i * 400);
  });
}

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
        <RowsTab tab={tab} library={library} onEdit={openEdit} />
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
}: {
  tab: Exclude<LibraryTab, "collections">;
  library: ReturnType<typeof useHubLibrary>;
  onEdit: (row: HubLibraryRow) => void;
}) {
  const toast = useGlobalToast();
  const user = useAuthUser();
  const [filter, setFilter] = useState<LibraryFilter>(LIBRARY_FILTER_DEFAULT);
  const [sortKey, setSortKey] = useState<LibrarySortKey>("published");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [failures, setFailures] = useState<BulkFailure[]>([]);
  const [deleteRow, setDeleteRow] = useState<HubLibraryRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const bulkEdit = useBulkEdit();
  const bulkDelete = useBulkDelete();
  const addToCollection = useAddToCollection();
  const del = useDeleteHubUpload();
  const categories = useHubCategories();
  const playlists = useCreatorPlaylists(user?.id);

  const baseRows = useMemo(() => {
    if (tab !== "live") return library.rows;
    return liveRows(library.rows) ?? [];
  }, [library.rows, tab]);
  const liveUnknown = tab === "live" && liveRows(library.rows) === null;

  const rows = useMemo(() => sortLibraryRows(filterLibraryRows(baseRows, filter), sortKey, sortDir), [baseRows, filter, sortKey, sortDir]);
  const selectedRows = useMemo(() => baseRows.filter((r) => selected.has(r.id)), [baseRows, selected]);
  const short = tab === "shorts";
  const topics = useMemo(() => (categories.data ?? []).filter((c) => c.kind === "all" || c.kind === (short ? "short" : "long")), [categories.data, short]);
  const collections: BulkCollection[] | null = user && playlists.isPending ? null : (playlists.data ?? []).map((p) => ({ id: p.id, title: p.title || "Untitled" }));
  const busy = bulkEdit.isPending || bulkDelete.isPending || addToCollection.isPending;

  const onSort = (key: LibrarySortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "title" ? "asc" : "desc");
    }
  };

  /** Keeps the failed rows ticked (so a retry is one click) and lists why. */
  const settle = (outcomes: { post_id: string; ok: boolean; error?: string }[], done: string) => {
    const failed = bulkFailures(outcomes, baseRows);
    setFailures(failed);
    setSelected(new Set(failed.map((f) => f.id)));
    const okCount = outcomes.length - failed.length;
    if (failed.length === 0) toast({ type: "success", title: done });
    else toast({ type: "warning", title: `${okCount} done, ${failed.length} not changed`, description: failed[0]?.message });
  };

  const applyEdit = (patch: HubBulkPatch, fieldLabel: string) => {
    const ids = selectedRows.map((r) => r.id);
    if (ids.length === 0) return;
    setFailures([]);
    bulkEdit.mutate(
      { postIds: ids, patch },
      {
        onSuccess: (outcomes) => settle(outcomes, `${fieldLabel} updated on ${ids.length} ${ids.length === 1 ? "video" : "videos"}`),
        onError: (err) => toast({ type: "error", title: "Bulk change failed", description: readableHubError(hubErrorCode(err)) }),
      },
    );
  };

  const applyCollection = (c: BulkCollection) => {
    const ids = selectedRows.map((r) => r.id);
    if (ids.length === 0) return;
    setFailures([]);
    addToCollection.mutate(
      { collectionId: c.id, postIds: ids },
      {
        onSuccess: (outcomes) => settle(outcomes, `Added to ${c.title}`),
        onError: () => toast({ type: "error", title: `Could not add to ${c.title}` }),
      },
    );
  };

  const downloadable = selectedRows.filter((r) => !!r.media_id);
  const keepCopies = () => {
    if (downloadable.length === 0) return;
    startDownloads(downloadable.map((r) => downloadHref(r.media_id as string)));
    toast({ type: "info", title: downloadable.length === 1 ? "Keeping a copy" : `Keeping ${downloadable.length} copies`, description: "Your browser may ask to allow several downloads." });
  };

  const confirmBulkDelete = () => {
    const ids = selectedRows.map((r) => r.id);
    if (ids.length === 0) return;
    setFailures([]);
    bulkDelete.mutate(
      { postIds: ids },
      {
        onSuccess: (outcomes) => {
          setBulkDeleteOpen(false);
          settle(outcomes, `Deleted ${outcomes.filter((o) => o.ok).length} forever`);
        },
        onError: (err) => toast({ type: "error", title: "Could not delete", description: readableHubError(hubErrorCode(err)) }),
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
          toast({ type: "success", title: "Deleted forever" });
        },
        onError: () => toast({ type: "error", title: "Could not delete" }),
      },
    );
  };

  const copyLink = async (row: HubLibraryRow) => {
    const url = absoluteWatchUrl(row, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      toast({ type: "success", title: "Link copied" });
    } catch {
      toast({ type: "error", title: "Could not copy the link", description: url });
    }
  };

  return (
    <>
      <div className="hub-toolbar">
        <div className="hub-row" style={{ position: "relative" }}>
          <Search size={12} aria-hidden="true" style={{ position: "absolute", left: 8, opacity: 0.6 }} />
          <input className="hub-input" style={{ paddingLeft: 24 }} placeholder="Filter by title" value={filter.title} onChange={(e) => setFilter((f) => ({ ...f, title: e.target.value }))} aria-label="Filter by title" />
        </div>
        <FilterMenu filter={filter} onChange={setFilter} />
        <span className="hub-hint" style={{ marginLeft: "auto" }}>
          {rows.length} of {baseRows.length} loaded
        </span>
      </div>
      <FilterChips filter={filter} onChange={setFilter} />

      {selectedRows.length > 0 ? (
        <BulkBar
          count={selectedRows.length}
          total={rows.length}
          allSelected={rows.every((r) => selected.has(r.id))}
          onSelectAll={() => setSelected((s) => new Set([...s, ...rows.map((r) => r.id)]))}
          onClear={() => {
            setSelected(new Set());
            setFailures([]);
          }}
          pending={busy}
          topics={topics}
          collections={collections}
          onApplyEdit={applyEdit}
          onAddToCollection={applyCollection}
          downloadable={downloadable.length}
          onDownload={keepCopies}
          onDeleteForever={() => setBulkDeleteOpen(true)}
          failures={failures}
          onDismissFailures={() => setFailures([])}
        />
      ) : failures.length > 0 ? (
        <div className="hub-error hub-bulk-failures" role="alert">
          {failures.map((f) => (
            <div key={f.id}>
              {f.title}: {f.message}
            </div>
          ))}
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
            <div className="hub-empty-body">Remove a filter above, or load more pages below.</div>
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
          ownerId={user?.id ?? null}
          actions={{ onEdit, onCopyLink: (row) => void copyLink(row), onDelete: setDeleteRow }}
        />
      )}

      {library.hasNextPage ? (
        <div className="hub-more">
          <button type="button" className="hub-btn" onClick={() => library.fetchNextPage()} disabled={library.isFetchingNextPage}>
            {library.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleteRow}
        title="Delete forever?"
        body={
          deleteRow ? (
            <>
              <strong>{deleteRow.title}</strong> is removed for everyone, with its views and conversations. This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete forever"
        danger
        pending={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteRow(null)}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedRows.length} ${selectedRows.length === 1 ? "video" : "videos"} forever?`}
        body={
          <>
            {selectedRows.slice(0, 5).map((r) => (
              <span key={r.id} style={{ display: "block", fontWeight: 600 }}>
                {r.title}
              </span>
            ))}
            {selectedRows.length > 5 ? <span style={{ display: "block" }}>and {selectedRows.length - 5} more</span> : null}
            They are removed for everyone, with their views and conversations. This cannot be undone.
          </>
        }
        confirmLabel="Delete forever"
        danger
        pending={bulkDelete.isPending}
        onConfirm={confirmBulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import {
  bulkSetVisibility,
  deleteUpload,
  getCards,
  getChapters,
  getContentInsights,
  getCreatorInsights,
  getEndScreens,
  getHubCategories,
  getMySummary,
  getPost,
  getUploadCounts,
  heartComment,
  listCaptionTracks,
  listInbox,
  listLibrary,
  listMyCaptions,
  pinComment,
  pickCoverFrame,
  reschedule,
  requestAutoCaption,
  saveCards,
  saveChapters,
  saveEndScreens,
  setCaptionPublished,
  updatePost,
  uploadCaption,
  uploadCoverImage,
  type CaptionStatus,
  type HubCard,
  type HubEndScreen,
  type HubInboxPage,
  type HubInboxRow,
  type HubLibraryKind,
  type HubLibraryPage,
  type HubLibraryRow,
  type HubPostPatch,
  type HubVisibility,
  type InboxContent,
  type InboxSort,
  type InboxStatus,
  type InsightsPeriod,
} from "../hubApi";
import { dedupeRows } from "../hubModel";

/*
  Query keys all start with "hub" so one invalidation clears the console.
  The uploads list shares the older `["my-uploads"]` prefix invalidations
  from hooks/useMyUploads by also invalidating it after a delete, so the
  "Your videos" page does not show a deleted row.
*/
export const HUB_KEYS = {
  all: ["hub"] as const,
  library: (kind: HubLibraryKind) => ["hub", "library", kind] as const,
  counts: ["hub", "counts"] as const,
  summary: ["hub", "summary"] as const,
  post: (id: string) => ["hub", "post", id] as const,
  chapters: (id: string) => ["hub", "chapters", id] as const,
  endScreens: (id: string) => ["hub", "end-screens", id] as const,
  cards: (id: string) => ["hub", "cards", id] as const,
  categories: ["hub", "categories"] as const,
  inbox: (status: InboxStatus, content: InboxContent, sort: InboxSort) => ["hub", "inbox", status, content, sort] as const,
  captions: (status: CaptionStatus) => ["hub", "captions", status] as const,
  captionTracks: (mediaId: string) => ["hub", "caption-tracks", mediaId] as const,
  creatorInsights: (period: InsightsPeriod) => ["hub", "insights", "creator", period] as const,
  contentInsights: (id: string, period: InsightsPeriod) => ["hub", "insights", "content", id, period] as const,
};

/* ── Library ────────────────────────────────────────────── */

export function useHubLibrary(kind: HubLibraryKind, limit = 30) {
  const query = useInfiniteQuery<HubLibraryPage, Error, InfiniteData<HubLibraryPage, string>, ReturnType<typeof HUB_KEYS.library>, string>({
    queryKey: HUB_KEYS.library(kind),
    queryFn: ({ pageParam }) => listLibrary(kind, { cursor: pageParam || undefined, limit }),
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 15_000,
  });
  const rows = useMemo(() => dedupeRows(query.data?.pages.flatMap((p) => p.items) ?? []), [query.data]);
  return { ...query, rows };
}

export function useHubCounts() {
  return useQuery({ queryKey: HUB_KEYS.counts, queryFn: getUploadCounts, staleTime: 30_000 });
}

export function useHubSummary() {
  return useQuery({ queryKey: HUB_KEYS.summary, queryFn: getMySummary, staleTime: 30_000, retry: false });
}

function patchLibraryRow(qc: ReturnType<typeof useQueryClient>, id: string, patch: Partial<HubLibraryRow>) {
  for (const kind of ["videos", "flicks"] as const) {
    qc.setQueryData<InfiniteData<HubLibraryPage, string>>(HUB_KEYS.library(kind), (old) =>
      old
        ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.map((r) => (r.id === id ? { ...r, ...patch } : r)) })) }
        : old,
    );
  }
}

function removeLibraryRow(qc: ReturnType<typeof useQueryClient>, id: string) {
  for (const kind of ["videos", "flicks"] as const) {
    qc.setQueryData<InfiniteData<HubLibraryPage, string>>(HUB_KEYS.library(kind), (old) =>
      old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.filter((r) => r.id !== id) })) } : old,
    );
  }
}

/** Inline visibility pill: optimistic on the table, rolled back on error. */
export function useSetVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, visibility }: { postId: string; visibility: HubVisibility }) => updatePost(postId, { visibility }),
    onMutate: async ({ postId, visibility }) => {
      const snapshot = {
        videos: qc.getQueryData<InfiniteData<HubLibraryPage, string>>(HUB_KEYS.library("videos")),
        flicks: qc.getQueryData<InfiniteData<HubLibraryPage, string>>(HUB_KEYS.library("flicks")),
      };
      patchLibraryRow(qc, postId, { visibility });
      return snapshot;
    },
    onError: (_e, _v, snapshot) => {
      if (!snapshot) return;
      qc.setQueryData(HUB_KEYS.library("videos"), snapshot.videos);
      qc.setQueryData(HUB_KEYS.library("flicks"), snapshot.flicks);
    },
    onSettled: (_d, _e, { postId }) => {
      void qc.invalidateQueries({ queryKey: HUB_KEYS.post(postId) });
    },
  });
}

export function useBulkVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postIds, visibility }: { postIds: string[]; visibility: HubVisibility }) => bulkSetVisibility(postIds, visibility),
    onSuccess: (outcomes, { visibility }) => {
      for (const o of outcomes) if (o.ok) patchLibraryRow(qc, o.post_id, { visibility });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["hub", "library"] });
    },
  });
}

export function useDeleteHubUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId }: { postId: string }) => deleteUpload(postId),
    onSuccess: (_d, { postId }) => {
      removeLibraryRow(qc, postId);
      void qc.invalidateQueries({ queryKey: HUB_KEYS.counts });
      void qc.invalidateQueries({ queryKey: HUB_KEYS.summary });
      void qc.invalidateQueries({ queryKey: ["my-uploads"] });
    },
  });
}

/* ── Post edit ──────────────────────────────────────────── */

export function useHubPost(postId: string | null | undefined) {
  return useQuery({
    queryKey: HUB_KEYS.post(postId ?? ""),
    queryFn: () => getPost(postId as string),
    enabled: !!postId,
    staleTime: 10_000,
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, patch }: { postId: string; patch: HubPostPatch }) => updatePost(postId, patch),
    onSuccess: (detail, { postId, patch }) => {
      if (detail) qc.setQueryData(HUB_KEYS.post(postId), detail);
      const rowPatch: Partial<HubLibraryRow> = {};
      if (patch.title !== undefined) rowPatch.title = patch.title || "Untitled";
      if (patch.text !== undefined) rowPatch.text = patch.text;
      if (patch.visibility !== undefined) rowPatch.visibility = patch.visibility;
      if (patch.allow_download !== undefined) rowPatch.allow_download = patch.allow_download;
      if (detail?.cover_media_id) {
        rowPatch.cover_media_id = detail.cover_media_id;
        rowPatch.thumbnail_url = detail.thumbnail_url;
      }
      patchLibraryRow(qc, postId, rowPatch);
    },
    onSettled: (_d, _e, { postId }) => {
      void qc.invalidateQueries({ queryKey: HUB_KEYS.post(postId) });
    },
  });
}

export function useReschedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, publishAt }: { postId: string; publishAt?: string }) => reschedule(postId, publishAt),
    onSuccess: (_d, { postId, publishAt }) => {
      patchLibraryRow(qc, postId, publishAt ? { visibility: "scheduled", scheduled_at: publishAt } : { scheduled_at: null });
      void qc.invalidateQueries({ queryKey: HUB_KEYS.post(postId) });
      void qc.invalidateQueries({ queryKey: ["hub", "library"] });
      void qc.invalidateQueries({ queryKey: ["posttube", "scheduled"] });
    },
  });
}

export function usePickCoverFrame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, mediaId, timestampMs }: { postId: string; mediaId: string; timestampMs: number }) => pickCoverFrame(postId, mediaId, timestampMs),
    onSuccess: (previewUrl, { postId }) => {
      if (previewUrl) patchLibraryRow(qc, postId, { thumbnail_url: previewUrl });
      void qc.invalidateQueries({ queryKey: HUB_KEYS.post(postId) });
      void qc.invalidateQueries({ queryKey: ["hub", "library"] });
    },
  });
}

export function useUploadCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, file }: { postId: string; file: File }) => uploadCoverImage(postId, file),
    onSuccess: (_mediaId, { postId }) => {
      void qc.invalidateQueries({ queryKey: HUB_KEYS.post(postId) });
      void qc.invalidateQueries({ queryKey: ["hub", "library"] });
    },
  });
}

/* ── Elements ───────────────────────────────────────────── */

export function useHubChapters(postId: string | null | undefined) {
  return useQuery({ queryKey: HUB_KEYS.chapters(postId ?? ""), queryFn: () => getChapters(postId as string), enabled: !!postId });
}

export function useSaveChapters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, chapters }: { postId: string; chapters: { title: string; start_ms: number }[] }) => saveChapters(postId, chapters),
    onSuccess: (_n, { postId }) => void qc.invalidateQueries({ queryKey: HUB_KEYS.chapters(postId) }),
  });
}

export function useHubEndScreens(postId: string | null | undefined) {
  return useQuery({ queryKey: HUB_KEYS.endScreens(postId ?? ""), queryFn: () => getEndScreens(postId as string), enabled: !!postId });
}

export function useSaveEndScreens() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, screens }: { postId: string; screens: HubEndScreen[] }) => saveEndScreens(postId, screens),
    onSuccess: (_n, { postId }) => void qc.invalidateQueries({ queryKey: HUB_KEYS.endScreens(postId) }),
  });
}

export function useHubCards(postId: string | null | undefined) {
  return useQuery({ queryKey: HUB_KEYS.cards(postId ?? ""), queryFn: () => getCards(postId as string), enabled: !!postId });
}

export function useSaveCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, cards }: { postId: string; cards: HubCard[] }) => saveCards(postId, cards),
    onSuccess: (_n, { postId }) => void qc.invalidateQueries({ queryKey: HUB_KEYS.cards(postId) }),
  });
}

export function useHubCategories() {
  return useQuery({ queryKey: HUB_KEYS.categories, queryFn: getHubCategories, staleTime: 10 * 60_000 });
}

/* ── Conversations ──────────────────────────────────────── */

export function useHubInbox(status: InboxStatus, content: InboxContent, sort: InboxSort, limit = 30) {
  const query = useInfiniteQuery<HubInboxPage, Error, InfiniteData<HubInboxPage, string>, ReturnType<typeof HUB_KEYS.inbox>, string>({
    queryKey: HUB_KEYS.inbox(status, content, sort),
    queryFn: ({ pageParam }) => listInbox({ status, content, sort, cursor: pageParam || undefined, limit }),
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 10_000,
  });
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: HubInboxRow[] = [];
    for (const r of query.data?.pages.flatMap((p) => p.items) ?? []) {
      if (seen.has(r.comment.id)) continue;
      seen.add(r.comment.id);
      out.push(r);
    }
    return out;
  }, [query.data]);
  return { ...query, rows };
}

function patchInboxEverywhere(qc: ReturnType<typeof useQueryClient>, commentId: string, patch: (row: HubInboxRow) => HubInboxRow | null) {
  qc.setQueriesData<InfiniteData<HubInboxPage, string>>({ queryKey: ["hub", "inbox"] }, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            items: p.items.map((r) => (r.comment.id === commentId ? patch(r) : r)).filter((r): r is HubInboxRow => r !== null),
          })),
        }
      : old,
  );
}

export function useHeartComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, on }: { commentId: string; on: boolean }) => heartComment(commentId, on),
    onMutate: ({ commentId, on }) => patchInboxEverywhere(qc, commentId, (r) => ({ ...r, comment: { ...r.comment, hearted: on } })),
    onError: (_e, { commentId, on }) => patchInboxEverywhere(qc, commentId, (r) => ({ ...r, comment: { ...r.comment, hearted: !on } })),
  });
}

export function usePinComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, on }: { commentId: string; on: boolean }) => pinComment(commentId, on),
    onMutate: ({ commentId, on }) => patchInboxEverywhere(qc, commentId, (r) => ({ ...r, comment: { ...r.comment, pinned: on } })),
    onError: (_e, { commentId, on }) => patchInboxEverywhere(qc, commentId, (r) => ({ ...r, comment: { ...r.comment, pinned: !on } })),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["hub", "inbox"] }),
  });
}

/** After a reply lands, the row is answered; after a delete, it is gone. */
export function useInboxRowPatch() {
  const qc = useQueryClient();
  return {
    markReplied: (commentId: string) =>
      patchInboxEverywhere(qc, commentId, (r) => ({ ...r, author_replied: true, comment: { ...r.comment, reply_count: (r.comment.reply_count ?? 0) + 1 } })),
    remove: (commentId: string) => patchInboxEverywhere(qc, commentId, () => null),
    invalidate: () => void qc.invalidateQueries({ queryKey: ["hub", "inbox"] }),
  };
}

/* ── Captions ───────────────────────────────────────────── */

export function useHubCaptions(status: CaptionStatus, limit = 30) {
  const query = useInfiniteQuery({
    queryKey: HUB_KEYS.captions(status),
    queryFn: ({ pageParam }) => listMyCaptions({ status, cursor: pageParam || undefined, limit }),
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 10_000,
  });
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  return { ...query, rows };
}

export function useCaptionTracks(mediaId: string | null | undefined) {
  return useQuery({ queryKey: HUB_KEYS.captionTracks(mediaId ?? ""), queryFn: () => listCaptionTracks(mediaId as string), enabled: !!mediaId });
}

export function useSetCaptionPublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId, language, published }: { mediaId: string; language: string; published: boolean }) => setCaptionPublished(mediaId, language, published),
    onSettled: (_d, _e, { mediaId }) => {
      void qc.invalidateQueries({ queryKey: ["hub", "captions"] });
      void qc.invalidateQueries({ queryKey: HUB_KEYS.captionTracks(mediaId) });
    },
  });
}

export function useUploadCaption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId, language, file }: { mediaId: string; language: string; file: File }) => uploadCaption(mediaId, language, file),
    onSettled: (_d, _e, { mediaId }) => {
      void qc.invalidateQueries({ queryKey: ["hub", "captions"] });
      void qc.invalidateQueries({ queryKey: HUB_KEYS.captionTracks(mediaId) });
    },
  });
}

export function useRequestAutoCaption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId, language }: { mediaId: string; language: string }) => requestAutoCaption(mediaId, language),
    onSettled: (_d, _e, { mediaId }) => {
      void qc.invalidateQueries({ queryKey: ["hub", "captions"] });
      void qc.invalidateQueries({ queryKey: HUB_KEYS.captionTracks(mediaId) });
    },
  });
}

/* ── Insights ───────────────────────────────────────────── */

export function useCreatorInsights(period: InsightsPeriod) {
  return useQuery({ queryKey: HUB_KEYS.creatorInsights(period), queryFn: () => getCreatorInsights(period), staleTime: 60_000 });
}

export function useContentInsights(contentId: string | null | undefined, period: InsightsPeriod, enabled = true) {
  return useQuery({
    queryKey: HUB_KEYS.contentInsights(contentId ?? "", period),
    queryFn: () => getContentInsights(contentId as string, period),
    enabled: !!contentId && enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** True once the element has scrolled into view; the row sparklines fetch only then. */
export function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setSeen(true);
    }, { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

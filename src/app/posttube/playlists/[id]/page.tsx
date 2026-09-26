"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ListVideo, Loader2, Play, Trash2 } from "lucide-react";

import { usePlaylist, usePlaylistItems, useRemovePlaylistItem } from "@/hooks/usePosttubeExtras";
import { playlistIsPublic } from "@/features/posttube/data/posttubeApi";
import { formatCount, formatDuration, rowToVideo, timeAgo } from "@/features/posttube/model";

/*
  GET /v1/playlists/:id, GET /v1/playlists/:id/items, DELETE /v1/playlists/:id/items/:postId.
  "Play" opens the first item; each row opens its own video.
*/
export default function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const playlistQuery = usePlaylist(id);
  const itemsQuery = usePlaylistItems(id);
  const remove = useRemovePlaylistItem(id);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const playlist = playlistQuery.data ?? null;
  const items = itemsQuery.data ?? [];

  if (playlistQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!playlist) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-[18px] font-bold text-brand-text">Playlist not found</h2>
        <Link href="/posttube/playlists" className="mt-3 inline-block text-[13px] font-semibold text-primary-ink hover:underline">
          Back to playlists
        </Link>
      </div>
    );
  }

  const first = items[0];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Link href="/posttube/playlists" className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-brand-text">
        <ArrowLeft className="h-3.5 w-3.5" /> Playlists
      </Link>

      <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-border bg-brand-card p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-secondary text-brand-text">
          <ListVideo className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-brand-text">{playlist.title}</h1>
          {playlist.description ? <p className="mt-1 text-[13px] text-brand-text">{playlist.description}</p> : null}
          <p className="mt-1 text-[12px] text-muted-foreground">
            {items.length} video{items.length === 1 ? "" : "s"} · {playlistIsPublic(playlist) ? "Public" : playlist.visibility === "unlisted" ? "Unlisted" : "Private"}
          </p>
        </div>
        {first ? (
          <Link
            href={`/posttube/watch/${first.post_id}`}
            className="flex items-center gap-2 rounded-full bg-primary-ink px-5 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <Play className="h-4 w-4 fill-current" /> Play all
          </Link>
        ) : null}
      </div>

      <div className="mt-6">
        {itemsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground">No videos in this playlist yet. Use &ldquo;Save to playlist&rdquo; on a video.</div>
        ) : (
          <ol className="space-y-2">
            {items.map((it, index) => {
              const video = it.post ? rowToVideo(it.post) : null;
              return (
                <li key={it.post_id} className="flex items-center gap-3 rounded-xl border border-border bg-brand-card p-3">
                  <span className="w-6 shrink-0 text-center text-[12px] font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                  <Link href={`/posttube/watch/${it.post_id}`} className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-brand-secondary">
                    {video?.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-muted-foreground">No poster</div>
                    )}
                    {video && video.duration_seconds > 0 ? (
                      <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">{formatDuration(video.duration_seconds)}</span>
                    ) : null}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/posttube/watch/${it.post_id}`} className="line-clamp-2 text-[14px] font-semibold leading-tight text-brand-text hover:text-primary-ink">
                      {video?.title ?? it.post_id}
                    </Link>
                    {video ? (
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {video.channel_name} · {formatCount(video.view_count)} views · {timeAgo(video.published_at)}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRemovingId(it.post_id);
                      remove.mutate(it.post_id, { onSettled: () => setRemovingId(null) });
                    }}
                    disabled={removingId === it.post_id && remove.isPending}
                    aria-label="Remove from playlist"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-brand-secondary hover:text-danger disabled:opacity-50"
                  >
                    {removingId === it.post_id && remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

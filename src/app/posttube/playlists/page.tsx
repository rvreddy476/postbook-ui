"use client";

import { useState } from "react";
import Link from "next/link";
import { ListVideo, Loader2, Plus, Trash2 } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { useCreatePlaylist, useCreatorPlaylists, useDeletePlaylist } from "@/hooks/usePosttubeExtras";
import { ConfirmDialog } from "@/features/posttube/components/ConfirmDialog";
import { playlistIsPublic } from "@/features/posttube/data/posttubeApi";

/*
  GET /v1/creators/<me>/playlists; POST /v1/playlists { title, description?, visibility };
  DELETE /v1/playlists/:id.
*/
export default function PosttubePlaylistsPage() {
  const user = useAuthUser();
  const playlistsQuery = useCreatorPlaylists(user?.id);
  const create = useCreatePlaylist();
  const del = useDeletePlaylist();

  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "unlisted">("private");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const playlists = playlistsQuery.data ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    await create.mutateAsync({ title: t, description: desc.trim() || undefined, visibility });
    setTitle("");
    setDesc("");
    setVisibility("private");
    setShowNew(false);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-secondary text-brand-text">
            <ListVideo className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-brand-text">Playlists</h1>
            <p className="text-[12px] text-muted-foreground">Collections you have made.</p>
          </div>
        </div>
        {user && !showNew ? (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary-ink px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" /> New playlist
          </button>
        ) : null}
      </div>

      {showNew ? (
        <form onSubmit={submit} className="mb-6 space-y-3 rounded-2xl border border-border bg-brand-card p-5">
          <input
            required
            autoFocus
            placeholder="Title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-brand-bg px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          />
          <textarea
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-brand-bg px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          />
          <label className="flex items-center gap-2 text-[13px] text-brand-text">
            Visibility
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              className="rounded-lg border border-border bg-brand-bg px-2 py-1.5 text-[12px] text-brand-text"
            >
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={create.isPending || !title.trim()}
              className="rounded-full bg-primary-ink px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {create.isPending ? "Creating..." : "Create"}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-brand-text hover:bg-brand-secondary">
              Cancel
            </button>
          </div>
          {create.isError ? <p className="text-[12px] text-danger">Could not create the playlist.</p> : null}
        </form>
      ) : null}

      {!user ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground">Sign in to see your playlists.</div>
      ) : playlistsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : playlists.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground">No playlists yet. Create one to organise videos you want to keep.</div>
      ) : (
        <div className="space-y-3">
          {playlists.map((p) => (
            <div key={p.id} className="flex items-center gap-4 rounded-xl border border-border bg-brand-card p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-secondary text-brand-text">
                <ListVideo className="h-5 w-5" />
              </div>
              <Link href={`/posttube/playlists/${p.id}`} className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-brand-text hover:text-primary-ink">{p.title}</div>
                <div className="text-[12px] text-muted-foreground">
                  {p.item_count ?? 0} video{(p.item_count ?? 0) === 1 ? "" : "s"} · {playlistIsPublic(p) ? "Public" : p.visibility === "unlisted" ? "Unlisted" : "Private"}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setDeleteTarget({ id: p.id, title: p.title })}
                aria-label={`Delete ${p.title}`}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-brand-secondary hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.title ?? ""}"?`}
        body="The playlist is removed. The videos in it are not deleted."
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onConfirm={() => deleteTarget && del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

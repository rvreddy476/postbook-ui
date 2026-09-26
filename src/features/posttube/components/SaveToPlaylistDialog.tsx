"use client";

import { Check, ListPlus, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useAuthUser } from "@/store/auth";
import { useAddPlaylistItem, useCreatePlaylist, useCreatorPlaylists } from "@/hooks/usePosttubeExtras";
import { playlistIsPublic } from "../data/posttubeApi";

interface SaveToPlaylistDialogProps {
  open: boolean;
  postId: string;
  onClose: () => void;
}

/*
  "Save to playlist": the viewer's playlists from
  GET /v1/creators/<me>/playlists, one click adds via
  POST /v1/playlists/:id/items, and a quick create for a new one.
*/
export function SaveToPlaylistDialog({ open, postId, onClose }: SaveToPlaylistDialogProps) {
  const user = useAuthUser();
  const playlistsQuery = useCreatorPlaylists(open ? user?.id : undefined);
  const addItem = useAddPlaylistItem();
  const create = useCreatePlaylist();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");

  useEffect(() => {
    if (!open) return;
    setAdded(new Set());
    setCreating(false);
    setTitle("");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const playlists = playlistsQuery.data ?? [];

  const add = (playlistId: string) => {
    if (added.has(playlistId)) return;
    addItem.mutate(
      { playlistId, postId },
      { onSuccess: () => setAdded((s) => new Set(s).add(playlistId)) },
    );
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const pl = await create.mutateAsync({ title: t, visibility });
    setCreating(false);
    setTitle("");
    add(pl.id);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[380px] overflow-hidden rounded-2xl border border-border bg-brand-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-brand-text">
            <ListPlus className="h-4 w-4" /> Save to playlist
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-brand-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[320px] overflow-y-auto px-2 py-2">
          {!user ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">Sign in to save videos to playlists.</p>
          ) : playlistsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : playlists.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No playlists yet. Create one below.</p>
          ) : (
            playlists.map((p) => {
              const done = added.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p.id)}
                  disabled={done || addItem.isPending}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-brand-secondary disabled:opacity-80"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-brand-text">{p.title}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {p.item_count ?? 0} video{(p.item_count ?? 0) === 1 ? "" : "s"} · {playlistIsPublic(p) ? "Public" : "Private"}
                    </span>
                  </span>
                  {done ? <Check className="h-4 w-4 shrink-0 text-brand-accent" /> : <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          {creating ? (
            <form onSubmit={submitCreate} className="space-y-2">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Playlist title"
                maxLength={120}
                className="w-full rounded-lg border border-border bg-brand-bg px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
              />
              <div className="flex items-center justify-between gap-2">
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as "public" | "private")}
                  className="rounded-lg border border-border bg-brand-bg px-2 py-1.5 text-[12px] text-brand-text"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCreating(false)} className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-brand-text hover:bg-brand-secondary">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!title.trim() || create.isPending}
                    className="rounded-full bg-primary-ink px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                  >
                    {create.isPending ? "Creating..." : "Create & add"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={!user}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> New playlist
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

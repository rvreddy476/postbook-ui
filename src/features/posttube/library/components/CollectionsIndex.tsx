"use client";

import Link from "next/link";
import { Clock, Globe, Heart, Link2, ListVideo, Lock, LogIn, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { useAuthUser } from "@/store/auth";
import { useCreatePlaylist, useDeletePlaylist } from "@/hooks/usePosttubeExtras";
import { ReelConfirmDialog } from "@/features/reels/components/ReelConfirmDialog";

import type { Collection, CollectionVisibility } from "../libraryApi";
import { useMyCollections } from "../hooks/useMyCollections";
import "./library.css";

/*
  /posttube/playlists — Collections: the two system lists as fixed links,
  then the viewer's own collections, and a create sheet (title,
  description, visibility) on the existing useCreatePlaylist. `?new=1`
  (the header Create menu's "New collection") opens the sheet on arrival.
*/

/** True when the query asks for the create sheet open: `?new=1`. */
export function wantsNewCollection(search: string | URLSearchParams | null | undefined): boolean {
  if (!search) return false;
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  return params.get("new") === "1";
}

export interface CollectionsIndexProps {
  /** Arrive with the create sheet already open (`/posttube/playlists?new=1`). */
  openNew?: boolean;
}

const VIS_ICON: Record<CollectionVisibility, typeof Globe> = { public: Globe, unlisted: Link2, private: Lock };
const VIS_LABEL: Record<CollectionVisibility, string> = { public: "Public", unlisted: "Unlisted", private: "Private" };

function CollectionCard({ c, onDelete }: { c: Collection; onDelete: () => void }) {
  const Vis = VIS_ICON[c.visibility];
  return (
    <li className="tube-library__card">
      <span className="tube-library__glyph" aria-hidden>
        <ListVideo />
      </span>
      <Link href={`/posttube/playlists/${encodeURIComponent(c.id)}`} className="tube-library__card-body">
        <span className="tube-library__card-title">{c.title}</span>
        <span className="tube-library__card-meta">
          {c.itemCount} video{c.itemCount === 1 ? "" : "s"} · <Vis size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> {VIS_LABEL[c.visibility]}
        </span>
      </Link>
      <button type="button" className="tube-library__icon-button is-danger" aria-label={`Delete ${c.title}`} onClick={onDelete}>
        <Trash2 />
      </button>
    </li>
  );
}

export function CollectionsIndex({ openNew = false }: CollectionsIndexProps = {}) {
  const user = useAuthUser();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const mine = useMyCollections();
  const create = useCreatePlaylist();
  const del = useDeletePlaylist();

  const [showNew, setShowNew] = useState(openNew);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [visibility, setVisibility] = useState<CollectionVisibility>("private");
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    await create.mutateAsync({ title: t, description: desc.trim() || undefined, visibility });
    setTitle("");
    setDesc("");
    setVisibility("private");
    setShowNew(false);
  };

  const collections = mine.data ?? [];
  const signedIn = mounted && !!user;

  return (
    <section className="tube-library" aria-labelledby="tube-collections-title">
      <header className="tube-library__head">
        <span className="tube-library__glyph" aria-hidden>
          <ListVideo />
        </span>
        <div className="tube-library__titles">
          <h1 id="tube-collections-title" className="tube-library__title">
            Collections
          </h1>
          <p className="tube-library__meta">
            <span>Lists you keep. Watch later and Liked videos are always yours.</span>
          </p>
        </div>
        {signedIn && !showNew ? (
          <div className="tube-library__actions">
            <button type="button" className="tube-library__button" onClick={() => setShowNew(true)}>
              <Plus /> New collection
            </button>
          </div>
        ) : null}
      </header>

      <ul className="tube-library__grid" aria-label="Your lists">
        <li>
          <Link href="/posttube/queue" className="tube-library__card">
            <span className="tube-library__glyph" aria-hidden>
              <Clock />
            </span>
            <span className="tube-library__card-body">
              <span className="tube-library__card-title">Watch later</span>
              <span className="tube-library__card-meta">Videos to watch later</span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/posttube/loved" className="tube-library__card">
            <span className="tube-library__glyph" aria-hidden>
              <Heart />
            </span>
            <span className="tube-library__card-body">
              <span className="tube-library__card-title">Liked videos</span>
              <span className="tube-library__card-meta">Videos you loved</span>
            </span>
          </Link>
        </li>
      </ul>

      {showNew ? (
        <form onSubmit={submit} className="tube-library__sheet" aria-label="New collection">
          <label className="tube-library__field">
            Title
            <input required autoFocus maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="tube-library__field">
            Description
            <textarea rows={2} maxLength={1000} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <label className="tube-library__field">
            Visibility
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as CollectionVisibility)}>
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
          </label>
          <div className="tube-library__form-actions">
            <button type="submit" className="tube-library__button" disabled={create.isPending || !title.trim()}>
              {create.isPending ? "Creating…" : "Create"}
            </button>
            <button type="button" className="tube-library__button is-quiet" onClick={() => setShowNew(false)}>
              Cancel
            </button>
            {create.isError ? <p className="tube-library__error">The collection could not be created.</p> : null}
          </div>
        </form>
      ) : null}

      {!mounted || (signedIn && mine.isPending) ? (
        <ul className="tube-library__grid" aria-busy="true" aria-label="Loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="tube-library__skeleton" style={{ height: 60 }} aria-hidden />
          ))}
        </ul>
      ) : !signedIn ? (
        <div className="tube-library__empty">
          <LogIn size={26} />
          <h2>Sign in to see your collections</h2>
          <p>Your lists are kept with your account.</p>
          <Link href={`/login?next=${encodeURIComponent("/posttube/playlists")}`} className="tube-library__cta">
            Sign in
          </Link>
        </div>
      ) : mine.isError ? (
        <div className="tube-library__empty" role="alert">
          <h2>Couldn&apos;t load your collections</h2>
          <p>Check your connection and try again.</p>
          <button type="button" className="tube-library__cta" onClick={() => void mine.refetch()}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : collections.length === 0 ? (
        <div className="tube-library__empty">
          <ListVideo size={26} />
          <h2>No collections yet</h2>
          <p>Make one to group the videos you want to keep together.</p>
          {!showNew ? (
            <button type="button" className="tube-library__cta" onClick={() => setShowNew(true)}>
              <Plus size={14} /> New collection
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="tube-library__grid" aria-label="Your collections">
          {collections.map((c) => (
            <CollectionCard key={c.id} c={c} onDelete={() => setDeleteTarget(c)} />
          ))}
        </ul>
      )}

      <ReelConfirmDialog
        open={!!deleteTarget}
        title={`Delete “${deleteTarget?.title ?? ""}”?`}
        description="The collection is removed. The videos in it are not deleted."
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onConfirm={() => deleteTarget && del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

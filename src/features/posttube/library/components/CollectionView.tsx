"use client";

import Link from "next/link";
import { Clock, Globe, Heart, Link2, ListVideo, Lock, LogIn, Pencil, Play, RefreshCw, Trash2 } from "lucide-react";
import { useState, type DragEvent, type FormEvent } from "react";

import { ReelConfirmDialog } from "@/features/reels/components/ReelConfirmDialog";

import { playAllHref, type Collection, type CollectionItem, type CollectionPatch, type CollectionVisibility, type SystemCollectionKind } from "../libraryApi";
import type { CollectionStatus } from "../hooks/useCollection";
import { CollectionRow } from "./CollectionRow";

export interface CollectionViewProps {
  status: CollectionStatus;
  /** Which system list this is, when it is one; drives the title, glyph and empty copy. */
  systemKind?: SystemCollectionKind;
  collection: Collection | null;
  items: CollectionItem[];
  itemsLoading: boolean;
  itemsError: boolean;
  isOwner: boolean;
  error: string | null;
  pending: { move: boolean; remove: string | null; patch: boolean; destroy: boolean };
  /** Where "Back" goes; the system lists have none. */
  backHref?: string;
  backLabel?: string;
  onRetry: () => void;
  onMove: (postId: string, toIndex: number) => void;
  onMoveBy: (postId: string, delta: number) => void;
  onRemove: (postId: string) => void;
  onPatch: (patch: CollectionPatch) => Promise<Collection | null>;
  onDelete: () => Promise<boolean>;
}

const SYSTEM_COPY: Record<SystemCollectionKind, { title: string; icon: typeof Clock; emptyTitle: string; emptyBody: string }> = {
  watch_later: { title: "Watch later", icon: Clock, emptyTitle: "Nothing saved for later yet", emptyBody: "Tap Watch later on a video to keep it here." },
  liked: { title: "Liked videos", icon: Heart, emptyTitle: "Videos you like will show up here", emptyBody: "Tap Like on any video to keep it." },
};

function VisibilityPill({ visibility }: { visibility: CollectionVisibility }) {
  if (visibility === "public")
    return (
      <span className="tube-library__pill">
        <Globe /> Public
      </span>
    );
  if (visibility === "unlisted")
    return (
      <span className="tube-library__pill">
        <Link2 /> Unlisted
      </span>
    );
  return (
    <span className="tube-library__pill">
      <Lock /> Private
    </span>
  );
}

function countLabel(n: number): string {
  return `${n} video${n === 1 ? "" : "s"}`;
}

/*
  The one list screen: Queue, Loved and every user collection. Presentational;
  CollectionScreen wires it to useCollection. The header is compact (title,
  count, visibility pill, Play all); user collections edit inline and delete
  behind the Reels confirm; rows reorder by drag or by Move up / Move down.
*/
export function CollectionView(props: CollectionViewProps) {
  const { status, systemKind, collection, items, itemsLoading, itemsError, isOwner, error, pending, backHref, backLabel, onRetry, onMove, onMoveBy, onRemove, onPatch, onDelete } = props;
  const isSystem = !!systemKind || (collection ? collection.kind !== "user" : false);
  const kindCopy = systemKind ? SYSTEM_COPY[systemKind] : collection && collection.kind !== "user" ? SYSTEM_COPY[collection.kind] : null;
  const Icon = kindCopy?.icon ?? ListVideo;
  const title = collection?.title ?? kindCopy?.title ?? "Collection";
  const canEdit = isOwner;
  const listId = collection?.id ?? "";

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<{ title: string; description: string; visibility: CollectionVisibility }>({ title: "", description: "", visibility: "private" });

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ index: number; after: boolean } | null>(null);

  const startEdit = () => {
    if (!collection) return;
    setDraft({ title: collection.title, description: collection.description, visibility: collection.visibility });
    setEditing(true);
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!collection) return;
    const patch: CollectionPatch = {};
    const t = draft.title.trim();
    if (t && t !== collection.title) patch.title = t;
    if (draft.description.trim() !== collection.description) patch.description = draft.description.trim();
    if (draft.visibility !== collection.visibility) patch.visibility = draft.visibility;
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    const saved = await onPatch(patch);
    if (saved) setEditing(false);
  };

  const onDragStart = (postId: string) => (e: DragEvent<HTMLLIElement>) => {
    setDragId(postId);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", postId);
    } catch {
      // some browsers refuse setData outside a user gesture
    }
  };
  const onDragOver = (index: number) => (e: DragEvent<HTMLLIElement>) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    setDropAt((cur) => (cur && cur.index === index && cur.after === after ? cur : { index, after }));
  };
  const onDrop = (index: number) => (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    const from = items.findIndex((r) => r.postId === id);
    if (id && from >= 0) {
      const after = dropAt?.index === index ? dropAt.after : e.clientY > e.currentTarget.getBoundingClientRect().top + e.currentTarget.getBoundingClientRect().height / 2;
      let to = after ? index + 1 : index;
      if (from < to) to -= 1;
      onMove(id, to);
    }
    setDragId(null);
    setDropAt(null);
  };
  const onDragEnd = () => {
    setDragId(null);
    setDropAt(null);
  };

  const play = collection ? playAllHref(collection, items) : null;
  const count = collection && items.length === 0 && itemsLoading ? collection.itemCount : items.length;

  let body: React.ReactNode;
  if (status === "signed-out") {
    body = (
      <div className="tube-library__empty">
        <LogIn size={26} />
        <h2>Sign in to see your {title}</h2>
        <p>Your lists are kept with your account.</p>
        <Link href={`/login?next=${encodeURIComponent(systemKind === "liked" ? "/posttube/loved" : systemKind === "watch_later" ? "/posttube/queue" : "/posttube/playlists")}`} className="tube-library__cta">
          Sign in
        </Link>
      </div>
    );
  } else if (status === "loading" || (status === "ready" && itemsLoading)) {
    body = (
      <ul className="tube-library__list" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="tube-library__skeleton" aria-hidden />
        ))}
      </ul>
    );
  } else if (status === "missing") {
    body = (
      <div className="tube-library__empty" role="alert">
        <h2>This collection is not here</h2>
        <p>It may have been deleted, or it is private to its owner.</p>
        {backHref ? (
          <Link href={backHref} className="tube-library__cta">
            {backLabel ?? "Back"}
          </Link>
        ) : null}
      </div>
    );
  } else if (status === "error" || itemsError) {
    body = (
      <div className="tube-library__empty" role="alert">
        <h2>Couldn&apos;t load this list</h2>
        <p>Check your connection and try again.</p>
        <button type="button" className="tube-library__cta" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <div className="tube-library__empty">
        <Icon size={26} />
        <h2>{kindCopy?.emptyTitle ?? "This collection is empty"}</h2>
        <p>{kindCopy?.emptyBody ?? "Use Add to collection on a video to fill it."}</p>
        <Link href="/posttube" className="tube-library__cta">
          <Play size={14} /> Watch
        </Link>
      </div>
    );
  } else {
    body = (
      <ol className="tube-library__list" aria-label={`${title} videos`}>
        {items.map((item, index) => (
          <CollectionRow
            key={item.postId}
            item={item}
            index={index}
            count={items.length}
            listId={listId}
            canEdit={canEdit}
            removing={pending.remove === item.postId}
            drag={dragId ? { dragging: dragId === item.postId, dropBefore: dropAt?.index === index && !dropAt.after, dropAfter: dropAt?.index === index && !!dropAt.after } : undefined}
            onMoveUp={() => onMoveBy(item.postId, -1)}
            onMoveDown={() => onMoveBy(item.postId, 1)}
            onRemove={() => onRemove(item.postId)}
            onDragStart={onDragStart(item.postId)}
            onDragOver={onDragOver(index)}
            onDrop={onDrop(index)}
            onDragEnd={onDragEnd}
          />
        ))}
      </ol>
    );
  }

  return (
    <section className="tube-library" aria-labelledby="tube-collection-title">
      {backHref ? (
        <Link href={backHref} className="tube-library__back">
          ← {backLabel ?? "Back"}
        </Link>
      ) : null}

      <header className="tube-library__head">
        <span className="tube-library__glyph" aria-hidden>
          <Icon />
        </span>
        {editing && collection ? (
          <form className="tube-library__form" onSubmit={submitEdit} aria-label="Edit collection">
            <label className="tube-library__field">
              Title
              <input required maxLength={120} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} autoFocus />
            </label>
            <label className="tube-library__field">
              Description
              <textarea maxLength={1000} rows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            </label>
            <label className="tube-library__field">
              Visibility
              <select value={draft.visibility} onChange={(e) => setDraft((d) => ({ ...d, visibility: e.target.value as CollectionVisibility }))}>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </label>
            <div className="tube-library__form-actions">
              <button type="submit" className="tube-library__button" disabled={pending.patch || !draft.title.trim()}>
                {pending.patch ? "Saving…" : "Save"}
              </button>
              <button type="button" className="tube-library__button is-quiet" onClick={() => setEditing(false)} disabled={pending.patch}>
                Cancel
              </button>
              {error ? <p className="tube-library__error">{error}</p> : null}
            </div>
          </form>
        ) : (
          <>
            <div className="tube-library__titles">
              <h1 id="tube-collection-title" className="tube-library__title">
                {title}
              </h1>
              <p className="tube-library__meta">
                {status === "ready" && collection ? <span>{countLabel(count)}</span> : null}
                {isSystem ? <span className="tube-library__pill is-system">Yours</span> : collection ? <VisibilityPill visibility={collection.visibility} /> : null}
              </p>
              {collection?.description && !isSystem ? <p className="tube-library__desc">{collection.description}</p> : null}
            </div>
            <div className="tube-library__actions">
              {play ? (
                <Link href={play} className="tube-library__play">
                  <Play className="fill-current" /> Play all
                </Link>
              ) : null}
              {canEdit && !isSystem ? (
                <>
                  <button type="button" className="tube-library__icon-button" aria-label="Edit collection" onClick={startEdit}>
                    <Pencil />
                  </button>
                  <button type="button" className="tube-library__icon-button is-danger" aria-label="Delete collection" onClick={() => setConfirmDelete(true)}>
                    <Trash2 />
                  </button>
                </>
              ) : null}
            </div>
            {error && !editing ? <p className="tube-library__error" style={{ flexBasis: "100%" }}>{error}</p> : null}
          </>
        )}
      </header>

      {body}

      {canEdit && !isSystem && collection ? (
        <ReelConfirmDialog
          open={confirmDelete}
          title={`Delete “${collection.title}”?`}
          description="The collection is removed. The videos in it are not deleted."
          confirmLabel="Delete"
          danger
          pending={pending.destroy}
          onConfirm={() => {
            void onDelete().then((ok) => {
              if (ok) setConfirmDelete(false);
            });
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </section>
  );
}

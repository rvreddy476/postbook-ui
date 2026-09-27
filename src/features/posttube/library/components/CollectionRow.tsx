"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, GripVertical, Loader2, X } from "lucide-react";
import type { DragEvent } from "react";

import { formatCount, formatDuration, rowToVideo, timeAgo } from "../../model";
import type { CollectionItem } from "../libraryApi";

export interface CollectionRowProps {
  item: CollectionItem;
  index: number;
  count: number;
  /** `?list=` on every link so the watch page can step through the list. */
  listId: string;
  canEdit: boolean;
  removing: boolean;
  drag?: { dragging: boolean; dropBefore: boolean; dropAfter: boolean };
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onDragStart?: (e: DragEvent<HTMLLIElement>) => void;
  onDragOver?: (e: DragEvent<HTMLLIElement>) => void;
  onDrop?: (e: DragEvent<HTMLLIElement>) => void;
  onDragEnd?: () => void;
}

/*
  One row: 160×90 thumb, 13px title, 11px meta. The handle drags (HTML5
  drag API); Move up / Move down are the keyboard path to the same move.
*/
export function CollectionRow({ item, index, count, listId, canEdit, removing, drag, onMoveUp, onMoveDown, onRemove, onDragStart, onDragOver, onDrop, onDragEnd }: CollectionRowProps) {
  const video = item.post ? rowToVideo(item.post) : null;
  const href = `/posttube/watch/${encodeURIComponent(item.postId)}?list=${encodeURIComponent(listId)}`;
  const title = video?.title || "Untitled video";
  const meta = video
    ? [video.channel_name, video.view_count > 0 ? `${formatCount(video.view_count)} views` : null, video.published_at ? timeAgo(video.published_at) : null].filter(Boolean).join(" · ")
    : "";
  const className = [
    "tube-library__row",
    canEdit ? "" : "is-static",
    drag?.dragging ? "is-dragging" : "",
    drag?.dropBefore ? "is-drop-before" : "",
    drag?.dropAfter ? "is-drop-after" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      className={className}
      draggable={canEdit || undefined}
      onDragStart={canEdit ? onDragStart : undefined}
      onDragOver={canEdit ? onDragOver : undefined}
      onDrop={canEdit ? onDrop : undefined}
      onDragEnd={canEdit ? onDragEnd : undefined}
      data-post-id={item.postId}
    >
      {canEdit ? (
        <span className="tube-library__handle" aria-hidden title="Drag to reorder">
          <GripVertical />
        </span>
      ) : null}
      <span className="tube-library__index" aria-hidden>
        {index + 1}
      </span>
      <Link href={href} className="tube-library__thumb" tabIndex={-1} aria-hidden>
        {video?.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail_url} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="tube-library__thumb-empty">No poster</span>
        )}
        {video && video.duration_seconds > 0 ? <span className="tube-library__duration">{formatDuration(video.duration_seconds)}</span> : null}
      </Link>
      <div className="tube-library__body">
        <Link href={href} className="tube-library__row-title">
          {title}
        </Link>
        {meta ? <p className="tube-library__row-meta">{meta}</p> : null}
      </div>
      {canEdit ? (
        <div className="tube-library__row-actions">
          <button type="button" className="tube-library__icon-button" aria-label={`Move up: ${title}`} disabled={index === 0 || removing} onClick={onMoveUp}>
            <ChevronUp />
          </button>
          <button type="button" className="tube-library__icon-button" aria-label={`Move down: ${title}`} disabled={index >= count - 1 || removing} onClick={onMoveDown}>
            <ChevronDown />
          </button>
          <button type="button" className="tube-library__icon-button is-danger" aria-label={`Remove: ${title}`} disabled={removing} onClick={onRemove}>
            {removing ? <Loader2 className="animate-spin" /> : <X />}
          </button>
        </div>
      ) : null}
    </li>
  );
}

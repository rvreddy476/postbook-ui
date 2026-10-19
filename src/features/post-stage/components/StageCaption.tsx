"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Music } from "lucide-react";

import { linkifyPostText } from "@/features/post-stage/components/WordsOnColour";
import { captionMayOverflow, relativeDate, trailingHashtags, type StagePost } from "@/features/post-stage/model";

const useIsoLayoutEffect = typeof window === "undefined" ? () => undefined : useLayoutEffect;

/*
  The block at the bottom-left of the frame: "@handle · 2h", the declared
  labels, the title, the caption clamped to two lines with "more" to open
  it in place, the hashtags the caption does not already show, and the
  sound line when the post plays one. `showCaption` is off for a text post,
  whose words are already the page.
*/
export function StageCaption({
  post,
  authorName,
  handle,
  profileHref,
  showCaption = true,
  now,
  above,
}: {
  post: StagePost;
  authorName: string;
  handle: string;
  profileHref: string;
  showCaption?: boolean;
  now?: number;
  /** Drawn above the block (the carousel dots). */
  above?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const caption = showCaption ? post.caption : "";
  const [overflows, setOverflows] = useState(() => captionMayOverflow(caption));
  const textRef = useRef<HTMLParagraphElement>(null);

  // Measure once drawn: "more" only when two lines really do not hold it.
  useIsoLayoutEffect(() => {
    const el = textRef.current;
    if (!el || open) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [caption, open]);

  const tags = trailingHashtags(caption, post.hashtags);
  const date = relativeDate(post.createdAt, now);
  const who = handle ? `@${handle}` : authorName;

  return (
    <div className="ps-caption" onClick={(e) => e.stopPropagation()}>
      {above}
      <p className="ps-caption__byline">
        <Link href={profileHref} className="ps-caption__handle">{who}</Link>
        {date ? <span className="ps-caption__date"> · {date}</span> : null}
      </p>
      {post.labels.length ? (
        <ul className="ps-caption__labels" aria-label="Labels">
          {post.labels.map((label) => (
            <li key={label} className="ps-caption__label">{label}</li>
          ))}
        </ul>
      ) : null}
      {post.title ? <h2 className="ps-caption__title">{post.title}</h2> : null}
      {caption || tags.length ? (
        <div className="ps-caption__text-wrap">
          <p ref={textRef} className={`ps-caption__text${open ? " is-open" : ""}`}>
            {linkifyPostText(caption, "ps-caption__link")}
            {tags.map((tag) => (
              <span key={tag}>
                {" "}
                <Link href={`/hashtag/${encodeURIComponent(tag)}`} className="ps-caption__link">#{tag}</Link>
              </span>
            ))}
          </p>
          {overflows && !open ? (
            <button type="button" className="ps-caption__more" onClick={() => setOpen(true)} aria-expanded={false}>
              more
            </button>
          ) : null}
          {open ? (
            <button type="button" className="ps-caption__more" onClick={() => setOpen(false)} aria-expanded>
              less
            </button>
          ) : null}
        </div>
      ) : null}
      {post.sound ? (
        <p className="ps-caption__sound">
          <Music size={14} aria-hidden="true" />
          <span>
            {post.sound.title}
            {post.sound.artist ? ` · ${post.sound.artist}` : ""}
          </span>
        </p>
      ) : null}
    </div>
  );
}

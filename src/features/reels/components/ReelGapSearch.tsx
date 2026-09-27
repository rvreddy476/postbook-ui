"use client";

import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { reelSearchHref } from "@/features/reels/search";

/*
  The reel search that lives in the gap between the video and the open
  comments: always an open text bar (the founder's call), its right edge
  beside the panel, growing leftward but stopping short of the action rail.
  Enter goes to the reel-only results page; Escape clears it.
*/
const GAP_SEARCH_MIN_WIDTH = 150;

export function ReelGapSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const form = useRef<HTMLFormElement>(null);

  // The rail's rendered position depends on the frame's aspect, so the
  // room is measured rather than styled.
  useLayoutEffect(() => {
    const el = form.current;
    const rail = el?.closest(".reels-content")?.querySelector(".reel-action-rail.is-desktop");
    if (!el || !rail) return;
    const room = el.getBoundingClientRect().right - rail.getBoundingClientRect().right - 12;
    el.style.maxWidth = `${Math.max(GAP_SEARCH_MIN_WIDTH, Math.floor(room))}px`;
  }, []);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const href = reelSearchHref(q);
    if (href) router.push(href);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setQ("");
      e.currentTarget.blur();
    }
  };

  return (
    <form ref={form} role="search" className="reel-gap-search is-open" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
      <Search size={16} strokeWidth={1.75} aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
        placeholder="Search reels"
        aria-label="Search reels"
        enterKeyHint="search"
      />
      {q ? (
        <button type="button" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ("")}>
          <X size={14} aria-hidden />
        </button>
      ) : null}
    </form>
  );
}

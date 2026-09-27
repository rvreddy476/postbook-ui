"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { reelSearchHref } from "@/features/reels/search";

/*
  The search that lives in the gap between the video and the open comments.
  At rest it is a 40px circle just left of the panel; a click expands it in
  place into a text bar (no route change), Enter takes the viewer to the
  reel-only results page, Escape or an empty blur collapses it again.
*/
const GAP_SEARCH_MIN_WIDTH = 150;

export function ReelGapSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // The bar grows leftward from beside the panel; it must stop short of the action rail,
  // whose rendered position depends on the frame's aspect, so it is measured, not styled.
  useLayoutEffect(() => {
    if (!open) return;
    const el = form.current;
    const rail = el?.closest(".reels-content")?.querySelector(".reel-action-rail.is-desktop");
    if (!el || !rail) return;
    const room = el.getBoundingClientRect().right - rail.getBoundingClientRect().right - 12;
    el.style.maxWidth = `${Math.max(GAP_SEARCH_MIN_WIDTH, Math.floor(room))}px`;
  }, [open]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const href = reelSearchHref(q);
    if (href) router.push(href);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setQ("");
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="reel-gap-search" aria-label="Search reels" aria-expanded={false} onClick={() => setOpen(true)}>
        <Search size={18} strokeWidth={1.75} aria-hidden />
      </button>
    );
  }
  return (
    <form ref={form} role="search" className="reel-gap-search is-open" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
      <Search size={16} strokeWidth={1.75} aria-hidden />
      <input
        ref={input}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => { if (!q.trim()) setOpen(false); }}
        placeholder="Search reels"
        aria-label="Search reels"
        enterKeyHint="search"
      />
      <button type="button" aria-label="Close search" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(""); setOpen(false); }}>
        <X size={14} aria-hidden />
      </button>
    </form>
  );
}

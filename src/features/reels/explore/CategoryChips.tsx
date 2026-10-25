"use client";

import { useRef, type KeyboardEvent } from "react";

import { EXPLORE_ALL, nextChipIndex, type ExploreCategory } from "@/features/reels/explore/exploreApi";
import "./explore.css";

export interface CategoryChipsProps {
  categories: readonly ExploreCategory[];
  /** The selected slug; EXPLORE_ALL ("") is "All". */
  value: string;
  onChange: (slug: string) => void;
  loading?: boolean;
}

/**
 * The chips above the Explore grid: "All" first, then the short-video
 * categories in the server's order. One toolbar, one tab stop (the selected
 * chip); arrows, Home and End move focus along it, Enter or Space selects —
 * so walking the row never fires a request per keypress. Scrolls sideways.
 */
export function CategoryChips({ categories, value, onChange, loading = false }: CategoryChipsProps) {
  const chips: ExploreCategory[] = [{ slug: EXPLORE_ALL, label: "All" }, ...categories];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(0, chips.findIndex((c) => c.slug === value));

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextChipIndex(index, e.key, chips.length);
    if (next === null) return;
    e.preventDefault();
    const el = refs.current[next];
    el?.focus();
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };

  return (
    <div role="toolbar" aria-label="Categories" aria-orientation="horizontal" className="explore-chips" aria-busy={loading || undefined}>
      {chips.map((chip, i) => (
        <button
          key={chip.slug || "all"}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          className="explore-chip"
          data-chip={chip.slug || "all"}
          aria-pressed={i === selected}
          tabIndex={i === selected ? 0 : -1}
          onKeyDown={(e) => onKeyDown(e, i)}
          onClick={() => onChange(chip.slug)}
        >
          {chip.label}
        </button>
      ))}
      {loading ? (
        <span className="explore-chip is-skeleton" aria-hidden>
          &nbsp;
        </span>
      ) : null}
    </div>
  );
}

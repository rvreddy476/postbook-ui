"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";

import { placeQueryReady, searchPlaces, type PlaceSuggestion } from "../placesApi";

/*
  The post's location (location_name / location_place_id): type to search
  places and pick one, or keep what you typed as free text. Search stops
  quietly when the server has no place provider (503).
*/
export function LocationField({
  name,
  placeId,
  onChange,
}: {
  name: string;
  placeId: string | null;
  onChange: (next: { name: string; placeId: string | null }) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  // One Google billing session per pick.
  const session = useRef<string>(newSession());

  useEffect(() => {
    if (unavailable || !placeQueryReady(name, { name, placeId })) {
      setResults([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchPlaces(name, session.current, ctrl.signal)
        .then((r) => {
          if (r.kind === "unavailable") {
            setUnavailable(true);
            setResults([]);
          } else {
            setResults(r.places);
            setActive(-1);
          }
        })
        .catch(() => setResults([]))
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [name, placeId, unavailable]);

  const pick = (p: PlaceSuggestion) => {
    onChange({ name: p.name, placeId: p.placeId });
    setOpen(false);
    setResults([]);
    session.current = newSession();
  };

  const showList = open && results.length > 0;

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="upload-location"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          value={name}
          maxLength={100}
          autoComplete="off"
          placeholder={unavailable ? "Add a location" : "Search places"}
          onChange={(e) => {
            onChange({ name: e.target.value, placeId: null });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!showList) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              pick(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-11 w-full rounded-xl border border-brand-text/10 bg-brand-secondary pl-9 pr-10 text-[14px] text-brand-text placeholder:text-muted outline-hidden transition-all focus:border-brand-text focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Searching places" />
          ) : name ? (
            <button
              type="button"
              aria-label="Remove location"
              className="rounded-full p-0.5 text-muted hover:text-brand-text"
              onClick={() => onChange({ name: "", placeId: null })}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </span>
      </div>
      {showList ? (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-brand-text/10 bg-brand-card py-1 shadow-lg">
          {results.map((p, i) => (
            <li
              key={p.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className={`flex cursor-pointer items-start gap-2 px-3 py-2 ${i === active ? "bg-brand-secondary" : "hover:bg-brand-secondary"}`}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-brand-text">{p.name}</span>
                {p.secondary ? <span className="block truncate text-[11px] text-muted">{p.secondary}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function newSession(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
}

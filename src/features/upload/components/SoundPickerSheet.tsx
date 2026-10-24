"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, Music, Pause, Play, Search, TrendingUp, X } from "lucide-react";

import { useSoundList, useTrendingSounds } from "@/features/reels/hooks/useSounds";
import { soundSearchTerm } from "@/features/reels/data/soundsApi";
import { signInHref, type SoundInfo } from "@/features/reels/sounds";
import { TRENDING_PAGE_SIZE, trendingSoundsHref } from "@/features/reels/trendingSounds";
import { useLibrarySoundUse, useSoundLibrary } from "@/features/posttube/hub/hooks/useHub";

import {
  createDebouncer,
  genreLabel,
  mergeGenres,
  nextTabIndex,
  pickLibrarySound,
  libraryRowsBesideShelf,
  rowFromLibrary,
  rowFromSound,
  rowFromTrending,
  rowIsChosen,
  soundRowMeta,
  SOUND_PICKER_TABS,
  SOUND_SEARCH_DEBOUNCE_MS,
  startPreview,
  stopPreview,
  type SoundPickerRow,
  type SoundPickerTab,
} from "../soundPicker";

/*
  The Audio section's sound picker: a sheet with three tabs — Trending,
  Search, Library. Trending opens first: this week's top 20 (rank, a Rising
  chip, "N reels this week"), then the curated library under it. Each row plays a preview only when its play button is
  pressed (one muted <audio> element for the whole sheet), and "Use" puts
  the sound on the reel. A library sound is turned into its audio_tracks id
  first (POST /v1/audio-library/:id/use); the library id never reaches the
  form. The sheet takes the whole screen on a phone and is a dialog on
  wider screens; Esc closes it and focus goes back to the button that
  opened it (the caller's job: it owns that button).
*/

export interface SoundPickerSheetProps {
  onClose: () => void;
  /** Put the sound on the reel (its id is an audio_tracks id). The sheet closes itself afterwards. */
  onChoose: (sound: SoundInfo) => void;
  /** The audio_tracks id the reel already carries, if any. */
  chosenTrackId?: string | null;
}

/* ── pure views (rendered by the tests) ────────────────────── */

export interface SoundPickerRowsProps {
  rows: readonly SoundPickerRow[];
  playingKey: string | null;
  /** The row whose use is in flight; every Use waits while one is. */
  usingKey?: string | null;
  chosenTrackId?: string | null;
  onTogglePreview: (row: SoundPickerRow) => void;
  onUse: (row: SoundPickerRow) => void;
}

export function SoundPickerRows({ rows, playingKey, usingKey = null, chosenTrackId = null, onTogglePreview, onUse }: SoundPickerRowsProps) {
  return (
    <ul className="divide-y divide-brand-text/10" data-sound-picker-rows>
      {rows.map((row) => {
        const playing = playingKey === row.key;
        const chosen = rowIsChosen(row, chosenTrackId);
        const using = usingKey === row.key;
        const trending = row.kind === "sound" ? row.trending : undefined;
        const meta = [soundRowMeta(row), trending?.usesLabel ?? ""].filter(Boolean).join(" · ");
        return (
          <li key={row.key} className="flex items-center gap-3 py-2.5" data-sound-row={row.kind} data-sound-rank={trending ? trending.rank : undefined}>
            {trending ? (
              <span className="w-6 shrink-0 text-center text-[13px] font-bold tabular-nums text-muted-foreground">
                <span className="sr-only">Number </span>
                {trending.rank}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onTogglePreview(row)}
              disabled={!row.previewSrc}
              aria-pressed={playing}
              aria-label={`${playing ? "Pause" : "Play"} preview of ${row.title}`}
              title={row.previewSrc ? undefined : "No preview for this sound"}
              data-preview={playing ? "playing" : "idle"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-brand-text transition-colors hover:bg-primary-tint focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            </button>
            <div className="min-w-0 flex-1">
              {trending?.rising ? (
                <p className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-brand-text">{row.title}</span>
                  <RisingChip />
                </p>
              ) : (
                <p className="truncate text-[13px] font-semibold text-brand-text">{row.title}</p>
              )}
              {meta ? <p className="truncate text-[12px] text-muted-foreground">{meta}</p> : null}
            </div>
            {chosen ? (
              <span className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-primary-ink" data-sound-chosen>
                <Check className="h-3.5 w-3.5" aria-hidden />
                In use
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onUse(row)}
                disabled={usingKey !== null}
                aria-label={`Use ${row.title}`}
                data-action="use-sound"
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-ink px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {using ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                {using ? "Adding…" : "Use"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Loading, empty, error, or the rows; with "Load more" under a full page. */
export function SoundPickerList({
  status,
  emptyText,
  errorText,
  onRetry,
  hasMore = false,
  loadingMore = false,
  onMore,
  children,
}: {
  status: "loading" | "error" | "empty" | "ready";
  emptyText: string;
  errorText: string;
  onRetry?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onMore?: () => void;
  children?: ReactNode;
}) {
  if (status === "loading") {
    return (
      <div role="status" aria-live="polite" className="space-y-3 py-2" data-sound-picker-state="loading">
        <span className="sr-only">Loading sounds…</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3" aria-hidden>
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-brand-secondary" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 animate-pulse rounded bg-brand-secondary" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-brand-secondary" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (status === "error") {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center" data-sound-picker-state="error">
        <p className="text-[13px] text-brand-text/70">{errorText}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-brand-text/15 px-3 py-1.5 text-[12px] font-semibold text-brand-text transition-colors hover:bg-brand-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }
  if (status === "empty") {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center" data-sound-picker-state="empty">
        <Music className="h-5 w-5 text-muted-foreground" aria-hidden />
        <p className="text-[13px] text-muted-foreground">{emptyText}</p>
      </div>
    );
  }
  return (
    <div data-sound-picker-state="ready">
      {children}
      {hasMore && onMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onMore}
            disabled={loadingMore}
            className="flex items-center gap-1.5 rounded-lg border border-brand-text/15 px-3 py-1.5 text-[12px] font-semibold text-brand-text transition-colors hover:bg-brand-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface SoundPickerFrameProps {
  tab: SoundPickerTab;
  onTab: (tab: SoundPickerTab, focus?: boolean) => void;
  onClose: () => void;
  idBase: string;
  tabRefs?: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  /** One line above the list: a refused use or a preview that would not play. */
  message?: string | null;
  children: ReactNode;
}

/** The dialog: title, close, the tab row, and the active tab's panel. */
export function SoundPickerFrame({ tab, onTab, onClose, idBase, tabRefs, message = null, children }: SoundPickerFrameProps) {
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextTabIndex(index, e.key);
    if (next === null) return;
    e.preventDefault();
    onTab(SOUND_PICKER_TABS[next].id, true);
  };
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-brand-text/10 px-4 py-3">
        <h2 id={`${idBase}-title`} className="text-[15px] font-semibold text-brand-text">
          Add a sound
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-action="close-sound-picker"
          className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-text focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div role="tablist" aria-label="Sound sources" className="flex gap-1 border-b border-brand-text/10 px-3 pt-2">
        {SOUND_PICKER_TABS.map((t, index) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(el) => {
                if (tabRefs) tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${idBase}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${idBase}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTab(t.id)}
              onKeyDown={(e) => onTabKey(e, index)}
              className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                selected ? "border-primary-ink text-brand-text" : "border-transparent text-muted-foreground hover:text-brand-text"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {message ? (
        <p role="alert" className="mx-4 mt-3 rounded-lg bg-brand-secondary px-3 py-2 text-[12px] text-danger" data-sound-picker-message>
          {message}
        </p>
      ) : null}
      <div
        role="tabpanel"
        id={`${idBase}-panel-${tab}`}
        aria-labelledby={`${idBase}-tab-${tab}`}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2 focus-visible:outline-hidden"
      >
        {children}
      </div>
    </>
  );
}

/* ── the panels (each mounted only while its tab is open) ──── */

interface PanelProps {
  rowsProps: Omit<SoundPickerRowsProps, "rows">;
}

function listStatus(q: { isPending: boolean; isError: boolean }, count: number): "loading" | "error" | "empty" | "ready" {
  if (q.isError) return "error";
  if (q.isPending) return "loading";
  return count === 0 ? "empty" : "ready";
}

/** The "Rising" chip on a trending row. */
export function RisingChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary-tint px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-primary-ink" data-rising>
      <TrendingUp className="h-3 w-3" aria-hidden />
      Rising
    </span>
  );
}

export interface TrendingShelfProps extends PanelProps {
  status: "loading" | "error" | "empty" | "ready";
  rows: readonly SoundPickerRow[];
  onRetry?: () => void;
}

/**
 * The Trending tab's top: this week's top 20 with their ranks and Rising
 * chips, and "See all" to the full page. That page opens in a new tab so
 * the reel being made here is not left behind.
 */
export function TrendingShelf({ status, rows, onRetry, rowsProps }: TrendingShelfProps) {
  return (
    <section aria-labelledby="sound-picker-trending-title" data-trending-shelf>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h3 id="sound-picker-trending-title" className="text-[13px] font-semibold text-brand-text">
          Trending this week
        </h3>
        <a
          href={trendingSoundsHref()}
          target="_blank"
          rel="noopener"
          data-action="see-all-trending"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-primary-ink transition-colors hover:bg-brand-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          See all
          <ExternalLink className="h-3 w-3" aria-hidden />
          <span className="sr-only"> trending sounds (opens in a new tab)</span>
        </a>
      </div>
      <SoundPickerList
        status={status}
        emptyText="No sounds are trending yet. Pick one from the library below."
        errorText="Trending sounds are not available right now."
        onRetry={onRetry}
      >
        <SoundPickerRows rows={rows} {...rowsProps} />
      </SoundPickerList>
    </section>
  );
}

/** Trending first (top 20), then the curated library. */
function TrendingPanel({ rowsProps, genre, onGenre }: PanelProps & { genre: string; onGenre: (g: string) => void }) {
  const list = useTrendingSounds("all", { limit: TRENDING_PAGE_SIZE });
  const rows = useMemo(() => uniqueRows((list.data?.pages[0]?.items ?? []).slice(0, TRENDING_PAGE_SIZE).map(rowFromTrending)), [list.data]);
  return (
    <div className="space-y-4">
      <TrendingShelf status={listStatus(list, rows.length)} rows={rows} onRetry={() => void list.refetch()} rowsProps={rowsProps} />
      <section aria-labelledby="sound-picker-library-title" data-library-below-shelf>
        <h3 id="sound-picker-library-title" className="text-[13px] font-semibold text-brand-text">
          Sound library
        </h3>
        <LibraryPanel rowsProps={rowsProps} genre={genre} onGenre={onGenre} beside={rows} />
      </section>
    </div>
  );
}

/** The search term, settled: it follows the input 300 ms after the last key, and clears at once below two characters. */
function useSettledSearchTerm(raw: string): string | null {
  const [term, setTerm] = useState<string | null>(() => soundSearchTerm(raw));
  const debouncer = useMemo(() => createDebouncer<string | null>(setTerm, SOUND_SEARCH_DEBOUNCE_MS), []);
  useEffect(() => {
    const next = soundSearchTerm(raw);
    if (next === null) {
      debouncer.cancel();
      setTerm(null);
      return;
    }
    debouncer.call(next);
  }, [raw, debouncer]);
  useEffect(() => () => debouncer.cancel(), [debouncer]);
  return term;
}

function SearchPanel({ rowsProps, query, onQuery }: PanelProps & { query: string; onQuery: (q: string) => void }) {
  const term = useSettledSearchTerm(query);
  const typed = soundSearchTerm(query);
  const list = useSoundList("search", term);
  const rows = useMemo(() => uniqueRows((list.data?.pages ?? []).flatMap((p) => p.items).map(rowFromSound)), [list.data]);
  const settling = typed !== null && typed !== term;
  return (
    <div className="space-y-3">
      <label className="relative mt-2 block">
        <span className="sr-only">Search sounds</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search sounds"
          autoComplete="off"
          maxLength={100}
          data-sound-search
          className="w-full rounded-xl border border-brand-text/15 bg-brand-secondary py-2 pl-9 pr-3 text-[13px] text-brand-text placeholder:text-muted-foreground focus:border-primary-ink focus:outline-hidden"
        />
      </label>
      {typed === null ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground" data-sound-picker-state="idle">
          Type at least 2 characters to search.
        </p>
      ) : (
        <SoundPickerList
          status={settling ? "loading" : listStatus(list, rows.length)}
          emptyText={`No sounds match “${typed}”.`}
          errorText="Search is not available right now."
          onRetry={() => void list.refetch()}
          hasMore={Boolean(list.hasNextPage)}
          loadingMore={list.isFetchingNextPage}
          onMore={() => void list.fetchNextPage()}
        >
          <SoundPickerRows rows={rows} {...rowsProps} />
        </SoundPickerList>
      )}
    </div>
  );
}

function LibraryPanel({
  rowsProps,
  genre,
  onGenre,
  beside = EMPTY_ROWS,
}: PanelProps & { genre: string; onGenre: (g: string) => void; /** The shelf above, whose sounds are not listed twice. */ beside?: readonly SoundPickerRow[] }) {
  const library = useSoundLibrary(genre);
  const [genres, setGenres] = useState<string[]>([]);
  useEffect(() => {
    setGenres((prev) => mergeGenres(prev, library.rows));
  }, [library.rows]);
  const rows = useMemo(() => libraryRowsBesideShelf(library.rows.map(rowFromLibrary), beside), [library.rows, beside]);
  const options = ["", ...genres];
  return (
    <div className="space-y-3">
      {options.length > 1 ? (
        <div role="group" aria-label="Genre" className="mt-2 flex flex-wrap gap-1.5" data-sound-genres>
          {options.map((g) => {
            const on = g === genre;
            return (
              <button
                key={g || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => onGenre(g)}
                className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                  on ? "bg-primary-ink text-primary-foreground" : "bg-brand-secondary text-brand-text/70 hover:bg-primary-tint"
                }`}
              >
                {genreLabel(g)}
              </button>
            );
          })}
        </div>
      ) : null}
      <SoundPickerList
        status={listStatus(library, rows.length)}
        emptyText={genre ? "Nothing in this genre. Choose All to see every sound." : "The sound library is empty for now."}
        errorText="The sound library is not available right now."
        onRetry={() => void library.refetch()}
        hasMore={Boolean(library.hasNextPage)}
        loadingMore={library.isFetchingNextPage}
        onMore={() => void library.fetchNextPage()}
      >
        <SoundPickerRows rows={rows} {...rowsProps} />
      </SoundPickerList>
    </div>
  );
}

const EMPTY_ROWS: readonly SoundPickerRow[] = [];

function uniqueRows(rows: SoundPickerRow[]): SoundPickerRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));
}

/* ── the sheet ─────────────────────────────────────────────── */

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function SoundPickerSheet({ onClose, onChoose, chosenTrackId = null }: SoundPickerSheetProps) {
  const router = useRouter();
  const idBase = useId().replace(/:/g, "");
  const dialogRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [tab, setTab] = useState<SoundPickerTab>("trending");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [usingKey, setUsingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { mutateAsync: requestUse } = useLibrarySoundUse();

  const stop = useCallback(() => {
    stopPreview(audioRef.current);
    setPlayingKey(null);
  }, []);

  // Closing stops the preview; the page behind does not scroll while the sheet is up.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    const audio = audioRef.current;
    const body = document.body;
    const overflow = body.style.overflow;
    body.style.overflow = "hidden";
    tabRefs.current[0]?.focus();
    return () => {
      mountedRef.current = false;
      stopPreview(audio);
      body.style.overflow = overflow;
    };
  }, []);

  const changeTab = useCallback(
    (next: SoundPickerTab, focus = false) => {
      stop();
      setMessage(null);
      setTab(next);
      if (focus) tabRefs.current[SOUND_PICKER_TABS.findIndex((t) => t.id === next)]?.focus();
    },
    [stop],
  );

  const togglePreview = useCallback(
    (row: SoundPickerRow) => {
      const audio = audioRef.current;
      if (!audio || !row.previewSrc) return;
      if (playingKey === row.key) {
        stop();
        return;
      }
      setMessage(null);
      setPlayingKey(row.key);
      startPreview(audio, row.previewSrc).catch(() => {
        setPlayingKey((k) => (k === row.key ? null : k));
        setMessage("That preview could not play.");
      });
    },
    [playingKey, stop],
  );

  const use = useCallback(
    async (row: SoundPickerRow) => {
      if (usingKey) return;
      stop();
      setMessage(null);
      if (row.kind === "sound") {
        onChoose(row.sound);
        onClose();
        return;
      }
      setUsingKey(row.key);
      const pick = await pickLibrarySound(row.library, requestUse);
      // Closed while the use was in flight: the creator changed their mind.
      if (!mountedRef.current) return;
      if (pick.kind === "chosen") {
        onChoose(pick.sound);
        onClose();
        return;
      }
      setUsingKey(null);
      if (pick.kind === "signed-out") {
        onClose();
        router.push(signInHref(`${window.location.pathname}${window.location.search}`));
        return;
      }
      setMessage(pick.message);
    },
    [usingKey, stop, onChoose, onClose, requestUse, router],
  );

  // Esc closes; Tab stays inside the sheet.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const changeGenre = (g: string) => {
    stop();
    setGenre(g);
  };

  const rowsProps = { playingKey, usingKey, chosenTrackId, onTogglePreview: togglePreview, onUse: (row: SoundPickerRow) => void use(row) };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-stretch justify-center bg-[rgb(var(--reel-stage)/0.6)] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idBase}-title`}
        onKeyDown={onKeyDown}
        data-sound-picker
        className="flex h-[100dvh] w-full flex-col bg-brand-card text-brand-text shadow-xl sm:h-[640px] sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-brand-text/10"
      >
        <SoundPickerFrame tab={tab} onTab={changeTab} onClose={onClose} idBase={idBase} tabRefs={tabRefs} message={message}>
          {tab === "trending" ? <TrendingPanel rowsProps={rowsProps} genre={genre} onGenre={changeGenre} /> : null}
          {tab === "search" ? <SearchPanel rowsProps={rowsProps} query={query} onQuery={setQuery} /> : null}
          {tab === "library" ? <LibraryPanel rowsProps={rowsProps} genre={genre} onGenre={changeGenre} /> : null}
        </SoundPickerFrame>
        {/* Muted, preload="none" and no source until a play press: nothing is heard or downloaded on open. */}
        <audio
          ref={audioRef}
          preload="none"
          muted
          hidden
          aria-hidden
          onEnded={stop}
          onError={() => {
            if (!playingKey) return;
            stop();
            setMessage("That preview could not play.");
          }}
          data-sound-picker-audio
        />
      </div>
    </div>,
    document.body,
  );
}

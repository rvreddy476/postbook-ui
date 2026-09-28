"use client";

import { CalendarClock, ChevronDown, EyeOff, Globe, Link2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { HUB_FLAGS, HUB_VISIBILITIES, type HubFlag, type HubVisibility } from "../hubApi";
import { FLAG_LABEL, FLAG_TONE, VISIBILITY_LABEL } from "../hubModel";

/* ── Flags ──────────────────────────────────────────────── */

export function FlagPills({ flags }: { flags: HubFlag[] }) {
  if (flags.length === 0) return <span className="hub-tag hub-tag-muted">—</span>;
  return (
    <span className="hub-pills" style={{ gap: 3 }}>
      {HUB_FLAGS.filter((f) => flags.includes(f)).map((f) => (
        <span key={f} className={`hub-tag hub-tag-${FLAG_TONE[f]}`}>
          {FLAG_LABEL[f]}
        </span>
      ))}
    </span>
  );
}

/* ── Visibility ─────────────────────────────────────────── */

export function VisibilityIcon({ visibility }: { visibility: HubVisibility }) {
  if (visibility === "public") return <Globe aria-hidden="true" />;
  if (visibility === "unlisted") return <Link2 aria-hidden="true" />;
  if (visibility === "scheduled") return <CalendarClock aria-hidden="true" />;
  return <EyeOff aria-hidden="true" />;
}

/**
  Closes on outside click, Escape and any scroll; the caller owns `open`.
  `form: true` (panels with inputs) keeps it open on scroll and resize, so
  a phone keyboard opening — which scrolls and resizes — never closes the
  panel mid-typing.
*/
export function useDismiss(open: boolean, onClose: () => void, opts?: { form?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const form = opts?.form === true;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    if (!form) {
      document.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onClose);
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [open, onClose, form]);
  return ref;
}

/**
  Menus inside the table live in an `overflow: auto` card, which would clip
  an absolutely positioned popover. They are placed `fixed`, under the
  button that opened them, and useDismiss closes them on any scroll.
*/
export function useAnchoredMenu(open: boolean, align: "left" | "right", size?: { width?: number; height?: number }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const width = size?.width;
  const height = size?.height;
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // A tall panel opens upward when it would run past the bottom and there is more room above.
    const up = typeof height === "number" && r.bottom + 4 + height > vh && r.top > vh - r.bottom;
    const next: CSSProperties = up ? { position: "fixed", bottom: vh - r.top + 4 } : { position: "fixed", top: r.bottom + 4 };
    if (align === "right") next.right = Math.max(8, vw - r.right);
    else next.left = typeof width === "number" ? Math.max(8, Math.min(r.left, vw - width - 8)) : Math.max(8, r.left);
    if (typeof width === "number") next.maxWidth = vw - 16;
    setStyle(next);
  }, [open, align, width, height]);
  return { buttonRef, style };
}

/**
  The inline visibility pill on a table row: click → a small menu of the
  four states; "scheduled" hands off to the sheet (it needs a date).
*/
export function VisibilityPill({
  value,
  onChange,
  onSchedule,
  disabled = false,
  pending = false,
}: {
  value: HubVisibility;
  onChange: (next: Exclude<HubVisibility, "scheduled">) => void;
  onSchedule?: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const { buttonRef, style } = useAnchoredMenu(open, "left");
  return (
    <div className="hub-vis" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className="hub-vis-pill"
        data-vis={value}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled || pending}
        onClick={() => setOpen((o) => !o)}
        title="Change visibility"
      >
        <VisibilityIcon visibility={value} />
        {pending ? "Saving…" : VISIBILITY_LABEL[value]}
        <ChevronDown aria-hidden="true" style={{ opacity: 0.6 }} />
      </button>
      {open ? (
        <div className="hub-menu" style={style} role="menu">
          {HUB_VISIBILITIES.map((v) => (
            <button
              key={v}
              type="button"
              role="menuitemradio"
              aria-checked={v === value}
              className="hub-menu-item"
              onClick={() => {
                setOpen(false);
                if (v === "scheduled") onSchedule?.();
                else if (v !== value) onChange(v);
              }}
              disabled={v === "scheduled" && !onSchedule}
            >
              <VisibilityIcon visibility={v} />
              {VISIBILITY_LABEL[v]}
              {v === "scheduled" ? <small style={{ marginLeft: "auto", opacity: 0.6 }}>pick a date</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Pill groups (filters) ──────────────────────────────── */

export function PillGroup<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="hub-pill-group" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className="hub-pill" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, disabled = false, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="hub-toggle" disabled={disabled} onClick={() => onChange(!checked)} />;
}

export function SwitchRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="hub-switch">
      <span className="hub-switch-label">
        <span>{label}</span>
        {hint ? <span className="hub-switch-hint">{hint}</span> : null}
      </span>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}


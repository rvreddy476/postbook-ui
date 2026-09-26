"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import { APP_LAUNCHER, filterAppLauncher } from "@/lib/appBrand";
import "./video-shell.css";

export interface ExploreLauncherProps {
  open: boolean;
  onClose: () => void;
}

/*
  "Explore VChat": every service in one grid, filtered by a search field.
  A modal on a portal so it floats above the reels stage and the sidebar
  alike. Focus lands on the first tile when it opens; Tab wraps within the
  dialog; Escape and the scrim close it. A "soon" tile is a disabled button
  with a chip, never a link to a page that does not exist.
*/
export function ExploreLauncher({ open, onClose }: ExploreLauncherProps) {
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstTileRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const tiles = useMemo(() => filterAppLauncher(query, APP_LAUNCHER), [query]);

  useEffect(() => setMounted(true), []);

  // Reset the filter, focus the first tile, and give focus back on close.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const previous = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      (firstTileRef.current ?? dialogRef.current?.querySelector<HTMLElement>("input"))?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      previous?.focus?.();
    };
  }, [open]);

  // Escape closes; Tab stays inside the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // No page scroll behind the modal.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!mounted) return <></>;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="explore-launcher"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16 }}
        >
          <div className="explore-launcher__scrim" onClick={onClose} aria-hidden />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="explore-launcher__dialog"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12, scale: reduceMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 12, scale: reduceMotion ? 1 : 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "circOut" }}
          >
            <header className="explore-launcher__head">
              <h2 id={titleId} className="explore-launcher__title">Explore VChat</h2>
              <button type="button" className="explore-launcher__close" onClick={onClose} aria-label="Close">
                <X size={18} aria-hidden />
              </button>
            </header>

            <div className="explore-launcher__search">
              <Search size={16} className="explore-launcher__search-icon" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search apps"
                aria-label="Search apps"
                autoComplete="off"
              />
            </div>

            {tiles.length === 0 ? (
              <p className="explore-launcher__empty">No app matches “{query.trim()}”.</p>
            ) : (
              <ul className="explore-launcher__grid" aria-label="Apps">
                {tiles.map((tile, index) => {
                  const Icon = tile.icon;
                  const body = (
                    <>
                      <span className="explore-launcher__tile-icon"><Icon size={22} strokeWidth={1.75} aria-hidden /></span>
                      <span className="explore-launcher__tile-name">
                        {tile.name}
                        {tile.soon ? <span className="explore-launcher__chip">Soon</span> : null}
                        {!tile.soon && tile.badge === "new" ? <span className="explore-launcher__chip is-new">New</span> : null}
                      </span>
                      <span className="explore-launcher__tile-desc">{tile.description}</span>
                    </>
                  );
                  return (
                    <li key={tile.key}>
                      {tile.soon ? (
                        <button
                          type="button"
                          className="explore-launcher__tile is-soon"
                          disabled
                          aria-disabled="true"
                          ref={index === 0 ? (el) => { firstTileRef.current = el; } : undefined}
                        >
                          {body}
                        </button>
                      ) : (
                        <Link
                          href={tile.href}
                          className="explore-launcher__tile"
                          onClick={onClose}
                          ref={index === 0 ? (el) => { firstTileRef.current = el; } : undefined}
                        >
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

/*
  Below md the card is a bottom sheet, and it is portaled to <body>: the
  stage it would otherwise live in is animated with a transform, which
  turns every `fixed` descendant into a stage-relative box and scrolled the
  page sideways when the sheet opened.
*/
function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return phone;
}

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** Where the card anchors relative to the trigger's wrapper. */
  align?: "left" | "right";
  children: ReactNode;
  /** Bottom sheet below md, popover card at md and up. */
  sheetOnMobile?: boolean;
  /** Which way the card grows from the trigger on desktop. */
  placement?: "up" | "down";
  label: string;
  /** Settings sit below their full-width control bar, inside the portrait frame. */
  belowTrigger?: boolean;
}

/*
  One small popover used by the rail menus. Anchored to a `relative` parent
  on desktop; a bottom sheet on phones. Escape and outside clicks close it,
  and clicks inside never reach the stage (which would toggle playback).
*/
export function Popover({ open, onClose, align = "right", children, sheetOnMobile = true, placement = "up", label, belowTrigger = false }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const phone = useIsPhone();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, onClose]);

  const tree = (
    <AnimatePresence>
      {open ? (
        <>
          {sheetOnMobile ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            />
          ) : null}
          <motion.div
            ref={ref}
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className={`${belowTrigger ? "reel-settings-popover" : ""} z-50 overflow-hidden rounded-2xl border border-border bg-brand-card text-brand-text shadow-xl ${
              sheetOnMobile
                ? `fixed inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-b-none pb-[env(safe-area-inset-bottom)] md:absolute md:inset-x-auto md:max-h-none md:rounded-2xl md:pb-0 ${
                    placement === "down" ? "md:bottom-auto md:top-0" : "md:bottom-0"
                  }`
                : placement === "down"
                  ? "absolute top-0"
                  : "absolute bottom-0"
            } ${belowTrigger ? "" : `${align === "right" ? "md:right-full md:mr-3" : "md:left-full md:ml-3"} md:w-64`}`}
            onWheel={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  if (phone && sheetOnMobile && typeof document !== "undefined") {
    return createPortal(tree, document.fullscreenElement || document.body);
  }
  return tree;
}

export function MenuRow({
  icon,
  label,
  hint,
  onClick,
  danger,
  disabled,
  trailing,
}: {
  icon?: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-medium transition hover:bg-brand-secondary disabled:opacity-40 ${
        danger ? "text-danger" : "text-brand-text"
      }`}
    >
      {icon ? <span className="shrink-0 text-current/80">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint ? <span className="block truncate text-[11px] font-normal text-text-muted">{hint}</span> : null}
      </span>
      {trailing}
    </button>
  );
}

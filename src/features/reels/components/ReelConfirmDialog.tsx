"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ReelConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  /** A red confirm for destructive actions (block, delete). */
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/*
  One small confirm for block and delete. role="alertdialog", focus lands
  on Cancel (the safe choice), Escape cancels, Tab cycles between the two
  buttons, and clicks never reach the stage underneath.
*/
export function ReelConfirmDialog({ open, title, description, confirmLabel, danger, pending, onConfirm, onCancel }: ReelConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key === "Tab") {
        const order = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLButtonElement[];
        if (order.length < 2) return;
        const i = order.indexOf(document.activeElement as HTMLButtonElement);
        e.preventDefault();
        const next = e.shiftKey ? (i <= 0 ? order.length - 1 : i - 1) : (i >= order.length - 1 ? 0 : i + 1);
        order[next].focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="reel-confirm-scrim"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
        >
          <motion.div
            role="alertdialog"
            aria-modal
            aria-labelledby="reel-confirm-title"
            aria-describedby={description ? "reel-confirm-desc" : undefined}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="reel-confirm-card"
          >
            <h2 id="reel-confirm-title" className="text-[15px] font-bold">{title}</h2>
            {description ? <p id="reel-confirm-desc" className="mt-1.5 text-[13px] leading-relaxed text-brand-text/70">{description}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className="rounded-full px-4 py-2 text-[13px] font-semibold text-brand-text transition hover:bg-brand-secondary"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                disabled={pending}
                onClick={onConfirm}
                className={`reel-confirm-button ${danger ? "is-danger" : ""}`}
              >
                {pending ? "Working…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

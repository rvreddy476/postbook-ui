"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** A small modal for the irreversible clicks: block, clear history, delete. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="posttube-confirm-title"
        className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-border bg-brand-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 id="posttube-confirm-title" className="text-[15px] font-bold text-brand-text">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-brand-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {body ? <div className="px-5 py-4 text-[13px] leading-relaxed text-brand-text">{body}</div> : null}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-brand-text hover:bg-brand-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50 ${
              danger ? "bg-danger hover:bg-danger/90" : "bg-primary-ink hover:bg-primary-hover"
            }`}
          >
            {pending ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

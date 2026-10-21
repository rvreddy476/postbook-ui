'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/*
  The frame shared by the thread's sheets (Forward, Report, Reactions, Seen
  by): a bottom sheet on phones, a centred card on wider screens, over a
  scrim. Escape or a tap on the scrim closes it — unless `busy`, so a send in
  flight is never abandoned half way.
*/
export function PickerSheetShell({
  title,
  onClose,
  busy = false,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return;
      e.stopPropagation();
      onClose();
    };
    // Capture phase, so the thread underneath does not also close on the same Escape.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, busy]);

  useEffect(() => {
    panel.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-2000 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => !busy && onClose()} aria-hidden />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-2xl border-t border-brand-divider bg-brand-card pb-[max(env(safe-area-inset-bottom),12px)] shadow-2xl outline-hidden sm:max-w-md sm:rounded-2xl sm:border"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-brand-text/20 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h3 className="text-[15px] font-semibold text-brand-text">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {footer && <div className="border-t border-brand-divider px-4 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

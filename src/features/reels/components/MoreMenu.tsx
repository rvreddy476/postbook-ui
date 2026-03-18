"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, Flag, MessageSquareWarning, Ban } from "lucide-react";

interface MoreMenuProps {
  onReport: () => void;
  onFeedback: () => void;
  onDontRecommend: () => void;
}

export function MoreMenu({ onReport, onFeedback, onDontRecommend }: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        whileTap={{ scale: 0.93 }}
        whileHover={{ scale: 1.04 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-150 ${
          open
            ? "bg-slate-900 text-white"
            : "bg-[#F5F5F7] text-brand-highlight hover:bg-brand-secondary/70"
        }`}
        aria-label="More"
      >
        <span className="flex h-7 w-7 items-center justify-center">
          <MoreHorizontal className="h-[14px] w-[14px]" />
        </span>
        <span className="text-[9px] font-medium">More</span>
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 w-[220px] overflow-hidden rounded-xl border border-brand-divider bg-brand-card py-1 shadow-lg"
          >
            <button
              type="button"
              onClick={() => {
                onReport();
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-brand-text transition hover:bg-brand-secondary"
            >
              <Flag className="h-4 w-4 text-brand-text/60" />
              Report
            </button>
            <button
              type="button"
              onClick={() => {
                onFeedback();
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-brand-text transition hover:bg-brand-secondary"
            >
              <MessageSquareWarning className="h-4 w-4 text-brand-text/60" />
              Send feedback
            </button>
            <div className="mx-3 my-1 h-px bg-brand-secondary" />
            <button
              type="button"
              onClick={() => {
                onDontRecommend();
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-red-600 transition hover:bg-red-50"
            >
              <Ban className="h-4 w-4 text-red-400" />
              Don&apos;t recommend this channel
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

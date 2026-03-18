"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import Link from "next/link";

/**
 * Non-blocking banner shown after a user's first publish.
 * Prompts them to complete their channel profile (avatar, handle, bio).
 * Reads from sessionStorage so it only appears once per session.
 */
export function CompleteChannelBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("atpost:show_complete_banner") === "1") {
        setVisible(true);
      }
    } catch {}
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.removeItem("atpost:show_complete_banner");
    } catch {}
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="mx-auto mt-4 flex max-w-2xl items-center gap-3 rounded-xl border border-brand-divider bg-gradient-to-r from-slate-50 to-white px-4 py-3 shadow-sm"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-brand-text">
              Complete your channel to improve reach
            </p>
            <p className="text-[12px] text-brand-text/60">
              Add an avatar, custom handle, and bio so viewers can find you.
            </p>
          </div>
          <Link
            href="/settings/profile"
            className="shrink-0 rounded-full bg-slate-900 px-4 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-text"
          >
            Complete Profile
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-full p-1 text-brand-text/60 transition hover:bg-brand-secondary hover:text-brand-highlight"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

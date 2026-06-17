"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MoreHorizontal,
  AlignLeft,
  ListPlus,
  Captions,
  Settings,
  CircleSlash,
  CircleX,
  Flag,
  MessageSquareWarning,
} from "lucide-react";
import type { ReactNode } from "react";

interface MoreMenuProps {
  onReport: () => void;
  onFeedback: () => void;
  onDontRecommend: () => void;
  onDescription?: () => void;
  onSaveToPlaylist?: () => void;
  onCaptions?: () => void;
  onQuality?: () => void;
  onNotInterested?: () => void;
}

interface MenuItem {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}

export function MoreMenu({
  onReport,
  onFeedback,
  onDontRecommend,
  onDescription,
  onSaveToPlaylist,
  onCaptions,
  onQuality,
  onNotInterested,
}: MoreMenuProps) {
  const [open, setOpen] = useState(false);

  const items: MenuItem[] = [
    { icon: <AlignLeft className="h-[18px] w-[18px]" />, label: "Description", onClick: onDescription },
    { icon: <ListPlus className="h-[18px] w-[18px]" />, label: "Save to playlist", onClick: onSaveToPlaylist },
    { icon: <Captions className="h-[18px] w-[18px]" />, label: "Captions", onClick: onCaptions },
    { icon: <Settings className="h-[18px] w-[18px]" />, label: "Quality", onClick: onQuality },
    { icon: <CircleSlash className="h-[18px] w-[18px]" />, label: "Not interested", onClick: onNotInterested },
    { icon: <CircleX className="h-[18px] w-[18px]" />, label: "Don't recommend this channel", onClick: onDontRecommend },
    { icon: <Flag className="h-[18px] w-[18px]" />, label: "Report", onClick: onReport },
    { icon: <MessageSquareWarning className="h-[18px] w-[18px]" />, label: "Send feedback", onClick: onFeedback },
  ];

  const select = (item: MenuItem) => {
    setOpen(false);
    item.onClick?.();
  };

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.93 }}
        whileHover={{ scale: 1.04 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 bg-brand-secondary text-brand-highlight transition-all duration-150 hover:bg-brand-secondary/70"
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
            className="fixed inset-0 z-[100] flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpen(false)}
              aria-hidden
            />

            {/* Bottom sheet */}
            <motion.div
              role="menu"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="relative w-full max-w-[480px] rounded-t-2xl border-t border-brand-divider bg-brand-card pb-[max(env(safe-area-inset-bottom),16px)] pt-2 shadow-2xl"
            >
              {/* Grab handle */}
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-brand-text/20" />

              <div className="py-1">
                {items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => select(item)}
                    className={`flex w-full items-center gap-5 px-5 py-3.5 text-left text-[15px] transition active:bg-brand-secondary hover:bg-brand-secondary ${
                      item.danger ? "text-rose-500" : "text-brand-text"
                    }`}
                  >
                    <span className={item.danger ? "text-rose-500" : "text-brand-text/80"}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Plus, Film, Clapperboard, Radio, Mic, PenSquare, Zap } from "lucide-react";

const CREATE_OPTIONS = [
  {
    label: "Video",
    description: "Upload a video to Posttube",
    href: "/posttube/upload?type=long",
    icon: Film,
    gradient: "from-brand-text to-black",
    hoverBg: "hover:bg-brand-secondary",
  },
  {
    label: "Reel / Clip",
    description: "Short vertical video with music & effects",
    href: "/posttube/upload?type=short",
    icon: Clapperboard,
    gradient: "from-brand-text to-black",
    hoverBg: "hover:bg-brand-secondary",
  },
  {
    label: "Live",
    description: "Go live and interact with your audience",
    href: "/live/start",
    icon: Radio,
    gradient: "from-[#F59E0B] to-[#D97706]",
    hoverBg: "hover:bg-[#FFF8EB]",
  },
  {
    label: "Podcast",
    description: "Record or upload a podcast episode",
    href: "/posttube/upload?type=podcast",
    icon: Mic,
    gradient: "from-brand-text to-black",
    hoverBg: "hover:bg-brand-secondary",
  },
  {
    label: "Create Post",
    description: "Share text, photos, or a quick update",
    href: "/create/post",
    icon: PenSquare,
    gradient: "from-brand-text to-black",
    hoverBg: "hover:bg-brand-secondary",
  },
] as const;

export function CreateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-text to-black text-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.4)] transition-shadow hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.5)]"
        aria-label="Create"
      >
        <Sparkles className="h-[17px] w-[17px]" />
        <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#F59E0B] ring-2 ring-white">
          <Plus className="h-2.5 w-2.5 text-white" strokeWidth={3} />
        </div>
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "circOut" }}
            className="absolute right-0 mt-3 w-[280px] rounded-2xl border border-[#EEEDF5] bg-brand-card/95 p-1.5 shadow-[0_24px_48px_-12px_rgba(15,13,21,0.12)] backdrop-blur-xl z-[100]"
          >
            <div className="px-3 py-2 flex items-center gap-2">
              <Zap className="h-3 w-3 text-[#F59E0B]" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#B0ADBE]">
                Create New
              </p>
            </div>

            {CREATE_OPTIONS.map((option) => (
              <button
                key={option.href}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(option.href);
                }}
                className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 transition-all ${option.hoverBg}`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${option.gradient} text-white shadow-sm`}>
                  <option.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[13px] font-semibold text-[#0F0D15] group-hover:text-brand-text transition-colors">{option.label}</p>
                  <p className="text-[11px] text-[#B0ADBE]">{option.description}</p>
                </div>
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
